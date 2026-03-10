import { useEffect, useRef } from 'react'
import { useCesium } from 'resium'
import { Cartesian3, Color, PointPrimitiveCollection } from 'cesium'
import { useSatelliteStore } from '../../stores/satelliteStore'

export default function SatelliteLayer() {
  const { scene } = useCesium()
  const collectionRef = useRef<PointPrimitiveCollection | null>(null)

  const satellites = useSatelliteStore((s) => s.satellites)

  useEffect(() => {
    if (!scene) return

    const collection = new PointPrimitiveCollection()
    scene.primitives.add(collection)
    collectionRef.current = collection

    return () => {
      if (scene && !scene.isDestroyed()) {
        scene.primitives.remove(collection)
      }
      collectionRef.current = null
    }
  }, [scene])

  useEffect(() => {
    const collection = collectionRef.current
    if (!collection) return

    collection.removeAll()

    satellites.forEach((sat) => {
      // Altitude from go-satellite is in km; Cesium expects meters.
      const altMeters = (sat.altitude || 0) * 1000
      collection.add({
        position: Cartesian3.fromDegrees(sat.lng, sat.lat, altMeters),
        pixelSize: 2,
        color: Color.YELLOW,
      })
    })
  }, [satellites])

  return null
}
