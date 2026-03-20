import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  PolylineCollection,
  PointPrimitiveCollection,
  Material,
  Viewer as CesiumViewer,
} from 'cesium'
import { useCesium } from 'resium'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useFlightStore } from '../../stores/flightStore'
import { ensureAnimatedDashMaterial } from '../../utils/animatedDashMaterial'
import { lookupRoute } from '../../utils/routeLookup'
import type { FlightRoute } from '../../utils/routeLookup'
import type { Flight } from '../../types/flight'

const ARC_SAMPLES = 100
const PAST_COLOR = Color.fromCssColorString('#4fc3f7').withAlpha(0.3)
const FUTURE_COLOR = Color.fromCssColorString('#4fc3f7').withAlpha(0.7)
const AIRPORT_COLOR = Color.fromCssColorString('#4fc3f7')
const FLIGHT_ALTITUDE = 11000 // arc drawn at cruising altitude (meters)
const ARC_REBUILD_MS = 5000 // rebuild arc every 5 seconds to track flight movement

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

function greatCirclePoints(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  count: number,
): { lat: number; lng: number }[] {
  const φ1 = lat1 * DEG2RAD,
    λ1 = lng1 * DEG2RAD
  const φ2 = lat2 * DEG2RAD,
    λ2 = lng2 * DEG2RAD

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2,
      ),
    )

  if (d < 1e-10) return [{ lat: lat1, lng: lng1 }]

  const points: { lat: number; lng: number }[] = []
  for (let i = 0; i <= count; i++) {
    const f = i / count
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(φ1) * Math.cos(λ1) + b * Math.cos(φ2) * Math.cos(λ2)
    const y = a * Math.cos(φ1) * Math.sin(λ1) + b * Math.cos(φ2) * Math.sin(λ2)
    const z = a * Math.sin(φ1) + b * Math.sin(φ2)
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD2DEG
    const lng = Math.atan2(y, x) * RAD2DEG
    points.push({ lat, lng })
  }
  return points
}

function splitAtAntimeridian(positions: Cartesian3[], lngs: number[]): Cartesian3[][] {
  const segments: Cartesian3[][] = []
  let current: Cartesian3[] = [positions[0]]
  for (let i = 1; i < positions.length; i++) {
    if (Math.abs(lngs[i] - lngs[i - 1]) > 180) {
      if (current.length >= 2) segments.push(current)
      current = []
    }
    current.push(positions[i])
  }
  if (current.length >= 2) segments.push(current)
  return segments
}

function buildArcPrimitives(route: FlightRoute, flight: Flight): PolylineCollection {
  ensureAnimatedDashMaterial()

  const dep = route.departure
  const arr = route.arrival
  const fLat = flight.lat
  const fLng = flight.lng

  const polyColl = new PolylineCollection()

  // Past segment: departure → current position (solid dim line)
  const pastGeo = greatCirclePoints(dep.lat, dep.lng, fLat, fLng, ARC_SAMPLES)
  const pastPositions: Cartesian3[] = []
  const pastLngs: number[] = []
  for (const p of pastGeo) {
    pastPositions.push(Cartesian3.fromDegrees(p.lng, p.lat, FLIGHT_ALTITUDE))
    pastLngs.push(p.lng)
  }
  for (const seg of splitAtAntimeridian(pastPositions, pastLngs)) {
    polyColl.add({
      positions: seg,
      width: 2,
      material: Material.fromType('Color', { color: PAST_COLOR }),
    })
  }

  // Future segment: current position → arrival (animated dash)
  const futureGeo = greatCirclePoints(fLat, fLng, arr.lat, arr.lng, ARC_SAMPLES)
  const futurePositions: Cartesian3[] = []
  const futureLngs: number[] = []
  for (const p of futureGeo) {
    futurePositions.push(Cartesian3.fromDegrees(p.lng, p.lat, FLIGHT_ALTITUDE))
    futureLngs.push(p.lng)
  }
  for (const seg of splitAtAntimeridian(futurePositions, futureLngs)) {
    polyColl.add({
      positions: seg,
      width: 2,
      material: Material.fromType('AnimatedDash', {
        color: FUTURE_COLOR,
        dashLength: 0.006,
        speed: 0.005,
      }),
    })
  }

  return polyColl
}

export default function FlightTrajectoryOverlay() {
  const { viewer: rawViewer } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)

  const polyCollRef = useRef<PolylineCollection | null>(null)
  const pointCollRef = useRef<PointPrimitiveCollection | null>(null)
  const animFrameRef = useRef<number>(0)
  const rebuildTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Cleanup previous
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    if (rebuildTimerRef.current) {
      clearInterval(rebuildTimerRef.current)
      rebuildTimerRef.current = null
    }
    if (polyCollRef.current) {
      viewer.scene.primitives.remove(polyCollRef.current)
      polyCollRef.current = null
    }
    if (pointCollRef.current) {
      viewer.scene.primitives.remove(pointCollRef.current)
      pointCollRef.current = null
    }

    if (!selected || selected.layer !== 'flights') return

    const flight = useFlightStore.getState().entities.get(selected.entityId) as Flight | undefined
    if (!flight?.callsign) return

    let cancelled = false
    const entityId = selected.entityId

    lookupRoute(flight.callsign, flight.lat, flight.lng).then((route) => {
      if (cancelled || !route) return

      // Airport markers (static)
      const pointColl = new PointPrimitiveCollection()
      pointColl.add({
        position: Cartesian3.fromDegrees(route.departure.lng, route.departure.lat, 0),
        pixelSize: 6,
        color: AIRPORT_COLOR,
        outlineColor: Color.WHITE,
        outlineWidth: 1,
      })
      pointColl.add({
        position: Cartesian3.fromDegrees(route.arrival.lng, route.arrival.lat, 0),
        pixelSize: 6,
        color: AIRPORT_COLOR,
        outlineColor: Color.WHITE,
        outlineWidth: 1,
      })
      viewer.scene.primitives.add(pointColl)
      pointCollRef.current = pointColl

      // Build arc from current flight position
      const rebuildArc = () => {
        const f = useFlightStore.getState().entities.get(entityId) as Flight | undefined
        if (!f) return
        if (polyCollRef.current) viewer.scene.primitives.remove(polyCollRef.current)
        const coll = buildArcPrimitives(route, f)
        viewer.scene.primitives.add(coll)
        polyCollRef.current = coll
      }

      rebuildArc()

      // Rebuild arc periodically to track flight movement
      rebuildTimerRef.current = setInterval(rebuildArc, ARC_REBUILD_MS)

      // rAF loop just requests renders for the animated dash shader
      const animate = () => {
        viewer.scene.requestRender()
        animFrameRef.current = requestAnimationFrame(animate)
      }
      animFrameRef.current = requestAnimationFrame(animate)
    })

    return () => {
      cancelled = true
    }
  }, [rawViewer, selected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (rebuildTimerRef.current) clearInterval(rebuildTimerRef.current)
      if (!rawViewer) return
      const viewer = rawViewer as CesiumViewer
      if (polyCollRef.current) viewer.scene.primitives.remove(polyCollRef.current)
      if (pointCollRef.current) viewer.scene.primitives.remove(pointCollRef.current)
    }
  }, [rawViewer])

  return null
}
