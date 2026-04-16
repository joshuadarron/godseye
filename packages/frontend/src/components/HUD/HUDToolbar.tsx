import { useRef, useCallback } from 'react'
import SearchInput from './SearchInput'
import SearchResultsPanel from './SearchResultsPanel'
import LayerTab from './LayerTab'
import SubFilterPopover from './SubFilterPopover'
import { LAYERS } from './layerConfigs'
import { useHudStore } from '../../stores/hudStore'

const CLOSE_DELAY = 150

export default function HUDToolbar() {
  const openSubFilter = useHudStore((s) => s.openSubFilter)
  const setOpenSubFilter = useHudStore((s) => s.setOpenSubFilter)
  const activeLayer = openSubFilter ? LAYERS.find((l) => l.key === openSubFilter) : null

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setOpenSubFilter(null)
    }, CLOSE_DELAY)
  }, [setOpenSubFilter])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="flex items-start gap-4 px-4 py-3">
        {/* Search — left */}
        <div className="pointer-events-auto flex flex-col">
          <SearchInput />
          <SearchResultsPanel />
        </div>

        {/* Layer tabs — center */}
        <div className="flex flex-1 items-center justify-center">
          <div
            className="pointer-events-auto"
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
          >
            <div
              role="tablist"
              aria-label="Data layers"
              className="flex items-center rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md"
            >
              {LAYERS.map((layer) => (
                <LayerTab key={layer.key} layer={layer} />
              ))}
            </div>

            {activeLayer && activeLayer.subtypes && (
              <div className="pt-2">
                <SubFilterPopover
                  layerKey={activeLayer.key}
                  subtypes={activeLayer.subtypes}
                  subtypeIcons={activeLayer.subtypeIcons}
                  subtypeColors={activeLayer.subtypeColors}
                  columnCount={LAYERS.length}
                />
              </div>
            )}
          </div>
        </div>

        {/* Spacer — right (for future controls) */}
        <div className="w-56" />
      </div>
    </div>
  )
}
