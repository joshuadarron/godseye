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
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

const SENSOR_HALF_ANGLE_DEG = 25
const CONE_COLOR = Color.CYAN.withAlpha(0.08)
const FOOTPRINT_COLOR = Color.CYAN.withAlpha(0.15)

export default function SatelliteFootprintOverlay() {
  const { viewer: rawViewer } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)
  const satellites = useSatelliteStore((s) => s.entities)

  const conePrimitiveRef = useRef<Primitive | null>(null)
  const footprintPrimitiveRef = useRef<GroundPrimitive | null>(null)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Clean up previous primitives.
    if (conePrimitiveRef.current) {
      viewer.scene.primitives.remove(conePrimitiveRef.current)
      conePrimitiveRef.current = null
    }
    if (footprintPrimitiveRef.current) {
      viewer.scene.primitives.remove(footprintPrimitiveRef.current)
      footprintPrimitiveRef.current = null
    }

    if (!selected || selected.layer !== 'satellites') return

    const sat = satellites.get(selected.entityId)
    if (!sat) return

    const altMeters = (sat.altitude || 0) * 1000
    if (altMeters <= 0) return

    const footprintRadius = altMeters * Math.tan(CesiumMath.toRadians(SENSOR_HALF_ANGLE_DEG))
    const groundPos = Cartesian3.fromDegrees(sat.lng, sat.lat, 0)

    // Cone: CylinderGeometry with topRadius=0 positioned at altitude midpoint.
    const midAlt = altMeters / 2
    const midPos = Cartesian3.fromDegrees(sat.lng, sat.lat, midAlt)

    // Build a model matrix that places the cylinder at midPos oriented along local up.
    const enuTransform = Transforms.eastNorthUpToFixedFrame(midPos)
    // CylinderGeometry is oriented along the Z axis by default, which aligns with
    // the "up" axis of the ENU frame — exactly what we need.
    const modelMatrix = enuTransform

    const coneGeometry = new CylinderGeometry({
      length: altMeters,
      topRadius: 0.0,
      bottomRadius: footprintRadius,
      slices: 64,
    })

    const coneInstance = new GeometryInstance({
      geometry: coneGeometry,
      modelMatrix,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(CONE_COLOR),
      },
    })

    const conePrimitive = new Primitive({
      geometryInstances: [coneInstance],
      appearance: new PerInstanceColorAppearance({
        closed: false,
        translucent: true,
        flat: true,
      }),
      asynchronous: false,
    })

    viewer.scene.primitives.add(conePrimitive)
    conePrimitiveRef.current = conePrimitive

    // Ground footprint ellipse.
    const footprintGeometry = new EllipseGeometry({
      center: groundPos,
      semiMajorAxis: footprintRadius,
      semiMinorAxis: footprintRadius,
      height: 0,
    })

    const footprintInstance = new GeometryInstance({
      geometry: footprintGeometry,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(FOOTPRINT_COLOR),
      },
    })

    const footprintPrimitive = new GroundPrimitive({
      geometryInstances: [footprintInstance],
      appearance: new PerInstanceColorAppearance({
        translucent: true,
        flat: true,
      }),
      asynchronous: false,
    })

    viewer.scene.primitives.add(footprintPrimitive)
    footprintPrimitiveRef.current = footprintPrimitive

  }, [rawViewer, selected, satellites])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
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
