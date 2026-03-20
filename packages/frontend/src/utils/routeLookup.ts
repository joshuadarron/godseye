export interface Airport {
  icao: string
  name: string
  lat: number
  lng: number
}

export interface Route {
  dep: string
  arr: string
}

export interface FlightRoute {
  departure: Airport
  arrival: Airport
}

type AirportMap = Map<string, Airport>
type RouteMap = Map<string, Route[]>

let airportsPromise: Promise<AirportMap> | null = null
let routesPromise: Promise<RouteMap> | null = null

async function loadAirports(): Promise<AirportMap> {
  const res = await fetch('/data/airports.json')
  const data: Record<string, { name: string; lat: number; lng: number }> = await res.json()
  const map = new Map<string, Airport>()
  for (const [icao, info] of Object.entries(data)) {
    map.set(icao, { icao, ...info })
  }
  return map
}

async function loadRoutes(): Promise<RouteMap> {
  const res = await fetch('/data/routes.json')
  const data: Record<string, Route[]> = await res.json()
  return new Map(Object.entries(data))
}

function getAirports(): Promise<AirportMap> {
  if (!airportsPromise) airportsPromise = loadAirports()
  return airportsPromise
}

function getRoutes(): Promise<RouteMap> {
  if (!routesPromise) routesPromise = loadRoutes()
  return routesPromise
}

/**
 * Extract the ICAO airline prefix from a callsign.
 * Most airline callsigns are 3-letter ICAO prefix + flight number (e.g. UAL123, BAW456).
 */
function extractAirlinePrefix(callsign: string): string | null {
  const trimmed = callsign.trim().toUpperCase()
  if (trimmed.length < 4) return null
  const prefix = trimmed.slice(0, 3)
  if (!/^[A-Z]{3}$/.test(prefix)) return null
  return prefix
}

const DEG2RAD = Math.PI / 180

/** Haversine distance in km between two lat/lng points. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG2RAD
  const dLng = (lng2 - lng1) * DEG2RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Approximate cross-track distance from a point to the great circle defined by
 * two endpoints. Returns the absolute distance in km.
 */
function crossTrackDistance(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dAP = haversine(aLat, aLng, pLat, pLng) / 6371
  const bearingAP = bearing(aLat, aLng, pLat, pLng)
  const bearingAB = bearing(aLat, aLng, bLat, bLng)
  return Math.abs(Math.asin(Math.sin(dAP) * Math.sin(bearingAP - bearingAB))) * 6371
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * DEG2RAD
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG2RAD)
  const x =
    Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos(dLng)
  return Math.atan2(y, x)
}

/**
 * Look up the route for a flight callsign, using the flight's current position
 * to disambiguate when an airline has multiple routes.
 * Lazy-loads route/airport data on first call.
 * Returns null if no route data is available.
 */
export async function lookupRoute(
  callsign: string,
  flightLat?: number,
  flightLng?: number,
): Promise<FlightRoute | null> {
  if (!callsign) return null

  const prefix = extractAirlinePrefix(callsign)
  if (!prefix) return null

  const [airports, routes] = await Promise.all([getAirports(), getRoutes()])

  const airlineRoutes = routes.get(prefix)
  if (!airlineRoutes || airlineRoutes.length === 0) return null

  // Score each route by cross-track distance from the flight's current position
  // to the great-circle arc between departure and arrival airports.
  let bestRoute: Route | null = null
  let bestScore = Infinity

  for (const route of airlineRoutes) {
    const dep = airports.get(route.dep)
    const arr = airports.get(route.arr)
    if (!dep || !arr) continue

    if (flightLat != null && flightLng != null) {
      const xtd = crossTrackDistance(flightLat, flightLng, dep.lat, dep.lng, arr.lat, arr.lng)
      if (xtd < bestScore) {
        bestScore = xtd
        bestRoute = route
      }
    } else {
      // No position info — just take the first valid route
      bestRoute = route
      break
    }
  }

  if (!bestRoute) return null

  const dep = airports.get(bestRoute.dep)
  const arr = airports.get(bestRoute.arr)
  if (!dep || !arr) return null

  return { departure: dep, arrival: arr }
}
