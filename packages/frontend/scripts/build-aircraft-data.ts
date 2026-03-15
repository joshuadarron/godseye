/**
 * Downloads the OpenSky aircraft metadata CSV database, extracts key fields,
 * and writes a compact JSON lookup table keyed by icao24.
 *
 * Usage: npx tsx packages/frontend/scripts/build-aircraft-data.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const AIRCRAFT_DB_URL = 'https://opensky-network.org/datasets/metadata/aircraftDatabase.csv'
const OUT_DIR = resolve(__dirname, '../public/data')

interface AircraftEntry {
  reg: string
  type: string
  model: string
  mfr: string
  op: string
  owner: string
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.text()
}

/**
 * Parse a single CSV line respecting quoted fields (which may contain commas).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseAircraftDB(csv: string): Record<string, AircraftEntry> {
  const lines = csv.split('\n')
  if (lines.length === 0) return {}

  // Parse header to find column indices.
  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase())
  const idx = {
    icao24: header.indexOf('icao24'),
    registration: header.indexOf('registration'),
    typecode: header.indexOf('typecode'),
    model: header.indexOf('model'),
    manufacturer: header.indexOf('manufacturername'),
    operator: header.indexOf('operator'),
    owner: header.indexOf('owner'),
  }

  if (idx.icao24 === -1) {
    throw new Error(`Could not find icao24 column in header: ${lines[0]}`)
  }

  const aircraft: Record<string, AircraftEntry> = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const cols = parseCSVLine(line)
    const icao24 = cols[idx.icao24]?.toLowerCase()
    if (!icao24) continue

    const reg = cols[idx.registration] ?? ''
    const type = cols[idx.typecode] ?? ''
    const model = cols[idx.model] ?? ''
    const mfr = cols[idx.manufacturer] ?? ''
    const op = cols[idx.operator] ?? ''
    const owner = cols[idx.owner] ?? ''

    // Skip entries with no useful data.
    if (!reg && !type && !model && !op) continue

    aircraft[icao24] = { reg, type, model, mfr, op, owner }
  }

  return aircraft
}

async function main() {
  console.log('Fetching OpenSky aircraft database...')
  const csv = await fetchText(AIRCRAFT_DB_URL)
  const aircraft = parseAircraftDB(csv)
  const count = Object.keys(aircraft).length
  console.log(`  Parsed ${count} aircraft entries`)

  mkdirSync(OUT_DIR, { recursive: true })

  const outPath = resolve(OUT_DIR, 'aircraft.json')
  writeFileSync(outPath, JSON.stringify(aircraft))
  console.log(`  Wrote ${outPath}`)

  console.log('Done!')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
