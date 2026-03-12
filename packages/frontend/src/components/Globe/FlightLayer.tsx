import { useEffect, useRef } from 'react'
import { useCesium } from 'resium'
import { Cartesian3, Color, PointPrimitiveCollection } from 'cesium'
import { useFlightStore } from '../../stores/flightStore'

export default function FlightLayer() {
  const { scene } = useCesium()
  const collectionRef = useRef<PointPrimitiveCollection | null>(null)

  const flights = useFlightStore((s) => s.flights)

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

    flights.forEach((flight) => {
      // Convert altitude from meters to Cesium units (meters above ellipsoid).
      const alt = flight.onGround ? 0 : (flight.altitude || 0)
      collection.add({
        position: Cartesian3.fromDegrees(flight.lng, flight.lat, alt),
        pixelSize: 3,
        color: Color.CYAN,
      })
    })
  }, [flights])

  return null
}
