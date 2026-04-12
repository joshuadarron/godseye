/**
 * FlightAware-style aircraft icon classification.
 *
 * 3-tier cascade:
 *   1. TYPE_DESIGNATOR_ICONS — specific ICAO type code → icon
 *   2. TYPE_DESCRIPTION_ICONS — ICAO Doc 8643 description + WTC → icon
 *   3. CATEGORY_ICONS — ADS-B emitter category → icon
 *   4. Fallback → 'unknown'
 */

import { getAircraftDb, initAircraftDb } from './aircraftLookup'

// ---------------------------------------------------------------------------
// Icon type constants
// ---------------------------------------------------------------------------

export const AIRCRAFT_ICON_TYPES = [
  'cessna',
  'twin_small',
  'twin_large',
  'jet_nonswept',
  'jet_swept',
  'airliner',
  'heavy_2e',
  'heavy_4e',
  'helicopter',
  'hi_perf',
  'balloon',
  'ground',
  'unknown',
] as const

export type AircraftIconType = (typeof AIRCRAFT_ICON_TYPES)[number]

// ---------------------------------------------------------------------------
// Tier 1: Specific ICAO type designator → icon (~240 entries from FlightAware)
// ---------------------------------------------------------------------------

const TYPE_DESIGNATOR_ICONS: Record<string, AircraftIconType> = {
  // Cessna / high-wing single-engine GA
  C150: 'cessna',
  C152: 'cessna',
  C162: 'cessna',
  C170: 'cessna',
  C172: 'cessna',
  C175: 'cessna',
  C177: 'cessna',
  C180: 'cessna',
  C182: 'cessna',
  C185: 'cessna',
  C188: 'cessna',
  C190: 'cessna',
  C195: 'cessna',
  C205: 'cessna',
  C206: 'cessna',
  C207: 'cessna',
  C208: 'cessna',
  C210: 'cessna',
  C303: 'cessna',
  C336: 'cessna',
  C337: 'cessna',
  C401: 'cessna',
  C402: 'cessna',
  PA18: 'cessna',
  PA22: 'cessna',
  PA24: 'cessna',
  PA28: 'cessna',
  PA32: 'cessna',
  PA34: 'cessna',
  PA38: 'cessna',
  PA44: 'cessna',
  PA46: 'cessna',
  AA5: 'cessna',
  AA1: 'cessna',
  AC11: 'cessna',
  AC95: 'cessna',
  M20: 'cessna',
  M20P: 'cessna',
  M20T: 'cessna',
  DA20: 'cessna',
  DA40: 'cessna',
  DA42: 'cessna',
  SR20: 'cessna',
  SR22: 'cessna',
  RV6: 'cessna',
  RV7: 'cessna',
  RV8: 'cessna',
  RV10: 'cessna',
  RV12: 'cessna',
  RV14: 'cessna',
  DR40: 'cessna',
  TB20: 'cessna',
  TB21: 'cessna',
  P28A: 'cessna',
  P28B: 'cessna',
  P28R: 'cessna',
  P28T: 'cessna',
  P32R: 'cessna',
  P32T: 'cessna',
  P46T: 'cessna',
  BE33: 'cessna',
  BE35: 'cessna',
  BE36: 'cessna',
  TOBA: 'cessna',
  TOBM: 'cessna',
  SPIT: 'cessna',
  P51: 'cessna',
  T6: 'cessna',
  T28: 'cessna',

  // Twin small — light multi-engine props
  BE58: 'twin_small',
  BE55: 'twin_small',
  BE76: 'twin_small',
  BE60: 'twin_small',
  BE9L: 'twin_small',
  BE9T: 'twin_small',
  BE99: 'twin_small',
  C310: 'twin_small',
  C320: 'twin_small',
  C340: 'twin_small',
  C414: 'twin_small',
  C421: 'twin_small',
  C425: 'twin_small',
  C441: 'twin_small',
  PA23: 'twin_small',
  PA27: 'twin_small',
  PA30: 'twin_small',
  PA31: 'twin_small',
  PA60: 'twin_small',
  PA42: 'twin_small',
  AC50: 'twin_small',
  AC56: 'twin_small',
  AC68: 'twin_small',
  AC80: 'twin_small',
  MU2: 'twin_small',
  SW2: 'twin_small',
  SW3: 'twin_small',

  // Twin large — turboprops / large twin props
  AT43: 'twin_large',
  AT44: 'twin_large',
  AT45: 'twin_large',
  AT72: 'twin_large',
  AT73: 'twin_large',
  AT75: 'twin_large',
  AT76: 'twin_large',
  ATR: 'twin_large',
  DH8A: 'twin_large',
  DH8B: 'twin_large',
  DH8C: 'twin_large',
  DH8D: 'twin_large',
  DHC6: 'twin_large',
  DHC7: 'twin_large',
  SF34: 'twin_large',
  JS31: 'twin_large',
  JS32: 'twin_large',
  JS41: 'twin_large',
  E120: 'twin_large',
  L188: 'twin_large',
  AN24: 'twin_large',
  AN26: 'twin_large',
  AN32: 'twin_large',
  DC3: 'twin_large',
  DC3S: 'twin_large',
  DC3T: 'twin_large',
  C130: 'twin_large',
  C160: 'twin_large',
  BE20: 'twin_large',
  BE30: 'twin_large',
  BE40: 'twin_large',
  B190: 'twin_large',
  B350: 'twin_large',
  P180: 'twin_large',
  PC12: 'twin_large',
  TBM7: 'twin_large',
  TBM8: 'twin_large',
  TBM9: 'twin_large',
  BE1900: 'twin_large',

  // Jet nonswept — straight-wing light jets
  C500: 'jet_nonswept',
  C510: 'jet_nonswept',
  C525: 'jet_nonswept',
  C550: 'jet_nonswept',
  C560: 'jet_nonswept',
  C56X: 'jet_nonswept',
  C650: 'jet_nonswept',
  C680: 'jet_nonswept',
  C68A: 'jet_nonswept',
  C700: 'jet_nonswept',
  C750: 'jet_nonswept',
  LJ23: 'jet_nonswept',
  LJ24: 'jet_nonswept',
  LJ25: 'jet_nonswept',
  LJ28: 'jet_nonswept',
  LJ31: 'jet_nonswept',
  LJ35: 'jet_nonswept',
  LJ40: 'jet_nonswept',
  LJ45: 'jet_nonswept',
  LJ55: 'jet_nonswept',
  LJ60: 'jet_nonswept',
  LJ70: 'jet_nonswept',
  LJ75: 'jet_nonswept',
  E500: 'jet_nonswept',
  E545: 'jet_nonswept',
  E550: 'jet_nonswept',
  EA50: 'jet_nonswept',
  EVOT: 'jet_nonswept',
  PRM1: 'jet_nonswept',
  SF50: 'jet_nonswept',
  HDJT: 'jet_nonswept',
  SJ30: 'jet_nonswept',
  MU30: 'jet_nonswept',

  // Jet swept — business / regional swept-wing jets
  GLF2: 'jet_swept',
  GLF3: 'jet_swept',
  GLF4: 'jet_swept',
  GLF5: 'jet_swept',
  GLF6: 'jet_swept',
  GLEX: 'jet_swept',
  GL5T: 'jet_swept',
  GL7T: 'jet_swept',
  CL30: 'jet_swept',
  CL35: 'jet_swept',
  CL60: 'jet_swept',
  BD70: 'jet_swept',
  BD100: 'jet_swept',
  FA10: 'jet_swept',
  FA20: 'jet_swept',
  FA50: 'jet_swept',
  FA7X: 'jet_swept',
  FA8X: 'jet_swept',
  F900: 'jet_swept',
  F2TH: 'jet_swept',
  H25A: 'jet_swept',
  H25B: 'jet_swept',
  H25C: 'jet_swept',
  HA4T: 'jet_swept',
  CRJ1: 'jet_swept',
  CRJ2: 'jet_swept',
  CRJ7: 'jet_swept',
  CRJ9: 'jet_swept',
  CRJX: 'jet_swept',
  E135: 'jet_swept',
  E145: 'jet_swept',
  E170: 'jet_swept',
  E175: 'jet_swept',
  MD80: 'jet_swept',
  MD81: 'jet_swept',
  MD82: 'jet_swept',
  MD83: 'jet_swept',
  MD87: 'jet_swept',
  MD88: 'jet_swept',
  MD90: 'jet_swept',
  DC9: 'jet_swept',
  DC91: 'jet_swept',
  DC93: 'jet_swept',
  DC95: 'jet_swept',
  F100: 'jet_swept',
  F70: 'jet_swept',
  F28: 'jet_swept',
  B712: 'jet_swept',
  B717: 'jet_swept',
  GA5C: 'jet_swept',
  GA6C: 'jet_swept',
  GALX: 'jet_swept',

  // Airliner — narrowbody commercial
  B731: 'airliner',
  B732: 'airliner',
  B733: 'airliner',
  B734: 'airliner',
  B735: 'airliner',
  B736: 'airliner',
  B737: 'airliner',
  B738: 'airliner',
  B739: 'airliner',
  B37M: 'airliner',
  B38M: 'airliner',
  B39M: 'airliner',
  B752: 'airliner',
  B753: 'airliner',
  A318: 'airliner',
  A319: 'airliner',
  A320: 'airliner',
  A321: 'airliner',
  A19N: 'airliner',
  A20N: 'airliner',
  A21N: 'airliner',
  E190: 'airliner',
  E195: 'airliner',
  E290: 'airliner',
  E295: 'airliner',
  BCS1: 'airliner',
  BCS3: 'airliner',
  B721: 'airliner',
  B722: 'airliner',
  B727: 'airliner',
  T134: 'airliner',
  T154: 'airliner',
  T204: 'airliner',
  IL62: 'airliner',
  IL76: 'airliner',
  RJ85: 'airliner',
  RJ1H: 'airliner',
  BA11: 'airliner',
  COMT: 'airliner',
  CONC: 'airliner',
  C919: 'airliner',
  MC21: 'airliner',
  SSJ1: 'airliner',

  // Heavy twin-engine — widebody twins
  B762: 'heavy_2e',
  B763: 'heavy_2e',
  B764: 'heavy_2e',
  B772: 'heavy_2e',
  B773: 'heavy_2e',
  B77L: 'heavy_2e',
  B77W: 'heavy_2e',
  B778: 'heavy_2e',
  B779: 'heavy_2e',
  B788: 'heavy_2e',
  B789: 'heavy_2e',
  B78X: 'heavy_2e',
  A306: 'heavy_2e',
  A30B: 'heavy_2e',
  A310: 'heavy_2e',
  A332: 'heavy_2e',
  A333: 'heavy_2e',
  A338: 'heavy_2e',
  A339: 'heavy_2e',
  A359: 'heavy_2e',
  A35K: 'heavy_2e',
  DC10: 'heavy_2e',
  MD11: 'heavy_2e',
  L101: 'heavy_2e',

  // Heavy four-engine
  B741: 'heavy_4e',
  B742: 'heavy_4e',
  B743: 'heavy_4e',
  B744: 'heavy_4e',
  B748: 'heavy_4e',
  B74S: 'heavy_4e',
  A124: 'heavy_4e',
  A225: 'heavy_4e',
  A342: 'heavy_4e',
  A343: 'heavy_4e',
  A344: 'heavy_4e',
  A345: 'heavy_4e',
  A346: 'heavy_4e',
  A380: 'heavy_4e',
  A388: 'heavy_4e',
  A3ST: 'heavy_4e',
  C5: 'heavy_4e',
  C5M: 'heavy_4e',
  C17: 'heavy_4e',
  IL96: 'heavy_4e',

  // Helicopter
  R22: 'helicopter',
  R44: 'helicopter',
  R66: 'helicopter',
  EC20: 'helicopter',
  EC30: 'helicopter',
  EC35: 'helicopter',
  EC45: 'helicopter',
  EC55: 'helicopter',
  EC75: 'helicopter',
  EC25: 'helicopter',
  EC65: 'helicopter',
  AS50: 'helicopter',
  AS55: 'helicopter',
  AS65: 'helicopter',
  A109: 'helicopter',
  A119: 'helicopter',
  A139: 'helicopter',
  A149: 'helicopter',
  A169: 'helicopter',
  B06: 'helicopter',
  B06T: 'helicopter',
  B105: 'helicopter',
  B212: 'helicopter',
  B214: 'helicopter',
  B222: 'helicopter',
  B230: 'helicopter',
  B407: 'helicopter',
  B412: 'helicopter',
  B427: 'helicopter',
  B429: 'helicopter',
  B430: 'helicopter',
  B47G: 'helicopter',
  B47T: 'helicopter',
  S55: 'helicopter',
  S58: 'helicopter',
  S61: 'helicopter',
  S76: 'helicopter',
  S92: 'helicopter',
  S70: 'helicopter',
  UH1: 'helicopter',
  UH60: 'helicopter',
  H60: 'helicopter',
  CH47: 'helicopter',
  CH53: 'helicopter',
  MI8: 'helicopter',
  MI17: 'helicopter',
  MI24: 'helicopter',
  MI26: 'helicopter',
  K32: 'helicopter',
  KMAX: 'helicopter',
  MD52: 'helicopter',
  MD60: 'helicopter',
  EXPL: 'helicopter',
  LYNX: 'helicopter',
  PUMA: 'helicopter',
  GAZL: 'helicopter',
  AW09: 'helicopter',
  AW101: 'helicopter',
  AW139: 'helicopter',
  AW169: 'helicopter',
  AW189: 'helicopter',

  // High performance / military fast jets
  F14: 'hi_perf',
  F15: 'hi_perf',
  F16: 'hi_perf',
  F18: 'hi_perf',
  F22: 'hi_perf',
  F35: 'hi_perf',
  F104: 'hi_perf',
  F111: 'hi_perf',
  F4: 'hi_perf',
  F5: 'hi_perf',
  F86: 'hi_perf',
  EUFI: 'hi_perf',
  RFAL: 'hi_perf',
  GROB: 'hi_perf',
  TORD: 'hi_perf',
  MIAG: 'hi_perf',
  MIR4: 'hi_perf',
  SU27: 'hi_perf',
  SU30: 'hi_perf',
  SU34: 'hi_perf',
  SU35: 'hi_perf',
  A10: 'hi_perf',
  A4: 'hi_perf',
  B1: 'hi_perf',
  B2: 'hi_perf',
  B52: 'hi_perf',
  HAWK: 'hi_perf',
  T38: 'hi_perf',
  T45: 'hi_perf',
  E2: 'hi_perf',
  E3: 'hi_perf',
  E6: 'hi_perf',
  E8: 'hi_perf',
  KC10: 'hi_perf',
  KC35: 'hi_perf',
  KC46: 'hi_perf',
  P3: 'hi_perf',
  P8: 'hi_perf',
  V22: 'hi_perf',
  MV22: 'hi_perf',
  U2: 'hi_perf',
  SR71: 'hi_perf',
  HARR: 'hi_perf',
  JAG: 'hi_perf',
}

