import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { Vessel } from '../types/vessel'
import { useVesselStore } from '../stores/vesselStore'
import { VESSEL_SUBTYPES, classifyVessel } from '../stores/layerVisibilityStore'
import VesselDetailPanel from '../components/HUD/VesselDetailPanel'
import VesselTooltip from '../components/HUD/VesselTooltip'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

registerLayer({
  key: 'vessels',
  label: 'Vessels',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path d="M3 17l2 4h14l2-4H3zM12 3v10M8 7h8l2 6H6l2-6z"
        fill="none" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  store: useVesselStore as any,
  toModelEntity: (entity: Entity) => {
    const v = entity as Vessel
    return {
      id: v.id,
      lon: v.lng,
      lat: v.lat,
      alt: 0,
      heading: v.heading || v.course || 0,
    }
  },
  iconUrl: '/models/vessel-other.svg',
  fallbackColor: Color.fromCssColorString('#26a69a'),
  fallbackPixelSize: 3,
  iconScale: 0.2,
  headingOffset: 0,
  subtypes: VESSEL_SUBTYPES,
  subtypeIcons: {
    cargo: '/models/vessel-cargo.svg',
    tanker: '/models/vessel-tanker.svg',
    passenger: '/models/vessel-passenger.svg',
    fishing: '/models/vessel-fishing.svg',
    military: '/models/vessel-military.svg',
    tug: '/models/vessel-tug.svg',
    pleasure: '/models/vessel-pleasure.svg',
    other: '/models/vessel-other.svg',
  },
  subtypeColors: {
    cargo: Color.fromCssColorString('#ffb74d'),
    tanker: Color.fromCssColorString('#90a4ae'),
    passenger: Color.fromCssColorString('#4fc3f7'),
    fishing: Color.fromCssColorString('#8d6e63'),
    military: Color.fromCssColorString('#ef5350'),
    tug: Color.fromCssColorString('#78909c'),
    pleasure: Color.fromCssColorString('#e0e0e0'),
    other: Color.fromCssColorString('#26a69a'),
  },
  classifySubtype: (entity: Entity) => classifyVessel((entity as Vessel).shipType),
  detailPanel: VesselDetailPanel,
  tooltip: VesselTooltip,
})
