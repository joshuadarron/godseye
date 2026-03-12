import { useMemo } from 'react'
import { Color } from 'cesium'
import { useFlightStore } from '../../stores/flightStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'

export default function FlightLayer() {
  const flights = useFlightStore((s) => s.flights)

  const entities = useMemo(() => {
    const map = new Map<string, ModelEntity>()
    flights.forEach((flight, id) => {
      const alt = flight.onGround ? 0 : (flight.altitude || 0)
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

  return (
    <ModelLayer
      iconUrl="/models/aircraft.png"
      entities={entities}
      fallbackColor={Color.CYAN}
      fallbackPixelSize={3}
      iconScale={0.5}
    />
  )
}
