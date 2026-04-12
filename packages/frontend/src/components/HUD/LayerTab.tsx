import { memo } from 'react'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { useHudStore } from '../../stores/hudStore'
import type { LayerConfig } from './layerConfigs'

export default memo(function LayerTab({ layer }: { layer: LayerConfig }) {
  const active = useLayerVisibilityStore((s) => s.layers[layer.key] ?? true)
  const toggle = useLayerVisibilityStore((s) => s.toggle)
  const setOpenSubFilter = useHudStore((s) => s.setOpenSubFilter)

  const handleEnter = () => {
    if (layer.subtypes) {
      setOpenSubFilter(layer.key)
    }
  }

  return (
    <div onMouseEnter={handleEnter}>
      <button
        role="tab"
        aria-selected={active}
        tabIndex={0}
        onClick={() => toggle(layer.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle(layer.key)
          }
        }}
        className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center text-xs font-medium transition-colors select-none ${
          active ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/60'
        }`}
      >
        {layer.icon}
        <span className="mt-1">{layer.label}</span>
      </button>
    </div>
  )
})
