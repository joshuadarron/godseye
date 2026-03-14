import type { Flight } from '../types/flight'
import { createEntityStore } from './createEntityStore'
import { registerStore } from './entityRegistry'

export const useFlightStore = createEntityStore<Flight>('flights')

registerStore('flights', useFlightStore as any)
