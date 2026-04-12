import { create } from 'zustand'
import type { Entity } from '../types/common'

export interface EntityStoreState<T extends Entity> {
  entities: Map<string, T>
  version: number
  processDeltas: (entities: T[], action: 'upsert' | 'remove') => void
  getEntities: () => T[]
  getById: (id: string) => T | undefined
  clear: () => void
}

/**
 * Generic Zustand store factory for any entity layer.
 * Mutates the Map in-place and bumps a version counter to trigger re-renders,
 * avoiding O(n) Map copy on every delta.
 */
export function createEntityStore<T extends Entity>(_name: string) {
  return create<EntityStoreState<T>>((set, get) => ({
    entities: new Map(),
    version: 0,

    processDeltas: (incoming, action) => {
      set((state) => {
        const map = state.entities
        if (action === 'upsert') {
          for (const entity of incoming) {
            map.set(entity.id, entity)
          }
        } else if (action === 'remove') {
          for (const entity of incoming) {
            map.delete(entity.id)
          }
        }
        return { entities: map, version: state.version + 1 }
      })
    },

    getEntities: () => Array.from(get().entities.values()),
    getById: (id: string) => get().entities.get(id),
    clear: () => set({ entities: new Map(), version: 0 }),
  }))
}
