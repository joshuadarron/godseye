import { memo, useMemo } from 'react'
import { useHudStore } from '../../stores/hudStore'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { useDebounce } from '../../hooks/useDebounce'
import type { Entity } from '../../types/common'

const MAX_RESULTS = 100

interface SearchResult {
  layer: string
  layerLabel: string
  entity: Entity
  displayName: string
}

function matchEntity(entity: Entity, layer: string, query: string): string | null {
  const q = query.toLowerCase()

  if (layer === 'flights') {
    const f = entity as any
    if (f.callsign?.toLowerCase().includes(q)) return f.callsign
    if (f.originCountry?.toLowerCase().includes(q)) return f.callsign || f.id
    if (f.id.toLowerCase().includes(q)) return f.callsign || f.id
    return null
  }

  if (layer === 'satellites') {
    const s = entity as any
    if (s.name?.toLowerCase().includes(q)) return s.name
    if (String(s.noradId).includes(q)) return s.name || String(s.noradId)
    if (s.id.toLowerCase().includes(q)) return s.name || s.id
    return null
  }

  // Fallback for future layers
  if (entity.id.toLowerCase().includes(q)) return entity.id
  return null
}

function useSearchResults(debouncedQuery: string): SearchResult[] {
  const layers = useLayerVisibilityStore((s) => s.layers)

  return useMemo(() => {
    if (!debouncedQuery) return []

    const results: SearchResult[] = []

    for (const [key, reg] of layerRegistry) {
      if (!layers[key]) continue

      const entities = reg.store.getState().getEntities()
      for (const entity of entities) {
        const displayName = matchEntity(entity, key, debouncedQuery)
        if (displayName) {
          results.push({
            layer: key,
            layerLabel: reg.label,
            entity,
            displayName,
          })
          if (results.length >= MAX_RESULTS) return results
        }
      }
    }

    return results
  }, [debouncedQuery, layers])
}

export default memo(function SearchResultsPanel() {
  const searchQuery = useHudStore((s) => s.searchQuery)
  const debouncedQuery = useDebounce(searchQuery, 300)
  const results = useSearchResults(debouncedQuery)
  const setSelected = useSelectedEntityStore((s) => s.setSelected)

  if (!debouncedQuery || results.length === 0) return null

  return (
    <div className="fixed left-2 top-24 bottom-4 w-80 z-40 overflow-y-auto scrollbar-hide pointer-events-auto flex flex-col gap-2">
      <div className="px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {results.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : results.length} result{results.length !== 1 ? 's' : ''}
        </span>
      </div>

      {results.map((result) => (
        <button
          key={`${result.layer}-${result.entity.id}`}
          onClick={() => setSelected({ layer: result.layer, entityId: result.entity.id })}
          className="flex items-center gap-3 w-full text-left px-4 py-3 cursor-pointer select-none transition-colors bg-black/50 backdrop-blur-md border border-white/[0.08] rounded-xl hover:bg-white/10"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90 font-medium truncate">
              {result.displayName}
            </p>
            <p className="text-xs text-white/35 mt-0.5">
              {result.layerLabel} &middot; {result.entity.id}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
})
