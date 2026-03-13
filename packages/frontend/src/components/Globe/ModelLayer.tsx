import { useEffect, useRef } from 'react'
import { useCesium } from 'resium'
import {
  BillboardCollection,
  Cartesian3,
  Color,
  Math as CesiumMath,
  NearFarScalar,
  PointPrimitiveCollection,
  VerticalOrigin,
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

/**
 * Renders entities as rotated billboards from a single BillboardCollection.
 * BillboardCollection is GPU-instanced and scales to 100k+ entities.
 * Falls back to PointPrimitiveCollection if the icon fails to load.
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
  const iconAvailableRef = useRef<boolean | null>(null)

  // Set up both collections once
  useEffect(() => {
    if (!scene) return

    const billboards = new BillboardCollection({ scene })
    const points = new PointPrimitiveCollection()
    scene.primitives.add(billboards)
    scene.primitives.add(points)
    billboardRef.current = billboards
    fallbackRef.current = points

    // Test icon availability
    const img = new Image()
    img.onload = () => {
      iconAvailableRef.current = true
    }
    img.onerror = () => {
      iconAvailableRef.current = false
    }
    img.src = iconUrl

    return () => {
      if (scene && !scene.isDestroyed()) {
        scene.primitives.remove(billboards)
        scene.primitives.remove(points)
      }
      billboardRef.current = null
      fallbackRef.current = null
      iconAvailableRef.current = null
    }
  }, [scene, iconUrl])

  // Render entities
  useEffect(() => {
    const billboards = billboardRef.current
    const points = fallbackRef.current
    if (!billboards || !points || !scene) return

    // If icon hasn't been tested yet, default to fallback
    const useIcon = iconAvailableRef.current === true

    billboards.removeAll()
    points.removeAll()

    if (useIcon) {
      entities.forEach((entity) => {
        const isSelected = entity.id === selectedId
        billboards.add({
          position: Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt),
          image: iconUrl,
          scale: isSelected ? iconScale * 2 : iconScale,
          scaleByDistance: new NearFarScalar(1_000, 2.0, 10_000_000, 0.2),
          color: isSelected ? Color.CYAN : Color.WHITE,
          rotation: disableRotation ? 0 : -CesiumMath.toRadians((entity.heading || 0) + headingOffset),
          verticalOrigin: VerticalOrigin.CENTER,
          alignedAxis: disableRotation ? Cartesian3.ZERO : Cartesian3.UNIT_Z,
          id: layerName ? { layer: layerName, entityId: entity.id } : undefined,
        })
      })
    } else {
      entities.forEach((entity) => {
        const isSelected = entity.id === selectedId
        points.add({
          position: Cartesian3.fromDegrees(entity.lon, entity.lat, entity.alt),
          pixelSize: isSelected ? fallbackPixelSize * 3 : fallbackPixelSize,
          scaleByDistance: new NearFarScalar(1_000, 2.0, 10_000_000, 0.2),
          color: isSelected ? Color.CYAN : fallbackColor,
          outlineColor: isSelected ? Color.WHITE : Color.TRANSPARENT,
          outlineWidth: isSelected ? 2 : 0,
          id: layerName ? { layer: layerName, entityId: entity.id } : undefined,
        })
      })
    }
  }, [entities, scene, iconUrl, iconScale, headingOffset, fallbackColor, fallbackPixelSize, selectedId, disableRotation])

  return null
}
