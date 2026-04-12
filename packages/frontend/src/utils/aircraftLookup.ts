export interface AircraftMeta {
  reg: string
  type: string
  model: string
  mfr: string
  op: string
  owner: string
}

type AircraftMap = Map<string, AircraftMeta>

let aircraftPromise: Promise<AircraftMap> | null = null
let aircraftMap: AircraftMap | null = null

async function loadAircraft(): Promise<AircraftMap> {
  const res = await fetch('/data/aircraft.json')
  const data: Record<string, AircraftMeta> = await res.json()
  aircraftMap = new Map(Object.entries(data))
  return aircraftMap
}

function getAircraft(): Promise<AircraftMap> {
  if (!aircraftPromise) aircraftPromise = loadAircraft()
  return aircraftPromise
}

/** Synchronous access to the aircraft DB (null until loaded). */
export function getAircraftDb(): AircraftMap | null {
  return aircraftMap
}

/** Eagerly start loading the aircraft DB. */
export function initAircraftDb(): void {
  getAircraft()
}

/**
 * Look up aircraft metadata by icao24 hex address.
 * Lazy-loads the aircraft database on first call.
 * Returns null if no metadata is available.
 */
export async function lookupAircraft(icao24: string): Promise<AircraftMeta | null> {
  if (!icao24) return null
  const aircraft = await getAircraft()
  return aircraft.get(icao24.toLowerCase()) ?? null
}
