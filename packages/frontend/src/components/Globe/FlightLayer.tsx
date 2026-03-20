import { useMemo } from 'react'
import { Color } from 'cesium'
import { useFlightStore } from '../../stores/flightStore'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'

export default function FlightLayer() {
  const visible = useLayerVisibilityStore((s) => s.layers.flights)
  const flights = useFlightStore((s) => s.entities)

  const entities = useMemo(() => {
    const map = new Map<string, ModelEntity>()
    flights.forEach((flight, id) => {
      const alt = flight.onGround ? 0 : flight.altitude || 0
      map.set(id, {
        id,
        lon: flight.lng,
        lat: flight.lat,
        alt,
        heading: flight.heading || 0,
      })
    })
    return map
  }, [flights])

  if (!visible) return null

  return (
    <ModelLayer
      iconUrl="/models/aircraft.png"
      entities={entities}
      fallbackColor={Color.CYAN}
      fallbackPixelSize={3}
      iconScale={0.5}
      layerName="flights"
    />
  )
}
