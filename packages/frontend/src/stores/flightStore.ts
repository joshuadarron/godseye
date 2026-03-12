import { create } from 'zustand'
import type { Flight } from '../types/flight'

interface FlightState {
  flights: Map<string, Flight>
  processDeltas: (entities: Flight[], action: 'upsert' | 'remove') => void
  getFlights: () => Flight[]
}

export const useFlightStore = create<FlightState>((set, get) => ({
  flights: new Map(),

  processDeltas: (entities, action) => {
    set((state) => {
      const next = new Map(state.flights)
      if (action === 'upsert') {
        for (const entity of entities) {
          next.set(entity.id, entity)
        }
      } else if (action === 'remove') {
        for (const entity of entities) {
          next.delete(entity.id)
        }
      }
      return { flights: next }
    })
  },

  getFlights: () => Array.from(get().flights.values()),
}))