// ---------------------------------------------------------------------------
// Tier 2: ICAO type description + WTC → icon
// Format: "{numEngines}{engineType}-{wtc}" e.g. "L2J-H" (landplane, 2 jet, heavy)
// ---------------------------------------------------------------------------

const TYPE_DESCRIPTION_ICONS: Record<string, AircraftIconType> = {
  // Single engine piston/turboprop
  L1P: 'cessna',
  L1T: 'cessna',
  A1P: 'cessna', // amphibian single
  A1T: 'cessna',
  S1P: 'cessna', // seaplane single
  S1T: 'cessna',

  // Twin piston — small
  L2P: 'twin_small',
  A2P: 'twin_small',

  // Twin turboprop
  L2T: 'twin_large',
  'L2T-L': 'twin_large',
  'L2T-M': 'twin_large',
  'L2T-H': 'twin_large',

  // Light jets (not heavy)
  L1J: 'jet_nonswept',
  'L2J-L': 'jet_nonswept',

  // Medium jets
  'L2J-M': 'jet_swept',
  'L3J-M': 'jet_swept',

  // Narrowbody airliners (2 jet, medium-to-heavy)
  L2J: 'airliner',

  // Heavy twins
  'L2J-H': 'heavy_2e',
  'L3J-H': 'heavy_2e',

  // Heavy quads
  'L4J-H': 'heavy_4e',
  'L4T-H': 'heavy_4e',

  // Helicopters
  H1P: 'helicopter',
  H1T: 'helicopter',
  H2T: 'helicopter',
  H2P: 'helicopter',
  H3T: 'helicopter',

  // Gyrocopters → treat as helicopter
  G1P: 'helicopter',
  G1T: 'helicopter',
}

