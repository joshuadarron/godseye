import { useMemo } from 'react'
import { Color } from 'cesium'
import { useSatelliteStore } from '../../stores/satelliteStore'
import { useLayerVisibilityStore, classifySatellite } from '../../stores/layerVisibilityStore'
import ModelLayer, { type ModelEntity } from './ModelLayer'

const SUBTYPE_ICONS: Record<string, string> = {
  starlink: '/models/sat-starlink.svg',
  oneweb: '/models/sat-oneweb.svg',
  gps: '/models/sat-gps.svg',
  weather: '/models/sat-weather.svg',
  science: '/models/sat-science.svg',
  military: '/models/sat-military.svg',
  iridium: '/models/sat-iridium.svg',
  stations: '/models/sat-stations.svg',
  other: '/models/sat-other.svg',
}

const SUBTYPE_COLORS: Record<string, Color> = {
  starlink: Color.fromCssColorString('#6699ff'),
  oneweb: Color.fromCssColorString('#44aaff'),
  gps: Color.fromCssColorString('#ffaa33'),
  weather: Color.fromCssColorString('#44cc66'),
  science: Color.fromCssColorString('#aa66cc'),
  military: Color.fromCssColorString('#cc4444'),
  iridium: Color.fromCssColorString('#ccaa44'),
  stations: Color.fromCssColorString('#ffffff'),
  other: Color.YELLOW,
}

export default function SatelliteLayer() {
  const visible = useLayerVisibilityStore((s) => s.layers.satellites)
  const sublayers = useLayerVisibilityStore((s) => s.sublayers.satellites)
  const satellites = useSatelliteStore((s) => s.satellites)

  // Group satellites by subtype.
  const grouped = useMemo(() => {
    const groups = new Map<string, Map<string, ModelEntity>>()

    satellites.forEach((sat, id) => {
      const subtype = classifySatellite(sat.name)
      if (sublayers && !sublayers[subtype]) return

      const altMeters = (sat.altitude || 0) * 1000
      if (!groups.has(subtype)) groups.set(subtype, new Map())
      groups.get(subtype)!.set(id, {
        id,
        lon: sat.lng,
        lat: sat.lat,
        alt: altMeters,
        heading: 0,
      })
    })

    return groups
  }, [satellites, sublayers])

  if (!visible) return null

  return (
    <>
      {Array.from(grouped.entries()).map(([subtype, entities]) => (
        <ModelLayer
          key={subtype}
          iconUrl={SUBTYPE_ICONS[subtype] ?? SUBTYPE_ICONS.other}
          entities={entities}
          fallbackColor={SUBTYPE_COLORS[subtype] ?? Color.YELLOW}
          fallbackPixelSize={4}
          iconScale={0.8}
          layerName="satellites"
          disableRotation
        />
      ))}
    </>
  )
}
