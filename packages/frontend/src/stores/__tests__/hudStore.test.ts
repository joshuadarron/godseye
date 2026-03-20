import { describe, it, expect, beforeEach } from 'vitest'
import { useHudStore } from '../hudStore'

describe('hudStore', () => {
  beforeEach(() => {
    useHudStore.setState({ openSubFilter: null, searchQuery: '' })
  })

  it('sets openSubFilter', () => {
    useHudStore.getState().setOpenSubFilter('flights')
    expect(useHudStore.getState().openSubFilter).toBe('flights')
  })

  it('clears openSubFilter', () => {
    useHudStore.getState().setOpenSubFilter('flights')
    useHudStore.getState().setOpenSubFilter(null)
    expect(useHudStore.getState().openSubFilter).toBeNull()
  })

  it('sets searchQuery', () => {
    useHudStore.getState().setSearchQuery('test query')
    expect(useHudStore.getState().searchQuery).toBe('test query')
  })
})
