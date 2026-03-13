import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  PolylineCollection,
  Material,
  Viewer as CesiumViewer,
} from 'cesium'
import { useCesium } from 'resium'
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from 'satellite.js'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

const ORBIT_SAMPLE_COUNT = 360
const ORBIT_COLOR = Color.CYAN.withAlpha(0.6)
const NADIR_COLOR = Color.CYAN.withAlpha(0.4)

export default function SatelliteOrbitOverlay() {
  const { viewer: rawViewer } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)
  const satellites = useSatelliteStore((s) => s.satellites)

  const orbitCollectionRef = useRef<PolylineCollection | null>(null)
  const nadirCollectionRef = useRef<PolylineCollection | null>(null)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Clean up previous polylines.
    if (orbitCollectionRef.current) {
      viewer.scene.primitives.remove(orbitCollectionRef.current)
      orbitCollectionRef.current = null
    }
    if (nadirCollectionRef.current) {
      viewer.scene.primitives.remove(nadirCollectionRef.current)
      nadirCollectionRef.current = null
    }

    if (!selected || selected.layer !== 'satellites') return

    const sat = satellites.get(selected.entityId)
    if (!sat?.tle1 || !sat?.tle2) return

    const satrec = twoline2satrec(sat.tle1, sat.tle2)

    // Compute orbital period from mean motion (revs/day → minutes).
    // mean motion is in revs/day stored in satrec.no (radians/minute).
    const meanMotionRadPerMin = satrec.no
    const periodMinutes = (2 * Math.PI) / meanMotionRadPerMin

    const now = new Date()
    const halfPeriod = periodMinutes / 2
    const stepMinutes = periodMinutes / ORBIT_SAMPLE_COUNT

    // Sample orbit points centered on "now" so we see half an orbit behind and half ahead.
    const orbitPositions: Cartesian3[] = []

    for (let i = 0; i <= ORBIT_SAMPLE_COUNT; i++) {
      const minutesFromNow = -halfPeriod + i * stepMinutes
      const sampleTime = new Date(now.getTime() + minutesFromNow * 60000)

      const posVel = propagate(satrec, sampleTime)
      if (!posVel || typeof posVel.position === 'boolean') continue

      const gmst = gstime(sampleTime)
      const geo = eciToGeodetic(posVel.position, gmst)

      const latDeg = degreesLat(geo.latitude)
      const lngDeg = degreesLong(geo.longitude)
      const altMeters = geo.height * 1000

      if (isNaN(latDeg) || isNaN(lngDeg) || isNaN(altMeters)) continue

      orbitPositions.push(Cartesian3.fromDegrees(lngDeg, latDeg, altMeters))
    }

    if (orbitPositions.length < 2) return

    // Split orbit polyline at large longitude jumps (antimeridian crossings)
    // to avoid lines cutting across the globe.
    const segments: Cartesian3[][] = []
    let currentSegment: Cartesian3[] = [orbitPositions[0]]

    for (let i = 1; i < orbitPositions.length; i++) {
      // Recompute lng for gap detection.
      const minutesFromNowPrev = -halfPeriod + (i - 1) * stepMinutes
      const minutesFromNowCurr = -halfPeriod + i * stepMinutes
      const prevTime = new Date(now.getTime() + minutesFromNowPrev * 60000)
      const currTime = new Date(now.getTime() + minutesFromNowCurr * 60000)

      const prevPV = propagate(satrec, prevTime)
      const currPV = propagate(satrec, currTime)

      if (
        prevPV && typeof prevPV.position !== 'boolean' &&
        currPV && typeof currPV.position !== 'boolean'
      ) {
        const prevGeo = eciToGeodetic(prevPV.position, gstime(prevTime))
        const currGeo = eciToGeodetic(currPV.position, gstime(currTime))
        const prevLng = degreesLong(prevGeo.longitude)
        const currLng = degreesLong(currGeo.longitude)

        if (Math.abs(currLng - prevLng) > 180) {
          // Antimeridian crossing — start a new segment.
          if (currentSegment.length >= 2) segments.push(currentSegment)
          currentSegment = []
        }
      }

      currentSegment.push(orbitPositions[i])
    }
    if (currentSegment.length >= 2) segments.push(currentSegment)

    // Draw orbit path.
    const orbitCollection = new PolylineCollection()
    for (const seg of segments) {
      orbitCollection.add({
        positions: seg,
        width: 1.5,
        material: Material.fromType('Color', { color: ORBIT_COLOR }),
      })
    }
    viewer.scene.primitives.add(orbitCollection)
    orbitCollectionRef.current = orbitCollection

    // Draw nadir line from satellite to ground.
    const altMeters = (sat.altitude || 0) * 1000
    const nadirCollection = new PolylineCollection()
    nadirCollection.add({
      positions: [
        Cartesian3.fromDegrees(sat.lng, sat.lat, altMeters),
        Cartesian3.fromDegrees(sat.lng, sat.lat, 0),
      ],
      width: 1.0,
      material: Material.fromType('Color', { color: NADIR_COLOR }),
    })
    viewer.scene.primitives.add(nadirCollection)
    nadirCollectionRef.current = nadirCollection

    // No cleanup return needed — next effect run handles removal.
  }, [rawViewer, selected, satellites])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (!rawViewer) return
      const viewer = rawViewer as CesiumViewer
      if (orbitCollectionRef.current) {
        viewer.scene.primitives.remove(orbitCollectionRef.current)
      }
      if (nadirCollectionRef.current) {
        viewer.scene.primitives.remove(nadirCollectionRef.current)
      }
    }
  }, [rawViewer])

  return null
}
