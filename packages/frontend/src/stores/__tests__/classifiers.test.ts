import { describe, it, expect } from 'vitest'
import {
  classifyFlight,
  classifyVessel,
  classifyEarthquake,
  classifyConflict,
  classifySatellite,
} from '../layerVisibilityStore'

describe('classifyVessel', () => {
  it.each([
    [70, 'cargo'],
    [75, 'cargo'],
    [79, 'cargo'],
    [80, 'tanker'],
    [89, 'tanker'],
    [60, 'passenger'],
    [69, 'passenger'],
    [30, 'fishing'],
    [35, 'military'],
    [31, 'tug'],
    [32, 'tug'],
    [36, 'pleasure'],
    [37, 'pleasure'],
  ])('maps AIS ship type %i to %s', (shipType, expected) => {
    expect(classifyVessel(shipType)).toBe(expected)
  })

  it.each([
    [0, 'other'],
    [29, 'other'],
    [33, 'other'],
    [34, 'other'],
    [38, 'other'],
    [59, 'other'],
    [90, 'other'],
    [99, 'other'],
  ])('falls back to other for unmapped type %i', (shipType, expected) => {
    expect(classifyVessel(shipType)).toBe(expected)
  })
})

describe('classifyEarthquake', () => {
  it.each([
    [9.5, 'major'],
    [7, 'major'],
    [6.9, 'strong'],
    [5, 'strong'],
    [4.9, 'moderate'],
    [4, 'moderate'],
    [3.9, 'light'],
    [3, 'light'],
    [2.9, 'minor'],
    [0, 'minor'],
    [-1, 'minor'],
  ])('maps magnitude %f to %s', (magnitude, expected) => {
    expect(classifyEarthquake(magnitude)).toBe(expected)
  })
})

describe('classifyConflict', () => {
  it.each([
    ['Battles', 'battles'],
    ['Violence against civilians', 'violence_civilians'],
    ['Explosions/Remote violence', 'explosions'],
    ['Remote violence', 'explosions'],
    ['Protests', 'protests'],
    ['Riots', 'riots'],
    ['Strategic developments', 'strategic'],
  ])('maps ACLED event type %s to %s', (eventType, expected) => {
    expect(classifyConflict(eventType)).toBe(expected)
  })

  it('is case insensitive', () => {
    expect(classifyConflict('BATTLES')).toBe('battles')
    expect(classifyConflict('protests')).toBe('protests')
  })

  it('defaults unknown event types to battles', () => {
    // Not an error case — ACLED occasionally emits types this map does not
    // cover, and they are rendered as battles rather than dropped.
    expect(classifyConflict('Something Unrecognised')).toBe('battles')
    expect(classifyConflict('')).toBe('battles')
  })
})

describe('classifySatellite', () => {
  it.each([
    ['STARLINK-1234', 'starlink'],
    ['ONEWEB-0042', 'oneweb'],
    ['GPS BIIR-2', 'gps'],
    ['NAVSTAR 81', 'gps'],
    ['GLONASS-M', 'gps'],
    ['GALILEO 21', 'gps'],
    ['BEIDOU-3 M15', 'gps'],
    ['NOAA 19', 'weather'],
    ['GOES 16', 'weather'],
    ['METEOSAT-11', 'weather'],
    ['HIMAWARI-9', 'weather'],
    ['ISS (ZARYA)', 'stations'],
    ['TIANGONG', 'stations'],
    ['USA 314', 'military'],
    ['NROL-91', 'military'],
    ['COSMOS 2542', 'military'],
    ['IRIDIUM 133', 'iridium'],
    ['HUBBLE SPACE TELESCOPE', 'science'],
    ['LANDSAT 9', 'science'],
    ['SOME RANDOM SAT', 'other'],
  ])('maps %s to %s', (name, expected) => {
    expect(classifySatellite(name)).toBe(expected)
  })

  it('is case insensitive', () => {
    expect(classifySatellite('starlink-1234')).toBe('starlink')
  })

  it('matches on substrings, which can misclassify unrelated names', () => {
    // Documenting current behaviour, not endorsing it: the checks are plain
    // substring tests in a fixed order, so a name that merely contains "ISS"
    // is filed under space stations.
    expect(classifySatellite('SWISSCUBE')).toBe('stations')
  })
})

describe('classifyFlight', () => {
  // The aircraft database is loaded asynchronously and is null in these tests,
  // so classification falls through to the ADS-B emitter category (tier 3).
  const airborne = false

  it.each([
    [2, 'cessna'],
    [3, 'jet_nonswept'],
    [4, 'airliner'],
    [5, 'heavy_2e'],
    [6, 'heavy_4e'],
    [7, 'hi_perf'],
    [8, 'helicopter'],
    [10, 'balloon'],
  ])('maps emitter category %i to %s', (category, expected) => {
    expect(classifyFlight('abc123', category, airborne)).toBe(expected)
  })

  it.each([[0], [1], [13], [15], [18], [19], [20], [99]])(
    'maps uninformative category %i to unknown',
    (category) => {
      expect(classifyFlight('abc123', category, airborne)).toBe('unknown')
    },
  )

  it('overrides to ground when on the ground', () => {
    expect(classifyFlight('abc123', 4, true)).toBe('ground')
    expect(classifyFlight('abc123', 8, true)).toBe('ground')
  })

  it('does not override surface vehicle categories', () => {
    // 14 (UAV), 16 (surface emergency) and 17 (surface service) already mean
    // ground, so the override must not fire and mask them.
    for (const category of [14, 16, 17]) {
      expect(classifyFlight('abc123', category, true)).toBe('ground')
      expect(classifyFlight('abc123', category, false)).toBe('ground')
    }
  })

  it('handles an empty icao24', () => {
    expect(classifyFlight('', 4, false)).toBe('airliner')
  })
})
