import type { ArmedConflict } from '../types/conflict'
import { createEntityStore } from './createEntityStore'
import { registerStore } from './entityRegistry'

export const useConflictStore = createEntityStore<ArmedConflict>('conflicts')

registerStore('conflicts', useConflictStore as any)
