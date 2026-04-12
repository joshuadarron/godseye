import { memo, useCallback, useMemo } from 'react'
import { BoundingSphere, Cartesian3, HeadingPitchRange, Math as CesiumMath } from 'cesium'
import { useHudStore } from '../../stores/hudStore'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { useDebounce } from '../../hooks/useDebounce'
import { getViewer } from '../../utils/viewerRef'
import type { Entity } from '../../types/common'
import type { Flight } from '../../types/flight'
import type { Satellite } from '../../types/satellite'
import type { Vessel } from '../../types/vessel'
import type { Earthquake } from '../../types/earthquake'

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
    const f = entity as Flight
    if (f.callsign?.toLowerCase().includes(q)) return f.callsign
    if (f.originCountry?.toLowerCase().includes(q)) return f.callsign || f.id
    if (f.id.toLowerCase().includes(q)) return f.callsign || f.id
    return null
  }

  if (layer === 'satellites') {
    const s = entity as Satellite
    if (s.name?.toLowerCase().includes(q)) return s.name
    if (String(s.noradId).includes(q)) return s.name || String(s.noradId)
    if (s.id.toLowerCase().includes(q)) return s.name || s.id
    return null
  }

  if (layer === 'vessels') {
    const v = entity as Vessel
    if (v.name?.toLowerCase().includes(q)) return v.name
    if (v.id.includes(q)) return v.name || v.id
    if (v.callsign?.toLowerCase().includes(q)) return v.name || v.callsign
    if (v.destination?.toLowerCase().includes(q)) return v.name || v.id
    return null
  }

  if (layer === 'events') {
    const eq = entity as Earthquake
    if (eq.place?.toLowerCase().includes(q)) return `M${eq.magnitude?.toFixed(1)} — ${eq.place}`
    if (String(eq.magnitude).includes(q))
      return `M${eq.magnitude?.toFixed(1)} — ${eq.place || eq.id}`
    if (eq.id.toLowerCase().includes(q))
      return `M${eq.magnitude?.toFixed(1)} — ${eq.place || eq.id}`
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

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setSelected({ layer: result.layer, entityId: result.entity.id })

      const viewer = getViewer()
      if (!viewer) return

      const rawAlt = (result.entity as Flight | Satellite).altitude ?? 0
      // Satellites store altitude in km; everything else in meters.
      const alt = result.layer === 'satellites' ? rawAlt * 1000 : rawAlt
      // Distance from entity to camera.
      const range = alt > 100_000 ? alt * 2 : 50_000

      const target = Cartesian3.fromDegrees(result.entity.lng, result.entity.lat, alt)
      viewer.camera.flyToBoundingSphere(new BoundingSphere(target, 0), {
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-90), range),
        duration: 1.5,
      })
    },
    [setSelected],
  )

  if (!debouncedQuery) return null

  if (results.length === 0) {
    return (
      <div className="mt-3 w-full sm:w-80" role="listbox" aria-live="polite">
        <div className="px-4 py-3 text-center text-xs text-white/40">No results found</div>
      </div>
    )
  }

  return (
    <div
      className="scrollbar-hide mt-3 flex max-h-[calc(100vh-5rem)] w-full flex-col gap-2 overflow-y-auto sm:w-80"
      role="listbox"
      aria-live="polite"
    >
      <div className="px-4 py-2">
        <span className="text-xs font-semibold tracking-widest text-white/40 uppercase">
          {results.length >= MAX_RESULTS ? `${MAX_RESULTS}+` : results.length} result
          {results.length !== 1 ? 's' : ''}
        </span>
      </div>

      {results.map((result) => (
        <button
          key={`${result.layer}-${result.entity.id}`}
          role="option"
          onClick={() => handleSelect(result)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-black/50 px-4 py-3 text-left backdrop-blur-md transition-colors select-none hover:bg-white/10"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white/90">{result.displayName}</p>
            <p className="mt-0.5 text-xs text-white/35">
              {result.layerLabel} &middot; {result.entity.id}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
})
