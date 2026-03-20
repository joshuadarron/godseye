import { useEffect, useRef } from 'react'
import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  EllipseGeometry,
  GeometryInstance,
  GroundPrimitive,
  Math as CesiumMath,
  Transforms,
  Primitive,
  CylinderGeometry,
  PerInstanceColorAppearance,
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
import type { Satellite } from '../../types/satellite'

const SENSOR_HALF_ANGLE_DEG = 25
const CONE_COLOR = Color.CYAN.withAlpha(0.08)
const FOOTPRINT_COLOR = Color.CYAN.withAlpha(0.15)
const PROPAGATION_INTERVAL_MS = 100

export default function SatelliteFootprintOverlay() {
  const { viewer: rawViewer } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)

  const conePrimitiveRef = useRef<Primitive | null>(null)
  const footprintPrimitiveRef = useRef<GroundPrimitive | null>(null)
  const intervalRef = useRef<number>(0)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Clean up previous primitives and interval.
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = 0
    }
    if (conePrimitiveRef.current) {
      viewer.scene.primitives.remove(conePrimitiveRef.current)
      conePrimitiveRef.current = null
    }
    if (footprintPrimitiveRef.current) {
      viewer.scene.primitives.remove(footprintPrimitiveRef.current)
      footprintPrimitiveRef.current = null
    }

    if (!selected || selected.layer !== 'satellites') return

    // Read TLE data imperatively — we only need it once per selection, not on every store update.
    const sat = useSatelliteStore.getState().entities.get(selected.entityId) as
      | Satellite
      | undefined
    if (!sat?.tle1 || !sat?.tle2) return

    const altMeters = (sat.altitude || 0) * 1000
    if (altMeters <= 0) return

    const satrec = twoline2satrec(sat.tle1, sat.tle2)

    /** Build cone + footprint primitives for a given position. */
    function buildPrimitives(lng: number, lat: number, alt: number) {
      const footprintRadius = alt * Math.tan(CesiumMath.toRadians(SENSOR_HALF_ANGLE_DEG))
      const groundPos = Cartesian3.fromDegrees(lng, lat, 0)
      const midPos = Cartesian3.fromDegrees(lng, lat, alt / 2)

      const cone = new Primitive({
        geometryInstances: [
          new GeometryInstance({
            geometry: new CylinderGeometry({
              length: alt,
              topRadius: 0.0,
              bottomRadius: footprintRadius,
              slices: 64,
            }),
            modelMatrix: Transforms.eastNorthUpToFixedFrame(midPos),
            attributes: {
              color: ColorGeometryInstanceAttribute.fromColor(CONE_COLOR),
            },
          }),
        ],
        appearance: new PerInstanceColorAppearance({
          closed: false,
          translucent: true,
          flat: true,
        }),
        asynchronous: false,
      })

      const footprint = new GroundPrimitive({
        geometryInstances: [
          new GeometryInstance({
            geometry: new EllipseGeometry({
              center: groundPos,
              semiMajorAxis: footprintRadius,
              semiMinorAxis: footprintRadius,
              height: 0,
            }),
            attributes: {
              color: ColorGeometryInstanceAttribute.fromColor(FOOTPRINT_COLOR),
            },
          }),
        ],
        appearance: new PerInstanceColorAppearance({
          translucent: true,
          flat: true,
        }),
        asynchronous: false,
      })

      return { cone, footprint }
    }

    // Initial render.
    const initial = buildPrimitives(sat.lng, sat.lat, altMeters)
    viewer.scene.primitives.add(initial.cone)
    viewer.scene.primitives.add(initial.footprint)
    conePrimitiveRef.current = initial.cone
    footprintPrimitiveRef.current = initial.footprint

    // Propagation loop: update cone + footprint position at 100ms intervals.
    intervalRef.current = window.setInterval(() => {
      if (viewer.isDestroyed()) return

      const now = new Date()
      const posVel = propagate(satrec, now)
      if (!posVel || typeof posVel.position === 'boolean') return

      const gst = gstime(now)
      const geo = eciToGeodetic(posVel.position, gst)
      const lat = degreesLat(geo.latitude)
      const lng = degreesLong(geo.longitude)
      const alt = geo.height * 1000

      if (isNaN(lat) || isNaN(lng) || isNaN(alt) || alt <= 0) return

      // Remove old primitives.
      if (conePrimitiveRef.current) {
        viewer.scene.primitives.remove(conePrimitiveRef.current)
      }
      if (footprintPrimitiveRef.current) {
        viewer.scene.primitives.remove(footprintPrimitiveRef.current)
      }

      // Recreate at new position.
      const updated = buildPrimitives(lng, lat, alt)
      viewer.scene.primitives.add(updated.cone)
      viewer.scene.primitives.add(updated.footprint)
      conePrimitiveRef.current = updated.cone
      footprintPrimitiveRef.current = updated.footprint
    }, PROPAGATION_INTERVAL_MS)
  }, [rawViewer, selected])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (!rawViewer) return
      const viewer = rawViewer as CesiumViewer
      if (conePrimitiveRef.current) {
        viewer.scene.primitives.remove(conePrimitiveRef.current)
      }
      if (footprintPrimitiveRef.current) {
        viewer.scene.primitives.remove(footprintPrimitiveRef.current)
      }
    }
  }, [rawViewer])

  return null
}
