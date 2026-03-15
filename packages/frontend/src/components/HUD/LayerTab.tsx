import { memo, useRef, useCallback } from 'react'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { useHudStore } from '../../stores/hudStore'
import SubFilterPopover from './SubFilterPopover'
import type { LayerConfig } from './layerConfigs'

const CLOSE_DELAY = 150

export default memo(function LayerTab({ layer }: { layer: LayerConfig }) {
  const active = useLayerVisibilityStore((s) => s.layers[layer.key] ?? true)
  const toggle = useLayerVisibilityStore((s) => s.toggle)
  const openSubFilter = useHudStore((s) => s.openSubFilter)
  const setOpenSubFilter = useHudStore((s) => s.setOpenSubFilter)

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOpen = openSubFilter === layer.key && !!layer.subtypes

  const handleEnter = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    if (layer.subtypes) {
      setOpenSubFilter(layer.key)
    }
  }, [layer.key, layer.subtypes, setOpenSubFilter])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => {
      setOpenSubFilter(null)
    }, CLOSE_DELAY)
  }, [setOpenSubFilter])

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        onClick={() => toggle(layer.key)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer select-none transition-colors ${
          active
            ? 'text-white bg-white/10'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
      >
        {layer.icon}
        <span>{layer.label}</span>
      </button>

      {isOpen && (
        <SubFilterPopover layerKey={layer.key} subtypes={layer.subtypes!} />
      )}
    </div>
  )
})
