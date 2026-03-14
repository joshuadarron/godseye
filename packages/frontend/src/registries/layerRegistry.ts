import type { ReactNode, ComponentType } from 'react'
import type { Color } from 'cesium'
import type { Entity } from '../types/common'
import type { ModelEntity } from '../components/Globe/ModelLayer'
import type { EntityStoreState } from '../stores/createEntityStore'
import type { StoreApi, UseBoundStore } from 'zustand'
export interface LayerRegistration {
  key: string
  label: string
  icon: ReactNode
  store: UseBoundStore<StoreApi<EntityStoreState<Entity>>>
  toModelEntity: (entity: Entity) => ModelEntity
  iconUrl: string
  fallbackColor: Color
  iconScale?: number
  fallbackPixelSize?: number
  headingOffset?: number
  disableRotation?: boolean
  subtypes?: Record<string, string>
  subtypeIcons?: Record<string, string>
  subtypeColors?: Record<string, Color>
  classifySubtype?: (entity: Entity) => string
  detailPanel?: ComponentType<{ entityId: string }>
  tooltip?: ComponentType<{ entityId: string }>
  overlays?: ComponentType[]
}

const registry = new Map<string, LayerRegistration>()

export function registerLayer(registration: LayerRegistration) {
  registry.set(registration.key, registration)
}

export function getLayerRegistration(key: string): LayerRegistration | undefined {
  return registry.get(key)
}

export const layerRegistry = registry
