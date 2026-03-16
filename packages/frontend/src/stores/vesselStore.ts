import type { Vessel } from '../types/vessel'
import { createEntityStore } from './createEntityStore'
import { registerStore } from './entityRegistry'

export const useVesselStore = createEntityStore<Vessel>('vessels')

registerStore('vessels', useVesselStore as any)
