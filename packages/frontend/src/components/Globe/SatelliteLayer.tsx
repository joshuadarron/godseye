import { useMemo } from 'react'
import { Color } from 'cesium'
import { useSatelliteStore } from '../../stores/satelliteStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'

export default function SatelliteLayer() {
  const satellites = useSatelliteStore((s) => s.satellites)

  const entities = useMemo(() => {
    const map = new Map<string, ModelEntity>()
    satellites.forEach((sat, id) => {
      // Altitude from go-satellite is in km; Cesium expects meters.
      const altMeters = (sat.altitude || 0) * 1000
      map.set(id, {
        id,
        lon: sat.lng,
        lat: sat.lat,
        alt: altMeters,
        heading: 0,
      })
    })
    return map
  }, [satellites])

  return (
    <ModelLayer
      iconUrl="/models/satellite.png"
      entities={entities}
      fallbackColor={Color.YELLOW}
      fallbackPixelSize={2}
      iconScale={0.4}
    />
  )
}
