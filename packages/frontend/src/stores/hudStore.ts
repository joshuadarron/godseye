import { create } from 'zustand'

interface HudState {
  openSubFilter: string | null
  searchQuery: string
  setOpenSubFilter: (key: string | null) => void
  setSearchQuery: (query: string) => void
}

export const useHudStore = create<HudState>((set) => ({
  openSubFilter: null,
  searchQuery: '',
  setOpenSubFilter: (key) => set({ openSubFilter: key }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
