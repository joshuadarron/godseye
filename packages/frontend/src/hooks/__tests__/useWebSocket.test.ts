import { describe, it, expect } from 'vitest'
import type { DeltaMessage, Entity } from '../../types/common'
import { groupDeltas, backoffDelay, buildProtocols } from '../useWebSocket'

function entity(id: string): Entity {
  return { id, lat: 0, lng: 0 }
}

function delta(layer: string, action: 'upsert' | 'remove', ...ids: string[]): DeltaMessage {
  return { layer, action, entities: ids.map(entity) }
}

describe('groupDeltas', () => {
  it('returns an empty map for no messages', () => {
    expect(groupDeltas([]).size).toBe(0)
  })

  it('keys a single message by layer and action', () => {
    const grouped = groupDeltas([delta('flights', 'upsert', 'a')])

    expect([...grouped.keys()]).toEqual(['flights:upsert'])
    expect(grouped.get('flights:upsert')).toEqual({
      action: 'upsert',
      entities: [entity('a')],
    })
  })

  it('merges entities across messages for the same layer and action', () => {
    const grouped = groupDeltas([
      delta('flights', 'upsert', 'a', 'b'),
      delta('flights', 'upsert', 'c'),
    ])

    expect(grouped.size).toBe(1)
    const entities = grouped.get('flights:upsert')!.entities as Entity[]
    expect(entities.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps upserts and removes for the same layer separate', () => {
    // Collapsing these would turn a delete into an add, or vice versa.
    const grouped = groupDeltas([delta('flights', 'upsert', 'a'), delta('flights', 'remove', 'b')])

    expect(grouped.size).toBe(2)
    expect(grouped.get('flights:upsert')!.action).toBe('upsert')
    expect(grouped.get('flights:remove')!.action).toBe('remove')
  })

  it('keeps different layers separate', () => {
    const grouped = groupDeltas([
      delta('flights', 'upsert', 'a'),
      delta('vessels', 'upsert', 'b'),
      delta('satellites', 'upsert', 'c'),
    ])

    expect([...grouped.keys()].sort()).toEqual([
      'flights:upsert',
      'satellites:upsert',
      'vessels:upsert',
    ])
  })

  it('does not mutate the source messages when merging', () => {
    const first = delta('flights', 'upsert', 'a')
    const second = delta('flights', 'upsert', 'b')

    groupDeltas([first, second])

    expect(first.entities).toHaveLength(1)
    expect(second.entities).toHaveLength(1)
  })

  it('preserves insertion order of groups', () => {
    const grouped = groupDeltas([delta('vessels', 'upsert', 'a'), delta('flights', 'upsert', 'b')])

    expect([...grouped.keys()]).toEqual(['vessels:upsert', 'flights:upsert'])
  })

  it('handles messages carrying no entities', () => {
    const grouped = groupDeltas([delta('flights', 'upsert')])

    expect(grouped.get('flights:upsert')!.entities).toEqual([])
  })
})

describe('backoffDelay', () => {
  it('doubles each attempt starting at one second', () => {
    expect(backoffDelay(0)).toBe(1_000)
    expect(backoffDelay(1)).toBe(2_000)
    expect(backoffDelay(2)).toBe(4_000)
    expect(backoffDelay(3)).toBe(8_000)
    expect(backoffDelay(4)).toBe(16_000)
  })

  it('clamps at thirty seconds', () => {
    // Without the clamp the delay would grow unbounded and a tab left open
    // overnight would effectively never reconnect.
    expect(backoffDelay(5)).toBe(30_000)
    expect(backoffDelay(10)).toBe(30_000)
    expect(backoffDelay(100)).toBe(30_000)
  })
})

describe('buildProtocols', () => {
  it('embeds the access token when signed in', () => {
    expect(buildProtocols('tok3n')).toEqual(['godseye.v1.tok3n'])
  })

  it('falls back to the bare protocol when anonymous', () => {
    expect(buildProtocols(null)).toEqual(['godseye.v1'])
  })

  it('treats an empty token as anonymous', () => {
    expect(buildProtocols('')).toEqual(['godseye.v1'])
  })
})
