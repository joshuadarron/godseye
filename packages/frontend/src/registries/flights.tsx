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
  iconUrl: '/models/flight-commercial.svg',
  fallbackColor: Color.CYAN,
  fallbackPixelSize: 3,
  iconScale: 0.2,
  headingOffset: 0,
  subtypes: FLIGHT_SUBTYPES,
  subtypeIcons: {
    commercial: '/models/flight-commercial.svg',
    cargo: '/models/flight-cargo.svg',
    military: '/models/flight-military.svg',
    private: '/models/flight-private.svg',
    ground: '/models/flight-ground.svg',
  },
  subtypeColors: {
    commercial: Color.fromCssColorString('#4fc3f7'),
    cargo: Color.fromCssColorString('#ffb74d'),
    military: Color.fromCssColorString('#ef5350'),
    private: Color.fromCssColorString('#e0e0e0'),
    ground: Color.fromCssColorString('#78909c'),
  },
  classifySubtype: (entity: Entity) => {
    const f = entity as Flight
    return classifyFlight(f.callsign, f.onGround)
  },
  detailPanel: FlightDetailPanel,
  tooltip: FlightTooltip,
  overlays: [FlightTrajectoryOverlay],
})
