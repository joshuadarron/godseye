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
  // Widened to accept stores of any entity type — concentrates the single `any` here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: UseBoundStore<StoreApi<EntityStoreState<any>>>
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
  subtypeNoRotate?: Record<string, boolean>
  detailPanel?: ComponentType<{ entityId: string }>
  tooltip?: ComponentType<{ entityId: string }>
  overlays?: ComponentType[]
  /** Optional custom rendering component that replaces GenericEntityLayer's default rendering. */
  customLayer?: ComponentType<{ registration: LayerRegistration }>
}

const registry = new Map<string, LayerRegistration>()

export function registerLayer(registration: LayerRegistration) {
  registry.set(registration.key, registration)
}

export function getLayerRegistration(key: string): LayerRegistration | undefined {
  return registry.get(key)
}

export const layerRegistry = registry
