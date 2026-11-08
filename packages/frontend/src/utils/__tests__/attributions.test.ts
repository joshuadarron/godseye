import { describe, it, expect } from 'vitest'
import { visibleAttributions } from '../attributions'
import type { LayerAttribution } from '../../registries/layerRegistry'

const registry = new Map<string, { attribution?: LayerAttribution }>([
  ['flights', { attribution: { label: 'OpenSky Network', url: 'https://opensky-network.org/' } }],
  ['satellites', { attribution: { label: 'CelesTrak', url: 'https://celestrak.org/' } }],
  ['placeholder', {}],
])

describe('visibleAttributions', () => {
  it('credits nothing when every layer is off', () => {
    expect(visibleAttributions({ flights: false, satellites: false }, registry)).toEqual([])
  })

  it('credits only the layers that are on', () => {
    const result = visibleAttributions({ flights: true, satellites: false }, registry)
    expect(result.map((a) => a.label)).toEqual(['OpenSky Network'])
  })

  it('returns credits in registry order, not visibility order', () => {
    const result = visibleAttributions({ satellites: true, flights: true }, registry)
    expect(result.map((a) => a.label)).toEqual(['OpenSky Network', 'CelesTrak'])
  })

  it('skips a visible layer that declares no attribution', () => {
    expect(visibleAttributions({ placeholder: true }, registry)).toEqual([])
  })

  it('ignores a visible layer with no registration', () => {
    // `trains` is toggleable in the store but has no registry entry, so an
    // unguarded lookup here would throw the moment someone clicked it.
    expect(visibleAttributions({ trains: true }, registry)).toEqual([])
  })

  it('treats an unknown layer key as hidden', () => {
    // The store defaults every layer to off; crediting a source for a layer
    // nobody can see would be wrong.
    expect(visibleAttributions({}, registry)).toEqual([])
  })

  it('credits a shared provider once when two layers name it', () => {
    const shared = new Map<string, { attribution?: LayerAttribution }>([
      ['a', { attribution: { label: 'USGS', url: 'https://earthquake.usgs.gov/' } }],
      ['b', { attribution: { label: 'USGS', url: 'https://earthquake.usgs.gov/' } }],
    ])
    expect(visibleAttributions({ a: true, b: true }, shared)).toHaveLength(1)
  })
})
