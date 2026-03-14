import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { Flight } from '../types/flight'
import { useFlightStore } from '../stores/flightStore'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-4 h-4 shrink-0 fill-current'

registerLayer({
  key: 'flights',
  label: 'Flights',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  ),
  store: useFlightStore as any,
  toModelEntity: (entity: Entity) => {
    const f = entity as Flight
    return {
      id: f.id,
      lon: f.lng,
      lat: f.lat,
      alt: f.onGround ? 0 : (f.altitude || 0),
      heading: f.heading || 0,
    }
  },
  iconUrl: '/models/aircraft.png',
  fallbackColor: Color.CYAN,
  fallbackPixelSize: 3,
  iconScale: 0.5,
})
