import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { Earthquake } from '../types/earthquake'
import { useEarthquakeStore } from '../stores/earthquakeStore'
import { EVENT_SUBTYPES, classifyEarthquake } from '../stores/layerVisibilityStore'
import EarthquakeDetailPanel from '../components/HUD/EarthquakeDetailPanel'
import EarthquakeTooltip from '../components/HUD/EarthquakeTooltip'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

registerLayer({
  key: 'events',
  label: 'Events',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  store: useEarthquakeStore as any,
  toModelEntity: (entity: Entity) => {
    const eq = entity as Earthquake
    return {
      id: eq.id,
      lon: eq.lng,
      lat: eq.lat,
      alt: 0,
      heading: 0,
    }
  },
  iconUrl: '/models/event-minor.svg',
  fallbackColor: Color.fromCssColorString('#ffc107'),
  fallbackPixelSize: 6,
  iconScale: 0.35,
  headingOffset: 0,
  disableRotation: true,
  subtypes: EVENT_SUBTYPES,
  subtypeIcons: {
    major: '/models/event-major.svg',
    strong: '/models/event-strong.svg',
    moderate: '/models/event-moderate.svg',
    light: '/models/event-light.svg',
    minor: '/models/event-minor.svg',
  },
  subtypeColors: {
    major: Color.fromCssColorString('#d32f2f'),
    strong: Color.fromCssColorString('#f44336'),
    moderate: Color.fromCssColorString('#ff9800'),
    light: Color.fromCssColorString('#ffc107'),
    minor: Color.fromCssColorString('#8bc34a'),
  },
  classifySubtype: (entity: Entity) => classifyEarthquake((entity as Earthquake).magnitude),
  detailPanel: EarthquakeDetailPanel,
  tooltip: EarthquakeTooltip,
})