// ---------------------------------------------------------------------------
// Tier 3: OpenSky ADS-B emitter category → icon
// OpenSky categories (numeric) map to FlightAware A0-B7 categories.
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<number, AircraftIconType> = {
  0: 'unknown', // No info
  1: 'unknown', // No ADS-B emitter category info (A0)
  2: 'cessna', // Light < 15500 lbs (A1)
  3: 'jet_nonswept', // Small 15500-75000 lbs (A2)
  4: 'airliner', // Large 75000-300000 lbs (A3)
  5: 'heavy_2e', // High vortex large (e.g. B757) (A4)
  6: 'heavy_4e', // Heavy > 300000 lbs (A5)
  7: 'hi_perf', // High performance (>5g, >400kts) (A6)
  8: 'helicopter', // Rotorcraft (A7)
  9: 'cessna', // Glider/sailplane (B1)
  10: 'balloon', // Lighter-than-air (B2)
  11: 'cessna', // Parachutist/skydiver (B3)
  12: 'cessna', // Ultralight/hang-glider (B4)
  13: 'unknown', // Reserved (B5)
  14: 'ground', // UAV (B6) — map to unknown, but plan says ground
  15: 'unknown', // Space/trans-atmospheric (B7)
  16: 'ground', // Surface emergency vehicle (C1)
  17: 'ground', // Surface service vehicle (C2)
  18: 'unknown', // Point obstacle (C3)
  19: 'unknown', // Cluster obstacle (C4)
  20: 'unknown', // Line obstacle (C5)
}

