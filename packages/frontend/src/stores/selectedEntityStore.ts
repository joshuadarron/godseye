import { create } from 'zustand'

export interface PickedEntity {
  layer: string
  entityId: string
}

export interface ScreenRect {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface SelectedEntityState {
  hovered: PickedEntity | null
  hoverPosition: { x: number; y: number } | null
  selected: PickedEntity | null
  selectedScreenPosition: { x: number; y: number } | null
  /** Screen-space bounding box of the orbit trajectory (set by SatelliteOrbitOverlay). */
  orbitScreenBounds: ScreenRect | null
  setHovered: (entity: PickedEntity | null, position: { x: number; y: number } | null) => void
  setSelected: (
    entity: PickedEntity | null,
    screenPosition?: { x: number; y: number } | null,
  ) => void
  setOrbitScreenBounds: (bounds: ScreenRect | null) => void
  clearSelected: () => void
}

export const useSelectedEntityStore = create<SelectedEntityState>((set) => ({
  hovered: null,
  hoverPosition: null,
  selected: null,
  selectedScreenPosition: null,
  orbitScreenBounds: null,

  setHovered: (entity, position) => set({ hovered: entity, hoverPosition: position }),
  setSelected: (entity, screenPosition) =>
    set({
      selected: entity,
      selectedScreenPosition: screenPosition ?? null,
      orbitScreenBounds: null,
      hovered: null,
      hoverPosition: null,
    }),
  setOrbitScreenBounds: (bounds) => set({ orbitScreenBounds: bounds }),
  clearSelected: () =>
    set({ selected: null, selectedScreenPosition: null, orbitScreenBounds: null }),
}))
