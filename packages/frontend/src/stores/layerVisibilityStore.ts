import { create } from 'zustand'
import { classifyAircraftIcon } from '../utils/aircraftClassifier'

export interface SublayerMap {
  [sublayer: string]: boolean
}

interface LayerVisibilityState {
  layers: Record<string, boolean>
  sublayers: Record<string, SublayerMap>
  toggle: (layer: string) => void
  toggleSublayer: (layer: string, sublayer: string) => void
  /** Toggle all sublayers on/off for a given layer (used by "select all"). */
  setAllSublayers: (layer: string, enabled: boolean) => void
  isSublayerVisible: (layer: string, sublayer: string) => boolean
}

export const FLIGHT_SUBTYPES: Record<string, string> = {
  cessna: 'Single Engine',
  twin_small: 'Twin Prop',
  twin_large: 'Twin Turboprop',
  jet_nonswept: 'Light Jet',
  jet_swept: 'Mid Jet',
  airliner: 'Airliner',
  heavy_2e: 'Heavy Twin',
  heavy_4e: 'Heavy Quad',
  helicopter: 'Helicopter',
  hi_perf: 'Military',
  balloon: 'Balloon',
  ground: 'Ground',
  unknown: 'Unknown',
}

export const VESSEL_SUBTYPES: Record<string, string> = {
  cargo: 'Cargo',
  tanker: 'Tanker',
  passenger: 'Passenger',
  fishing: 'Fishing',
  military: 'Military',
  tug: 'Tug',
  pleasure: 'Pleasure',
  other: 'Other',
}

export const SATELLITE_SUBTYPES: Record<string, string> = {
  starlink: 'Starlink',
  oneweb: 'OneWeb',
  gps: 'GPS / GNSS',
  weather: 'Weather',
  science: 'Science / Research',
  military: 'Military',
  iridium: 'Iridium',
  stations: 'Space Stations',
  other: 'Other',
}

export const EVENT_SUBTYPES: Record<string, string> = {
  major: 'Major (7+)',
  strong: 'Strong (5-6.9)',
  moderate: 'Moderate (4-4.9)',
  light: 'Light (3-3.9)',
  minor: 'Minor (<3)',
}

export const CONFLICT_SUBTYPES: Record<string, string> = {
  battles: 'Battles',
  violence_civilians: 'Violence against civilians',
  explosions: 'Explosions/Remote violence',
  protests: 'Protests',
  riots: 'Riots',
  strategic: 'Strategic developments',
}

const defaultSublayers: Record<string, SublayerMap> = {
  flights: Object.fromEntries(Object.keys(FLIGHT_SUBTYPES).map((k) => [k, true])),
  satellites: Object.fromEntries(Object.keys(SATELLITE_SUBTYPES).map((k) => [k, true])),
  vessels: Object.fromEntries(Object.keys(VESSEL_SUBTYPES).map((k) => [k, true])),
  events: Object.fromEntries(Object.keys(EVENT_SUBTYPES).map((k) => [k, true])),
  conflicts: Object.fromEntries(Object.keys(CONFLICT_SUBTYPES).map((k) => [k, true])),
}

export const useLayerVisibilityStore = create<LayerVisibilityState>((set, get) => ({
  layers: {
    flights: false,
    satellites: false,
    vessels: false,
    trains: false,
    events: false,
    conflicts: false,
  },
  sublayers: defaultSublayers,

  toggle: (layer) =>
    set((state) => {
      const nowOn = !state.layers[layer]
      const sublayers = { ...state.sublayers }
      if (nowOn && sublayers[layer]) {
        sublayers[layer] = Object.fromEntries(Object.keys(sublayers[layer]).map((k) => [k, true]))
      }
      return { layers: { ...state.layers, [layer]: nowOn }, sublayers }
    }),

  toggleSublayer: (layer, sublayer) =>
    set((state) => {
      const current = state.sublayers[layer] ?? {}
      const updated = { ...current, [sublayer]: !(current[sublayer] ?? true) }
      return { sublayers: { ...state.sublayers, [layer]: updated } }
    }),

  setAllSublayers: (layer, enabled) =>
    set((state) => {
      const current = state.sublayers[layer] ?? {}
      const updated = Object.fromEntries(Object.keys(current).map((k) => [k, enabled]))
      return { sublayers: { ...state.sublayers, [layer]: updated } }
    }),

  isSublayerVisible: (layer, sublayer) => {
    const state = get()
    if (!state.layers[layer]) return false
    return state.sublayers[layer]?.[sublayer] ?? true
  },
}))

