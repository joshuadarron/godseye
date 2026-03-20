/**
 * Downloads OpenFlights airports.dat and routes.dat, parses them into compact
 * JSON lookup tables, and writes them to public/data/.
 *
 * Usage: npx tsx packages/frontend/scripts/build-route-data.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AIRPORTS_URL =
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat'
const ROUTES_URL = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat'

const OUT_DIR = resolve(__dirname, '../public/data')

interface AirportEntry {
  name: string
  lat: number
  lng: number
}

interface RouteEntry {
  dep: string
  arr: string
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

function parseAirports(csv: string): Record<string, AirportEntry> {
  const airports: Record<string, AirportEntry> = {}
  for (const line of csv.split('\n')) {
    if (!line.trim()) continue
    // airports.dat columns: id, name, city, country, IATA, ICAO, lat, lng, alt, tz, DST, tzOlson, type, source
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, ''))
    const icao = cols[5]
    if (!icao || icao === '\\N' || icao.length !== 4) continue
    const lat = parseFloat(cols[6])
    const lng = parseFloat(cols[7])
    if (isNaN(lat) || isNaN(lng)) continue
    airports[icao] = { name: `${cols[1]}, ${cols[2]}`, lat, lng }
  }
  return airports
}

function parseRoutes(csv: string): Record<string, RouteEntry[]> {
  const routes: Record<string, RouteEntry[]> = {}
  for (const line of csv.split('\n')) {
    if (!line.trim()) continue
    // routes.dat columns: airline, airlineID, sourceAirport, sourceAirportID, destAirport, destAirportID, codeshare, stops, equipment
    const cols = line.split(',').map((c) => c.replace(/^"|"$/g, ''))
    const airlineIcao = cols[0]
    const depIcao = cols[2]
    const arrIcao = cols[4]
    if (!airlineIcao || airlineIcao === '\\N' || airlineIcao.length < 2) continue
    if (!depIcao || depIcao === '\\N' || !arrIcao || arrIcao === '\\N') continue
    // Only include direct flights (0 stops)
    if (cols[7] !== '0') continue
    const key = airlineIcao.toUpperCase()
    if (!routes[key]) routes[key] = []
    // Avoid duplicate routes
    const exists = routes[key].some((r) => r.dep === depIcao && r.arr === arrIcao)
    if (!exists) {
      routes[key].push({ dep: depIcao, arr: arrIcao })
    }
  }
  return routes
}

async function main() {
  console.log('Fetching airports.dat...')
  const airportsCsv = await fetchText(AIRPORTS_URL)
  const airports = parseAirports(airportsCsv)
  console.log(`  Parsed ${Object.keys(airports).length} airports with ICAO codes`)

  console.log('Fetching routes.dat...')
  const routesCsv = await fetchText(ROUTES_URL)
  const routes = parseRoutes(routesCsv)
  const totalRoutes = Object.values(routes).reduce((s, r) => s + r.length, 0)
  console.log(`  Parsed ${totalRoutes} routes across ${Object.keys(routes).length} airlines`)

  mkdirSync(OUT_DIR, { recursive: true })

  const airportsPath = resolve(OUT_DIR, 'airports.json')
  writeFileSync(airportsPath, JSON.stringify(airports))
  console.log(`  Wrote ${airportsPath}`)

  const routesPath = resolve(OUT_DIR, 'routes.json')
  writeFileSync(routesPath, JSON.stringify(routes))
  console.log(`  Wrote ${routesPath}`)

  console.log('Done!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
