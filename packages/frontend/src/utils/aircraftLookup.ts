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

// These files are gitignored and absent on a fresh clone — `pnpm data:aircraft`
// builds them from the OpenSky dataset. Missing means Vite serves its SPA
// index.html fallback, so res.json() would throw a SyntaxError. The promise is
// memoized, so an unhandled rejection here would poison lookups for the whole
// session; degrade to an empty map instead.
async function loadJsonMap<T>(path: string, label: string): Promise<Map<string, T>> {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: Record<string, T> = await res.json()
    return new Map(Object.entries(data))
  } catch (err) {
    console.warn(`[aircraft] ${label} unavailable (${path}) — run \`pnpm data:aircraft\``, err)
    return new Map()
  }
}

async function loadTypes(): Promise<TypeMap> {
  typeMap = await loadJsonMap<string>('/data/aircraft.json', 'type map')
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
  detailMap = await loadJsonMap<AircraftMeta>('/data/aircraft-detail.json', 'detail map')
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
