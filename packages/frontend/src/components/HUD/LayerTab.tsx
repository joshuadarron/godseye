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
        onClick={() => toggle(layer.key)}
        className={`flex flex-col items-center justify-center w-20 h-20 text-xs font-medium cursor-pointer select-none transition-colors ${
          active
            ? 'text-white bg-white/10'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
      >
        {layer.icon}
        <span className="mt-1">{layer.label}</span>
      </button>
    </div>
  )
})
