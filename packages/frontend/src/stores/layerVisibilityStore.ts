import { create } from 'zustand'

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
  commercial: 'Commercial',
  cargo: 'Cargo',
  military: 'Military',
  private: 'Private / GA',
  ground: 'Ground',
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

const defaultSublayers: Record<string, SublayerMap> = {
  flights: Object.fromEntries(
    Object.keys(FLIGHT_SUBTYPES).map((k) => [k, true]),
  ),
  satellites: Object.fromEntries(
    Object.keys(SATELLITE_SUBTYPES).map((k) => [k, true]),
  ),
}

export const useLayerVisibilityStore = create<LayerVisibilityState>((set, get) => ({
  layers: {
    flights: true,
    satellites: true,
    vessels: true,
    trains: true,
    events: true,
  },
  sublayers: defaultSublayers,

  toggle: (layer) =>
    set((state) => {
      const nowOn = !state.layers[layer]
      const sublayers = { ...state.sublayers }
      if (nowOn && sublayers[layer]) {
        sublayers[layer] = Object.fromEntries(
          Object.keys(sublayers[layer]).map((k) => [k, true]),
        )
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
      const updated = Object.fromEntries(
        Object.keys(current).map((k) => [k, enabled]),
      )
      return { sublayers: { ...state.sublayers, [layer]: updated } }
    }),

  isSublayerVisible: (layer, sublayer) => {
    const state = get()
    if (!state.layers[layer]) return false
    return state.sublayers[layer]?.[sublayer] ?? true
  },
}))

// Known ICAO airline prefixes for cargo carriers.
const CARGO_PREFIXES = new Set([
  'FDX', 'UPS', 'GTI', 'CLX', 'ABW', 'CKS', 'BOX', 'KAL', // FedEx, UPS, Atlas, Cargolux, AirBridgeCargo, Kalitta, Aerologic
  'GEC', 'MPH', 'SQC', 'CAO', 'ABD', 'QAC', 'ETD', 'DHK', // Lufthansa Cargo, Martinair, SIA Cargo, Air China Cargo
  'POC', 'SLK', 'TWY', 'NCR',
])

// Known military callsign prefixes/patterns.
const MILITARY_PREFIXES = new Set([
  'RCH', 'DUKE', 'NAVY', 'EVAC', 'MOOSE', 'COBRA', 'TOPCAT', 'BRONCO',
  'TITAN', 'EAGLE', 'HAWK', 'VIPER', 'MAGMA', 'DOOM', 'THUD', 'BOLT',
  'TREND', 'REACH', 'KING', 'NCHO', 'JAKE', 'SPAR', 'SAM', 'EXEC',
  'PACK', 'STAB', 'ORCA', 'CNV', 'RRR', 'IAM', 'MMF', 'PLF', 'BAF',
  'GAF', 'RFR', 'SHF', 'CASA', 'FAF',
])

/** Classify a flight into a subtype key based on callsign and state. */
export function classifyFlight(callsign: string, onGround: boolean): string {
  if (onGround) return 'ground'

  const cs = callsign.trim().toUpperCase()
  if (!cs) return 'private'

  // Check 3-letter ICAO prefix for cargo.
  const prefix3 = cs.slice(0, 3)
  if (CARGO_PREFIXES.has(prefix3)) return 'cargo'

  // Check military — full match on known callsign words or prefixes.
  if (MILITARY_PREFIXES.has(prefix3)) return 'military'
  for (const mp of MILITARY_PREFIXES) {
    if (cs.startsWith(mp)) return 'military'
  }

  // If callsign has a 3-letter prefix followed by digits, it's likely a scheduled airline flight.
  if (/^[A-Z]{3}\d/.test(cs)) return 'commercial'

  // Two-letter IATA-style codes followed by digits (e.g., UA123).
  if (/^[A-Z]{2}\d/.test(cs)) return 'commercial'

  return 'private'
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
  ) return 'gps'
  if (
    upper.includes('NOAA') ||
    upper.includes('GOES') ||
    upper.includes('METEOSAT') ||
    upper.includes('METEOR') ||
    upper.includes('FENGYUN') ||
    upper.includes('HIMAWARI')
  ) return 'weather'
  if (
    upper.includes('ISS') ||
    upper.includes('TIANGONG') ||
    upper.includes('ZARYA')
  ) return 'stations'
  if (
    upper.includes('USA ') ||
    upper.includes('NROL') ||
    upper.includes('COSMOS') ||
    upper.includes('MUOS') ||
    upper.includes('SBIRS') ||
    upper.includes('DSP')
  ) return 'military'
  if (upper.includes('IRIDIUM')) return 'iridium'
  if (
    upper.includes('HUBBLE') ||
    upper.includes('TERRA') ||
    upper.includes('AQUA') ||
    upper.includes('LANDSAT') ||
    upper.includes('CALIPSO') ||
    upper.includes('AURA') ||
    upper.includes('JASON')
  ) return 'science'
  return 'other'
}
