import { describe, it, expect, beforeEach } from 'vitest'
import type { Entity } from '../../types/common'
import { createEntityStore } from '../createEntityStore'

const useTestStore = createEntityStore<Entity>('test')

function entity(id: string, lat = 0, lng = 0): Entity {
  return { id, lat, lng }
}

describe('createEntityStore', () => {
  beforeEach(() => {
    // The store mutates its Map in place, so resetting scalar fields alone
    // would leak entities between tests.
    useTestStore.setState({ entities: new Map(), version: 0 })
  })

  it('starts empty', () => {
    expect(useTestStore.getState().entities.size).toBe(0)
    expect(useTestStore.getState().version).toBe(0)
  })

  it('adds entities on upsert', () => {
    useTestStore.getState().processDeltas([entity('a'), entity('b')], 'upsert')

    expect(useTestStore.getState().entities.size).toBe(2)
    expect(useTestStore.getState().getById('a')).toEqual(entity('a'))
  })

  it('overwrites an existing entity with the same id', () => {
    useTestStore.getState().processDeltas([entity('a', 1, 1)], 'upsert')
    useTestStore.getState().processDeltas([entity('a', 2, 2)], 'upsert')

    expect(useTestStore.getState().entities.size).toBe(1)
    expect(useTestStore.getState().getById('a')).toEqual(entity('a', 2, 2))
  })

  it('deletes entities on remove', () => {
    useTestStore.getState().processDeltas([entity('a'), entity('b')], 'upsert')
    useTestStore.getState().processDeltas([entity('a')], 'remove')

    expect(useTestStore.getState().entities.size).toBe(1)
    expect(useTestStore.getState().getById('a')).toBeUndefined()
    expect(useTestStore.getState().getById('b')).toBeDefined()
  })

  it('ignores a remove for an unknown id', () => {
    useTestStore.getState().processDeltas([entity('a')], 'upsert')
    useTestStore.getState().processDeltas([entity('does-not-exist')], 'remove')

    expect(useTestStore.getState().entities.size).toBe(1)
  })

  it('keeps the same Map instance across deltas', () => {
    // The Map is mutated in place to avoid an O(n) copy on every frame. This is
    // why `version` exists — a component subscribed to `entities` alone would
    // never see a change.
    const before = useTestStore.getState().entities
    useTestStore.getState().processDeltas([entity('a')], 'upsert')

    expect(useTestStore.getState().entities).toBe(before)
  })

  it('increments version by exactly one per call', () => {
    useTestStore.getState().processDeltas([entity('a')], 'upsert')
    expect(useTestStore.getState().version).toBe(1)

    useTestStore.getState().processDeltas([entity('b')], 'upsert')
    expect(useTestStore.getState().version).toBe(2)

    useTestStore.getState().processDeltas([entity('a')], 'remove')
    expect(useTestStore.getState().version).toBe(3)
  })

  it('increments version even for an empty delta', () => {
    useTestStore.getState().processDeltas([], 'upsert')

    expect(useTestStore.getState().version).toBe(1)
    expect(useTestStore.getState().entities.size).toBe(0)
  })

  it('getEntities returns all values as a fresh array each call', () => {
    useTestStore.getState().processDeltas([entity('a'), entity('b')], 'upsert')

    const first = useTestStore.getState().getEntities()
    const second = useTestStore.getState().getEntities()

    expect(first.map((e) => e.id).sort()).toEqual(['a', 'b'])
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })

  it('clear installs a new Map and resets the version', () => {
    useTestStore.getState().processDeltas([entity('a')], 'upsert')
    const before = useTestStore.getState().entities

    useTestStore.getState().clear()

    expect(useTestStore.getState().entities.size).toBe(0)
    expect(useTestStore.getState().version).toBe(0)
    expect(useTestStore.getState().entities).not.toBe(before)
  })

  it('keeps separate stores isolated', () => {
    const useOther = createEntityStore<Entity>('other')

    useTestStore.getState().processDeltas([entity('a')], 'upsert')

    expect(useOther.getState().entities.size).toBe(0)
    expect(useOther.getState().version).toBe(0)
  })
})
