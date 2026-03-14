import { useEffect, useRef, useState } from 'react'
import { useCesium } from 'resium'
import {
  BillboardCollection,
  Cartesian3,
  Color,
  Math as CesiumMath,
  NearFarScalar,
  PointPrimitiveCollection,
  VerticalOrigin,
  type Billboard,
  type PointPrimitive,
} from 'cesium'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'

export interface ModelEntity {
  id: string
  lon: number
  lat: number
  alt: number
  heading: number
}

interface ModelLayerProps {
  /** Path to a PNG/SVG icon in public/ (e.g. '/models/aircraft.png') */
  iconUrl: string
  entities: Map<string, ModelEntity>
  fallbackColor: Color
  fallbackPixelSize?: number
  iconScale?: number
  /** Heading offset in degrees to align icon's forward direction with heading=0 (north). */
  headingOffset?: number
  /** Identifier for this layer, used by pick handlers to trace billboards back to data. */
  layerName?: string
  /** When true, billboards always face the camera instead of rotating around the Z-axis.
   *  Use for entities at high latitudes (e.g. polar-orbit satellites) to avoid visual artifacts. */
  disableRotation?: boolean
}

// Shared scratch objects to avoid allocations in the hot loop.
const scratchPosition = new Cartesian3()

/**
 * Renders entities as rotated billboards from a single BillboardCollection.
 * BillboardCollection is GPU-instanced and scales to 100k+ entities.
 * Falls back to PointPrimitiveCollection if the icon fails to load.
 *
 * Uses incremental diffing: instead of removeAll() + re-add every frame,
 * maintains a Map of entity ID → primitive and only adds/removes/updates
 * what changed.
 */
export default function ModelLayer({
  iconUrl,
  entities,
  fallbackColor,
  fallbackPixelSize = 3,
  iconScale = 1,
  headingOffset = 0,
  layerName,
  disableRotation = false,
}: ModelLayerProps) {
  const { scene } = useCesium()
  const selected = useSelectedEntityStore((s) => s.selected)
  const selectedId = selected && selected.layer === layerName ? selected.entityId : null
  const billboardRef = useRef<BillboardCollection | null>(null)
  const fallbackRef = useRef<PointPrimitiveCollection | null>(null)
  const [iconAvailable, setIconAvailable] = useState<boolean | null>(null)

  // Track entity ID → Cesium primitive for incremental updates.
  const billboardMapRef = useRef<Map<string, Billboard>>(new Map())
  const pointMapRef = useRef<Map<string, PointPrimitive>>(new Map())
  const prevSelectedRef = useRef<string | null>(null)

  // Set up both collections once
  useEffect(() => {
    if (!scene) return

    const billboards = new BillboardCollection({ scene })
    const points = new PointPrimitiveCollection()
    scene.primitives.add(billboards)
    scene.primitives.add(points)
    billboardRef.current = billboards
    fallbackRef.current = points

    // Test icon availability — uses state so the diff effect re-runs once resolved.
    const img = new Image()
    img.onload = () => setIconAvailable(true)
    img.onerror = () => setIconAvailable(false)
    img.src = iconUrl

    return () => {
      if (scene && !scene.isDestroyed()) {
        scene.primitives.remove(billboards)
        scene.primitives.remove(points)
      }
      billboardRef.current = null
      fallbackRef.current = null
      setIconAvailable(null)
      billboardMapRef.current.clear()
      pointMapRef.current.clear()
    }
  }, [scene, iconUrl])

  // Incremental entity diff
  useEffect(() => {
    const billboards = billboardRef.current
    const points = fallbackRef.current
    if (!billboards || !points || !scene) return

    // Wait until we know whether the icon loaded or failed.
    if (iconAvailable === null) return

    const useIcon = iconAvailable === true

    if (useIcon) {
      const bMap = billboardMapRef.current

      // Remove stale entities.
      for (const [id, bb] of bMap) {
        if (!entities.has(id)) {
          billboards.remove(bb)
          bMap.delete(id)
        }
      }

      // Add new / update existing.
      entities.forEach((entity, id) => {
        const isSelected = id === selectedId
        const existing = bMap.get(id)

        if (existing) {
          // Update position in-place.
          Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt, undefined, scratchPosition)
          existing.position = scratchPosition
          existing.rotation = disableRotation ? 0 : -CesiumMath.toRadians((entity.heading || 0) + headingOffset)
          // Only update selection styling if selection state changed for this entity.
          if (id === selectedId || id === prevSelectedRef.current) {
            existing.scale = isSelected ? iconScale * 2 : iconScale
            existing.color = isSelected ? Color.CYAN : Color.WHITE
          }
        } else {
          const bb = billboards.add({
            position: Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt),
            image: iconUrl,
            scale: isSelected ? iconScale * 2 : iconScale,
            scaleByDistance: new NearFarScalar(500_000, 3.0, 20_000_000, 0.3),
            color: isSelected ? Color.CYAN : Color.WHITE,
            rotation: disableRotation ? 0 : -CesiumMath.toRadians((entity.heading || 0) + headingOffset),
            verticalOrigin: VerticalOrigin.CENTER,
            alignedAxis: disableRotation ? Cartesian3.ZERO : Cartesian3.UNIT_Z,
            id: layerName ? { layer: layerName, entityId: entity.id } : undefined,
          })
          bMap.set(id, bb)
        }
      })
    } else {
      const pMap = pointMapRef.current

      // Remove stale entities.
      for (const [id, pt] of pMap) {
        if (!entities.has(id)) {
          points.remove(pt)
          pMap.delete(id)
        }
      }

      // Add new / update existing.
      entities.forEach((entity, id) => {
        const isSelected = id === selectedId
        const existing = pMap.get(id)

        if (existing) {
          Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt, undefined, scratchPosition)
          existing.position = scratchPosition
          if (id === selectedId || id === prevSelectedRef.current) {
            existing.pixelSize = isSelected ? fallbackPixelSize * 3 : fallbackPixelSize
            existing.color = isSelected ? Color.CYAN : fallbackColor
            existing.outlineColor = isSelected ? Color.WHITE : Color.TRANSPARENT
            existing.outlineWidth = isSelected ? 2 : 0
          }
        } else {
          const pt = points.add({
            position: Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt),
            pixelSize: isSelected ? fallbackPixelSize * 3 : fallbackPixelSize,
            scaleByDistance: new NearFarScalar(500_000, 3.0, 20_000_000, 0.3),
            color: isSelected ? Color.CYAN : fallbackColor,
            outlineColor: isSelected ? Color.WHITE : Color.TRANSPARENT,
            outlineWidth: isSelected ? 2 : 0,
            id: layerName ? { layer: layerName, entityId: entity.id } : undefined,
          })
          pMap.set(id, pt)
        }
      })
    }

    prevSelectedRef.current = selectedId
  }, [entities, scene, iconUrl, iconScale, headingOffset, fallbackColor, fallbackPixelSize, selectedId, disableRotation, layerName, iconAvailable])

  return null
}
