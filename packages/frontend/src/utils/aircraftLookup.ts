export interface AircraftMeta {
  type: string
  reg?: string
  model?: string
  mfr?: string
  op?: string
  owner?: string
}

// ---------------------------------------------------------------------------
// Slim type map — {icao24: "TYPECODE"} — used by aircraftClassifier for icons.
// Small enough to keep in memory (~7MB).
// ---------------------------------------------------------------------------

type TypeMap = Map<string, string>

let typePromise: Promise<TypeMap> | null = null
let typeMap: TypeMap | null = null

async function loadTypes(): Promise<TypeMap> {
  const res = await fetch('/data/aircraft.json')
  const data: Record<string, string> = await res.json()
  typeMap = new Map(Object.entries(data))
  return typeMap
}

function getTypes(): Promise<TypeMap> {
  if (!typePromise) typePromise = loadTypes()
  return typePromise
}

/** Synchronous access to the type map (null until loaded). Used by classifier. */
export function getAircraftDb(): TypeMap | null {
  return typeMap
}

/** Eagerly start loading the type map. */
export function initAircraftDb(): void {
  getTypes()
}

// ---------------------------------------------------------------------------
// Full detail map — {icao24: AircraftMeta} — lazy-loaded for detail panel.
// Larger file, only fetched when user selects an aircraft.
// ---------------------------------------------------------------------------

type DetailMap = Map<string, AircraftMeta>

let detailPromise: Promise<DetailMap> | null = null
let detailMap: DetailMap | null = null

async function loadDetail(): Promise<DetailMap> {
  const res = await fetch('/data/aircraft-detail.json')
  const data: Record<string, AircraftMeta> = await res.json()
  detailMap = new Map(Object.entries(data))
  return detailMap
}

function getDetail(): Promise<DetailMap> {
  if (!detailPromise) detailPromise = loadDetail()
  return detailPromise
}

/**
 * Look up aircraft metadata by icao24 hex address.
 * Lazy-loads the full detail database on first call.
 * Returns null if no metadata is available.
 */
export async function lookupAircraft(icao24: string): Promise<AircraftMeta | null> {
  if (!icao24) return null
  const detail = await getDetail()
  return detail.get(icao24.toLowerCase()) ?? null
}
