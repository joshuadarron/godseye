import type { Satellite } from '../types/satellite'
import { createEntityStore } from './createEntityStore'
import { registerStore } from './entityRegistry'

export const useSatelliteStore = createEntityStore<Satellite>('satellites')

registerStore('satellites', useSatelliteStore as any)
