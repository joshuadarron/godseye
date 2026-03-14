import { useEffect, useRef } from 'react'
import {
  Cartesian2,
  Cartesian3,
  Color,
  PolylineCollection,
  Material,
  SceneTransforms,
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

// Custom animated dash material using czm_frameNumber (auto-incremented by Cesium).
const ANIMATED_DASH_TYPE = 'AnimatedDash'
const ANIMATED_DASH_SOURCE = `
uniform vec4 color;
uniform float dashLength;
uniform float speed;

czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  float t = float(czm_frameNumber) * speed;
  float pos = materialInput.st.s / dashLength - t;
  float pattern = step(0.5, fract(pos));
  material.diffuse = color.rgb;
  material.alpha = color.a * pattern;
  return material;
}
`

let materialTypeRegistered = false
function ensureMaterialType() {
  if (materialTypeRegistered) return
  materialTypeRegistered = true
  ;(Material as any)._materialCache.addMaterial(ANIMATED_DASH_TYPE, {
    fabric: {
      type: ANIMATED_DASH_TYPE,
      uniforms: {
        color: new Color(0, 1, 1, 0.6),
        dashLength: 0.006,
        speed: 0.005,
      },
      source: ANIMATED_DASH_SOURCE,
    },
    translucent: true,
  })
}

export default function SatelliteOrbitOverlay() {
  const { viewer: rawViewer } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)
  const satellites = useSatelliteStore((s) => s.entities)

  const orbitCollectionRef = useRef<PolylineCollection | null>(null)
  const nadirCollectionRef = useRef<PolylineCollection | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Clean up previous polylines and animation.
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
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
    // Store both Cartesian3 positions and lng values to avoid re-propagating for gap detection.
    const orbitPositions: Cartesian3[] = []
    const orbitLngs: number[] = []

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
      orbitLngs.push(lngDeg)
    }

    if (orbitPositions.length < 2) return

    // Split orbit polyline at large longitude jumps (antimeridian crossings)
    // to avoid lines cutting across the globe. Reuses stored lng values.
    const segments: Cartesian3[][] = []
    let currentSegment: Cartesian3[] = [orbitPositions[0]]

    for (let i = 1; i < orbitPositions.length; i++) {
      if (Math.abs(orbitLngs[i] - orbitLngs[i - 1]) > 180) {
        if (currentSegment.length >= 2) segments.push(currentSegment)
        currentSegment = []
      }
      currentSegment.push(orbitPositions[i])
    }
    if (currentSegment.length >= 2) segments.push(currentSegment)

    // Draw orbit path with animated dash material.
    ensureMaterialType()
    const orbitCollection = new PolylineCollection()
    for (const seg of segments) {
      const mat = Material.fromType(ANIMATED_DASH_TYPE, {
        color: ORBIT_COLOR,
        dashLength: 0.006,
        speed: 0.005,
      })
      orbitCollection.add({
        positions: seg,
        width: 2,
        material: mat,
      })
    }
    viewer.scene.primitives.add(orbitCollection)
    orbitCollectionRef.current = orbitCollection

    // Continuously request renders so czm_frameNumber advances the dash animation.
    const animate = () => {
      viewer.scene.requestRender()
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)

    // Draw nadir line from satellite to ground.
    const altMeters = (sat.altitude || 0) * 1000
    const nadirCollection = new PolylineCollection()
    nadirCollection.add({
      positions: [
        Cartesian3.fromDegrees(sat.lng, sat.lat, altMeters),
        Cartesian3.fromDegrees(sat.lng, sat.lat, 0),
      ],
      width: 1.0,
      material: Material.fromType('Color', { color: Color.CYAN.withAlpha(0.4) }),
    })
    viewer.scene.primitives.add(nadirCollection)
    nadirCollectionRef.current = nadirCollection

    // Compute screen-space bounding box of the orbit for modal placement.
    const setOrbitScreenBounds = useSelectedEntityStore.getState().setOrbitScreenBounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const scratchScreen = new Cartesian2()

    for (let i = 0; i < orbitPositions.length; i += 4) {
      const screenPos = SceneTransforms.worldToWindowCoordinates(
        viewer.scene, orbitPositions[i], scratchScreen,
      )
      if (!screenPos) continue
      if (screenPos.x < minX) minX = screenPos.x
      if (screenPos.x > maxX) maxX = screenPos.x
      if (screenPos.y < minY) minY = screenPos.y
      if (screenPos.y > maxY) maxY = screenPos.y
    }

    if (isFinite(minX)) {
      setOrbitScreenBounds({ minX, maxX, minY, maxY })
    }

  }, [rawViewer, selected, satellites])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
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
