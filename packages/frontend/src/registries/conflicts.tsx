import { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { ArmedConflict } from '../types/conflict'
import { useConflictStore } from '../stores/conflictStore'
import { CONFLICT_SUBTYPES, classifyConflict } from '../stores/layerVisibilityStore'
import ConflictDetailPanel from '../components/HUD/ConflictDetailPanel'
import ConflictTooltip from '../components/HUD/ConflictTooltip'
import { registerLayer } from './layerRegistry'

const ICON_CLASS = 'w-7 h-7 shrink-0 fill-current'

registerLayer({
  key: 'conflicts',
  label: 'Conflicts',
  icon: (
    <svg className={ICON_CLASS} viewBox="0 0 24 24">
      <path
        d="M12 2L2 12l4 4 6-6 6 6 4-4L12 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="14" x2="12" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="21" r="1" fill="currentColor" />
    </svg>
  ),
  store: useConflictStore,
  toModelEntity: (entity: Entity) => {
    const c = entity as ArmedConflict
    return {
      id: c.id,
      lon: c.lng,
      lat: c.lat,
      alt: 0,
      heading: 0,
    }
  },
  iconUrl: '/models/conflict-battles.svg',
  fallbackColor: Color.fromCssColorString('#d32f2f'),
  fallbackPixelSize: 6,
  iconScale: 0.35,
  headingOffset: 0,
  disableRotation: true,
  subtypes: CONFLICT_SUBTYPES,
  subtypeIcons: {
    battles: '/models/conflict-battles.svg',
    violence_civilians: '/models/conflict-violence-civilians.svg',
    explosions: '/models/conflict-explosions.svg',
    protests: '/models/conflict-protests.svg',
    riots: '/models/conflict-riots.svg',
    strategic: '/models/conflict-strategic.svg',
  },
  subtypeColors: {
    battles: Color.fromCssColorString('#d32f2f'),
    violence_civilians: Color.fromCssColorString('#e91e63'),
    explosions: Color.fromCssColorString('#ff5722'),
    protests: Color.fromCssColorString('#2196f3'),
    riots: Color.fromCssColorString('#ff9800'),
    strategic: Color.fromCssColorString('#9c27b0'),
  },
  classifySubtype: (entity: Entity) => classifyConflict((entity as ArmedConflict).eventType),
  detailPanel: ConflictDetailPanel,
  tooltip: ConflictTooltip,
})