// ---------------------------------------------------------------------------
// Data stores (populated by initAircraftClassifier)
// ---------------------------------------------------------------------------

let icaoTypes: Map<string, [string, string]> | null = null
let initialized = false

/**
 * Eagerly load icao-types.json into module-level Map.
 * Aircraft DB is shared via aircraftLookup.ts (loaded on first use).
 * Call once at app startup. Non-blocking — classification works without data
 * (falls back to category-only lookup).
 */
export async function initAircraftClassifier(): Promise<void> {
  if (initialized) return
  initialized = true

  // Kick off aircraft DB load (shared with aircraftLookup.ts)
  initAircraftDb()

  try {
    const res = await fetch('/data/icao-types.json')
    const data: Record<string, [string, string]> = await res.json()
    icaoTypes = new Map(Object.entries(data))
  } catch {
    // Graceful degradation — classification still works via category fallback
  }
}

/**
 * Synchronous 3-tier aircraft icon classification.
 *
 * @param icao24 - ICAO 24-bit hex address (lowercase)
 * @param category - OpenSky ADS-B emitter category number
 * @returns One of the AIRCRAFT_ICON_TYPES keys
 */
export function classifyAircraftIcon(icao24: string, category: number): AircraftIconType {
  const hex = icao24?.toLowerCase()
  const aircraftDb = getAircraftDb()

  if (hex && aircraftDb) {
    const meta = aircraftDb.get(hex)
    if (meta?.type) {
      const typeCode = meta.type.toUpperCase()

      // Tier 1: exact type designator match
      const t1 = TYPE_DESIGNATOR_ICONS[typeCode]
      if (t1) return t1

      // Tier 2: look up type description from icao-types.json
      if (icaoTypes) {
        const typeInfo = icaoTypes.get(typeCode)
        if (typeInfo) {
          const [desc, wtc] = typeInfo
          // Try description+WTC first, then description only
          const t2 = TYPE_DESCRIPTION_ICONS[`${desc}-${wtc}`] ?? TYPE_DESCRIPTION_ICONS[desc]
          if (t2) return t2
        }
      }
    }
  }

  // Tier 3: ADS-B emitter category
  const t3 = CATEGORY_ICONS[category]
  if (t3) return t3

  return 'unknown'
}
