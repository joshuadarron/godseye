import type { StoreApi } from 'zustand'
import type { Entity } from '../types/common'
import type { EntityStoreState } from './createEntityStore'

type AnyEntityStore = StoreApi<EntityStoreState<Entity>>

const registry = new Map<string, AnyEntityStore>()

export function registerStore(layer: string, store: AnyEntityStore) {
  registry.set(layer, store)
}

export function getStore(layer: string): AnyEntityStore | undefined {
  return registry.get(layer)
}

export const entityRegistry = registry
