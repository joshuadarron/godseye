import { memo } from 'react'
import {
  useLayerVisibilityStore,
  type SublayerMap,
} from '../../stores/layerVisibilityStore'

interface SubFilterPopoverProps {
  layerKey: string
  subtypes: Record<string, string>
}

export default memo(function SubFilterPopover({ layerKey, subtypes }: SubFilterPopoverProps) {
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[layerKey]) as SublayerMap | undefined
  const toggleSublayer = useLayerVisibilityStore((s) => s.toggleSublayer)
  const setAllSublayers = useLayerVisibilityStore((s) => s.setAllSublayers)

  const allOn = sublayerMap ? Object.values(sublayerMap).every(Boolean) : true

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/[0.08] shadow-2xl min-w-[200px] z-50">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setAllSublayers(layerKey, !allOn)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer select-none transition-colors ${
            allOn
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
          }`}
        >
          All
        </button>
        {Object.entries(subtypes).map(([subKey, subLabel]) => {
          const active = sublayerMap?.[subKey] ?? true
          return (
            <button
              key={subKey}
              onClick={() => toggleSublayer(layerKey, subKey)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer select-none transition-colors ${
                active
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/40 hover:text-white/60 hover:bg-white/10'
              }`}
            >
              {subLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
})
