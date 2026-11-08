import { useEffect, useMemo, useRef } from 'react'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { creditContainer } from '../../utils/creditContainer'
import { visibleAttributions } from '../../utils/attributions'

/**
 * Credits the basemap and the data behind whatever is currently on screen.
 *
 * Providers require attribution, and until now the app hid Cesium's credit
 * container outright and named no data source anywhere.
 */
export default function SourcesControl() {
  const layers = useLayerVisibilityStore((s) => s.layers)
  // Derived in a memo rather than returned from the selector: zustand v5 would
  // loop on a fresh array identity, and nothing in this codebase uses useShallow.
  const sources = useMemo(() => visibleAttributions(layers, layerRegistry), [layers])
  const creditSlot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // appendChild moves the node rather than copying it, so a StrictMode
    // remount re-parents the same element instead of duplicating credits.
    creditSlot.current?.appendChild(creditContainer)
  }, [])

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40">
      <div className="pointer-events-auto max-w-xs rounded-lg border border-white/[0.08] bg-black/40 px-3 py-1.5 backdrop-blur-md">
        <div ref={creditSlot} className="cesium-credit-slot text-xs text-white/40" />
        {sources.length > 0 && (
          <ul
            aria-label="Data sources"
            className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-white/50"
          >
            {sources.map((source) => (
              <li key={source.label}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="transition-colors hover:text-white/80"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
