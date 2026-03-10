import { create } from 'zustand'
import type { Satellite } from '../types/satellite'

interface SatelliteState {
  satellites: Map<string, Satellite>
  processDeltas: (entities: Satellite[], action: 'upsert' | 'remove') => void
  getSatellites: () => Satellite[]
}

export const useSatelliteStore = create<SatelliteState>((set, get) => ({
  satellites: new Map(),

  processDeltas: (entities, action) => {
    set((state) => {
      const next = new Map(state.satellites)
      if (action === 'upsert') {
        for (const entity of entities) {
          next.set(entity.id, entity)
        }
      } else if (action === 'remove') {
        for (const entity of entities) {
          next.delete(entity.id)
        }
      }
      return { satellites: next }
    })
  },

  getSatellites: () => Array.from(get().satellites.values()),
}))
