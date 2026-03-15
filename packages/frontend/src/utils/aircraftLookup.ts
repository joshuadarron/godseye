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

async function loadAircraft(): Promise<AircraftMap> {
  const res = await fetch('/data/aircraft.json')
  const data: Record<string, AircraftMeta> = await res.json()
  return new Map(Object.entries(data))
}

function getAircraft(): Promise<AircraftMap> {
  if (!aircraftPromise) aircraftPromise = loadAircraft()
  return aircraftPromise
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
