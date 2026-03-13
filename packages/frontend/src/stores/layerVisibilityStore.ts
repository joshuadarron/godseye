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
