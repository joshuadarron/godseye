import type { Earthquake } from '../types/earthquake'
import { createEntityStore } from './createEntityStore'
import { registerStore } from './entityRegistry'

export const useEarthquakeStore = createEntityStore<Earthquake>('events')

registerStore('events', useEarthquakeStore as any)