/** Classify a flight into an icon subtype using aircraft-type-based classification. */
export function classifyFlight(id: string, category: number, onGround: boolean): string {
  // Ground override: if on ground and not a ground-vehicle category, show as ground
  if (onGround && category !== 14 && category !== 16 && category !== 17) {
    return 'ground'
  }
  return classifyAircraftIcon(id, category)
}

/** Classify a vessel into a subtype key based on AIS ship type code. */
export function classifyVessel(shipType: number): string {
  if (shipType >= 70 && shipType <= 79) return 'cargo'
  if (shipType >= 80 && shipType <= 89) return 'tanker'
  if (shipType >= 60 && shipType <= 69) return 'passenger'
  if (shipType === 30) return 'fishing'
  if (shipType === 35) return 'military'
  if (shipType === 31 || shipType === 32) return 'tug'
  if (shipType >= 36 && shipType <= 37) return 'pleasure'
  return 'other'
}

/** Classify an earthquake into a subtype key based on magnitude. */
export function classifyEarthquake(magnitude: number): string {
  if (magnitude >= 7) return 'major'
  if (magnitude >= 5) return 'strong'
  if (magnitude >= 4) return 'moderate'
  if (magnitude >= 3) return 'light'
  return 'minor'
}

/** Classify a conflict into a subtype key based on ACLED event type. */
export function classifyConflict(eventType: string): string {
  const lower = eventType.toLowerCase()
  if (lower.includes('battles')) return 'battles'
  if (lower.includes('violence against civilians')) return 'violence_civilians'
  if (lower.includes('explosion') || lower.includes('remote violence')) return 'explosions'
  if (lower.includes('protest')) return 'protests'
  if (lower.includes('riot')) return 'riots'
  if (lower.includes('strategic')) return 'strategic'
  return 'battles'
}

/** Classify a satellite name into a subtype key. */
export function classifySatellite(name: string): string {
  const upper = name.toUpperCase()
  if (upper.includes('STARLINK')) return 'starlink'
  if (upper.includes('ONEWEB')) return 'oneweb'
  if (
    upper.includes('GPS') ||
    upper.includes('NAVSTAR') ||
    upper.includes('GLONASS') ||
    upper.includes('GALILEO') ||
    upper.includes('BEIDOU')
  )
    return 'gps'
  if (
    upper.includes('NOAA') ||
    upper.includes('GOES') ||
    upper.includes('METEOSAT') ||
    upper.includes('METEOR') ||
    upper.includes('FENGYUN') ||
    upper.includes('HIMAWARI')
  )
    return 'weather'
  if (upper.includes('ISS') || upper.includes('TIANGONG') || upper.includes('ZARYA'))
    return 'stations'
  if (
    upper.includes('USA ') ||
    upper.includes('NROL') ||
    upper.includes('COSMOS') ||
    upper.includes('MUOS') ||
    upper.includes('SBIRS') ||
    upper.includes('DSP')
  )
    return 'military'
  if (upper.includes('IRIDIUM')) return 'iridium'
  if (
    upper.includes('HUBBLE') ||
    upper.includes('TERRA') ||
    upper.includes('AQUA') ||
    upper.includes('LANDSAT') ||
    upper.includes('CALIPSO') ||
    upper.includes('AURA') ||
    upper.includes('JASON')
  )
    return 'science'
  return 'other'
}
