import { useMemo } from 'react'
import { Color } from 'cesium'
import { useSatelliteStore } from '../../stores/satelliteStore'
import { useLayerVisibilityStore, classifySatellite } from '../../stores/layerVisibilityStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'

export default function SatelliteLayer() {
  const visible = useLayerVisibilityStore((s) => s.layers.satellites)
  const sublayers = useLayerVisibilityStore((s) => s.sublayers.satellites)
  const satellites = useSatelliteStore((s) => s.satellites)

  const entities = useMemo(() => {
    const map = new Map<string, ModelEntity>()
    satellites.forEach((sat, id) => {
      // Filter by sublayer visibility.
      const subtype = classifySatellite(sat.name)
      if (sublayers && !sublayers[subtype]) return

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
  }, [satellites, sublayers])

  if (!visible) return null

  return (
    <ModelLayer
      iconUrl="/models/satellite.svg"
      entities={entities}
      fallbackColor={Color.YELLOW}
      fallbackPixelSize={2}
      iconScale={0.4}
      layerName="satellites"
    />
  )
}
