import { create } from 'zustand'
import type { Entity } from '../types/common'

export interface EntityStoreState<T extends Entity> {
  entities: Map<string, T>
  processDeltas: (entities: T[], action: 'upsert' | 'remove') => void
  getEntities: () => T[]
  getById: (id: string) => T | undefined
  clear: () => void
}

/**
 * Generic Zustand store factory for any entity layer.
 */
export function createEntityStore<T extends Entity>(_name: string) {
  return create<EntityStoreState<T>>((set, get) => ({
    entities: new Map(),

    processDeltas: (incoming, action) => {
      set((state) => {
        const next = new Map(state.entities)
        if (action === 'upsert') {
          for (const entity of incoming) {
            next.set(entity.id, entity)
          }
        } else if (action === 'remove') {
          for (const entity of incoming) {
            next.delete(entity.id)
          }
        }
        return { entities: next }
      })
    },

    getEntities: () => Array.from(get().entities.values()),
    getById: (id: string) => get().entities.get(id),
    clear: () => set({ entities: new Map() }),
  }))
}
