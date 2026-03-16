import { memo } from 'react'
import {
  useLayerVisibilityStore,
  type SublayerMap,
} from '../../stores/layerVisibilityStore'

interface SubFilterPopoverProps {
  layerKey: string
  subtypes: Record<string, string>
  subtypeIcons?: Record<string, string>
  columnCount: number
}

export default memo(function SubFilterPopover({ layerKey, subtypes, subtypeIcons, columnCount }: SubFilterPopoverProps) {
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[layerKey]) as SublayerMap | undefined
  const toggleSublayer = useLayerVisibilityStore((s) => s.toggleSublayer)
  const setAllSublayers = useLayerVisibilityStore((s) => s.setAllSublayers)

  const allOn = sublayerMap ? Object.values(sublayerMap).every(Boolean) : true
  const entries = Object.entries(subtypes)

  return (
    <div className="rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.08] shadow-2xl overflow-hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${columnCount}, 5rem)` }}
      >
        <button
          onClick={() => setAllSublayers(layerKey, !allOn)}
          className={`flex flex-col items-center justify-center w-20 h-20 text-xs font-medium cursor-pointer select-none transition-colors ${
            allOn
              ? 'text-white bg-white/10'
              : 'text-white/40 hover:text-white/60 hover:bg-white/5'
          }`}
        >
          <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <span className="mt-1">All</span>
        </button>
        {entries.map(([subKey, subLabel]) => {
          const active = sublayerMap?.[subKey] ?? true
          const iconUrl = subtypeIcons?.[subKey]
          return (
            <button
              key={subKey}
              onClick={() => toggleSublayer(layerKey, subKey)}
              className={`flex flex-col items-center justify-center w-20 h-20 text-xs font-medium cursor-pointer select-none transition-colors ${
                active
                  ? 'text-white bg-white/10'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {iconUrl ? (
                <img src={iconUrl} alt={subLabel} className={`w-7 h-7 shrink-0 ${active ? 'opacity-100' : 'opacity-40'}`} />
              ) : (
                <div className="w-7 h-7" />
              )}
              <span className="mt-1">{subLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
