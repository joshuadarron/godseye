#!/usr/bin/env node
/**
 * Download the OpenSky Network aircraft metadata database and convert it
 * to the compact JSON format expected by packages/frontend/src/utils/aircraftLookup.ts.
 *
 * Output: packages/frontend/public/data/aircraft.json
 *
 * Only entries with a non-empty ICAO type designator (typecode) are included,
 * since that field drives the aircraft icon classification system.
 *
 * Usage:  node scripts/build-aircraft-db.mjs
 */

import { createWriteStream, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createReadStream, unlinkSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const OUTPUT_PATH = join(PROJECT_ROOT, 'packages/frontend/public/data/aircraft.json')
const DETAIL_PATH = join(PROJECT_ROOT, 'packages/frontend/public/data/aircraft-detail.json')
const CSV_URL = 'https://opensky-network.org/datasets/metadata/aircraftDatabase.csv'
const TMP_CSV = join(PROJECT_ROOT, 'scripts/.aircraftDatabase.csv.tmp')

// ---------------------------------------------------------------------------
// Step 1: Download CSV
// ---------------------------------------------------------------------------

async function downloadCSV() {
  console.log(`Downloading ${CSV_URL} ...`)
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

  mkdirSync(dirname(TMP_CSV), { recursive: true })
  const dest = createWriteStream(TMP_CSV)

  const reader = res.body.getReader()
  let downloaded = 0
  const writer = new Writable({
    write(chunk, _enc, cb) {
      downloaded += chunk.length
      if (downloaded % (10 * 1024 * 1024) < chunk.length) {
        process.stdout.write(`\r  ${(downloaded / 1024 / 1024).toFixed(1)} MB downloaded`)
      }
      dest.write(chunk, cb)
    },
  })

  await pipeline(async function* () {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      yield value
    }
  }, writer)
  dest.end()
  await new Promise((resolve) => dest.on('finish', resolve))
  console.log(`\r  ${(downloaded / 1024 / 1024).toFixed(1)} MB downloaded — done.`)
}

// ---------------------------------------------------------------------------
// Step 2: Parse CSV → JSON
// ---------------------------------------------------------------------------

/** Parse a single CSV line respecting quoted fields. */
function parseCSVLine(line) {
  const fields = []
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
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

async function convertCSVtoJSON() {
  console.log('Parsing CSV and building JSON ...')
  const rl = createInterface({ input: createReadStream(TMP_CSV, 'utf-8'), crlfDelay: Infinity })

  // CSV columns (0-indexed):
  //  0: icao24       5: typecode
  //  1: registration 9: operator  10: operatorcallsign  13: owner
  //  3: manufacturername  4: model

  let isHeader = true
  let total = 0
  let keptTypes = 0
  let keptDetail = 0

  // --- aircraft.json: slim {icao24: "TYPECODE"} for classification (~7MB) ---
  const outTypes = createWriteStream(OUTPUT_PATH)
  outTypes.write('{')
  let firstType = true

  // --- aircraft-detail.json: full metadata for detail panel ---
  const outDetail = createWriteStream(DETAIL_PATH)
  outDetail.write('{')
  let firstDetail = true

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue
    }
    total++
    const cols = parseCSVLine(line)
    const icao24 = (cols[0] || '').toLowerCase()
    const typecode = cols[5] || ''

    if (!icao24) continue

    // Aircraft type file — only entries with typecodes.
    if (typecode) {
      outTypes.write(`${firstType ? '' : ','}"${icao24}":"${typecode}"`)
      firstType = false
      keptTypes++
    }

    // Detail file — entries with any useful metadata.
    const reg = cols[1] || ''
    const model = cols[4] || ''
    const mfr = cols[3] || ''
    const op = cols[9] || cols[10] || ''
    const owner = cols[13] || ''

    if (reg || model || mfr || op || owner || typecode) {
      const obj = {}
      if (typecode) obj.type = typecode
      if (reg) obj.reg = reg
      if (model) obj.model = model
      if (mfr) obj.mfr = mfr
      if (op) obj.op = op
      if (owner) obj.owner = owner

      outDetail.write(`${firstDetail ? '' : ','}"${icao24}":${JSON.stringify(obj)}`)
      firstDetail = false
      keptDetail++
    }

    if (keptTypes % 50000 === 0 && keptTypes > 0) {
      process.stdout.write(`\r  ${keptTypes.toLocaleString()} entries ...`)
    }
  }

  outTypes.write('}')
  outTypes.end()
  outDetail.write('}')
  outDetail.end()
  await Promise.all([
    new Promise((resolve) => outTypes.on('finish', resolve)),
    new Promise((resolve) => outDetail.on('finish', resolve)),
  ])

  console.log(`\r  ${total.toLocaleString()} rows parsed.`)
  console.log(`  Types: ${keptTypes.toLocaleString()} entries → aircraft.json`)
  console.log(`  Detail: ${keptDetail.toLocaleString()} entries → aircraft-detail.json`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    await downloadCSV()
    await convertCSVtoJSON()

    // Clean up temp CSV.
    if (existsSync(TMP_CSV)) unlinkSync(TMP_CSV)

    const { statSync } = await import('node:fs')
    const typeSize = statSync(OUTPUT_PATH).size
    const detailSize = statSync(DETAIL_PATH).size
    console.log(`\nOutput:`)
    console.log(`  ${OUTPUT_PATH} — ${(typeSize / 1024 / 1024).toFixed(1)} MB`)
    console.log(`  ${DETAIL_PATH} — ${(detailSize / 1024 / 1024).toFixed(1)} MB`)
    console.log('Done.')
  } catch (err) {
    console.error('Error:', err.message)
    if (existsSync(TMP_CSV)) unlinkSync(TMP_CSV)
    process.exit(1)
  }
}

main()
