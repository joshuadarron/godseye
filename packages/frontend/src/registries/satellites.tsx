import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { Satellite } from '../types/satellite'
import { useSatelliteStore } from '../stores/satelliteStore'
import { SATELLITE_SUBTYPES, classifySatellite } from '../stores/layerVisibilityStore'
import SatelliteDetailPanel from '../components/HUD/SatelliteDetailPanel'
import SatelliteTooltip from '../components/HUD/SatelliteTooltip'
import SatelliteOrbitOverlay from '../components/Globe/SatelliteOrbitOverlay'
import SatelliteFootprintOverlay from '../components/Globe/SatelliteFootprintOverlay'
import SatellitePropagationLayer from '../components/Globe/SatellitePropagationLayer'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

registerLayer({
  key: 'satellites',
  label: 'Satellites',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path
        d="M6.6 11.4 1 16l4-1-1 4 4.6-5.6M2 2l2.5 2.5M7 3l-1 2M3 7l2-1M17.4 12.6 23 8l-4 1 1-4-4.6 5.6M22 22l-2.5-2.5M17 21l1-2M21 17l-2 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  store: useSatelliteStore as any,
  toModelEntity: (entity: Entity) => {
    const s = entity as Satellite
    return {
      id: s.id,
      lon: s.lng,
      lat: s.lat,
      alt: (s.altitude || 0) * 1000,
      heading: 0,
    }
  },
  iconUrl: '/models/sat-other.svg',
  fallbackColor: Color.YELLOW,
  fallbackPixelSize: 4,
  iconScale: 0.8,
  disableRotation: true,
  subtypes: SATELLITE_SUBTYPES,
  subtypeIcons: {
    starlink: '/models/sat-starlink.svg',
    oneweb: '/models/sat-oneweb.svg',
    gps: '/models/sat-gps.svg',
    weather: '/models/sat-weather.svg',
    science: '/models/sat-science.svg',
    military: '/models/sat-military.svg',
    iridium: '/models/sat-iridium.svg',
    stations: '/models/sat-stations.svg',
    other: '/models/sat-other.svg',
  },
  subtypeColors: {
    starlink: Color.fromCssColorString('#6699ff'),
    oneweb: Color.fromCssColorString('#44aaff'),
    gps: Color.fromCssColorString('#ffaa33'),
    weather: Color.fromCssColorString('#44cc66'),
    science: Color.fromCssColorString('#aa66cc'),
    military: Color.fromCssColorString('#cc4444'),
    iridium: Color.fromCssColorString('#ccaa44'),
    stations: Color.fromCssColorString('#ffffff'),
    other: Color.YELLOW,
  },
  classifySubtype: (entity: Entity) => classifySatellite((entity as Satellite).name),
  customLayer: SatellitePropagationLayer,
  detailPanel: SatelliteDetailPanel,
  tooltip: SatelliteTooltip,
  overlays: [SatelliteOrbitOverlay, SatelliteFootprintOverlay],
})
