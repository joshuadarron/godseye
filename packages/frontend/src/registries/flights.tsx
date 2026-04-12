import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { Flight } from '../types/flight'
import { useFlightStore } from '../stores/flightStore'
import { FLIGHT_SUBTYPES, classifyFlight } from '../stores/layerVisibilityStore'
import FlightDetailPanel from '../components/HUD/FlightDetailPanel'
import FlightTooltip from '../components/HUD/FlightTooltip'
import FlightTrajectoryOverlay from '../components/Globe/FlightTrajectoryOverlay'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

registerLayer({
  key: 'flights',
  label: 'Flights',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  ),
  store: useFlightStore,
  toModelEntity: (entity: Entity) => {
    const f = entity as Flight
    return {
      id: f.id,
      lon: f.lng,
      lat: f.lat,
      alt: f.onGround ? 0 : f.altitude || 0,
      heading: f.heading || 0,
    }
  },
  iconUrl: '/models/flight-airliner.svg',
  fallbackColor: Color.CYAN,
  fallbackPixelSize: 3,
  iconScale: 0.2,
  headingOffset: 0,
  subtypes: FLIGHT_SUBTYPES,
  subtypeIcons: {
    cessna: '/models/flight-cessna.svg',
    twin_small: '/models/flight-twin_small.svg',
    twin_large: '/models/flight-twin_large.svg',
    jet_nonswept: '/models/flight-jet_nonswept.svg',
    jet_swept: '/models/flight-jet_swept.svg',
    airliner: '/models/flight-airliner.svg',
    heavy_2e: '/models/flight-heavy_2e.svg',
    heavy_4e: '/models/flight-heavy_4e.svg',
    helicopter: '/models/flight-helicopter.svg',
    hi_perf: '/models/flight-hi_perf.svg',
    balloon: '/models/flight-balloon.svg',
    ground: '/models/flight-ground.svg',
    unknown: '/models/flight-unknown.svg',
  },
  subtypeColors: {
    cessna: Color.fromCssColorString('#e0e0e0'),
    twin_small: Color.fromCssColorString('#b0bec5'),
    twin_large: Color.fromCssColorString('#90a4ae'),
    jet_nonswept: Color.fromCssColorString('#80cbc4'),
    jet_swept: Color.fromCssColorString('#4db6ac'),
    airliner: Color.fromCssColorString('#4fc3f7'),
    heavy_2e: Color.fromCssColorString('#7986cb'),
    heavy_4e: Color.fromCssColorString('#9575cd'),
    helicopter: Color.fromCssColorString('#fff176'),
    hi_perf: Color.fromCssColorString('#ef5350'),
    balloon: Color.fromCssColorString('#f48fb1'),
    ground: Color.fromCssColorString('#78909c'),
    unknown: Color.fromCssColorString('#757575'),
  },
  subtypeNoRotate: { balloon: true },
  classifySubtype: (entity: Entity) => {
    const f = entity as Flight
    return classifyFlight(f.id, f.category, f.onGround)
  },
  detailPanel: FlightDetailPanel,
  tooltip: FlightTooltip,
  overlays: [FlightTrajectoryOverlay],
})
