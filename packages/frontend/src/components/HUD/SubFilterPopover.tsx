import { memo } from 'react'
import { useLayerVisibilityStore, type SublayerMap } from '../../stores/layerVisibilityStore'

interface SubFilterPopoverProps {
  layerKey: string
  subtypes: Record<string, string>
  subtypeIcons?: Record<string, string>
  columnCount: number
}

export default memo(function SubFilterPopover({
  layerKey,
  subtypes,
  subtypeIcons,
  columnCount,
}: SubFilterPopoverProps) {
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[layerKey]) as
    | SublayerMap
    | undefined
  const toggleSublayer = useLayerVisibilityStore((s) => s.toggleSublayer)
  const setAllSublayers = useLayerVisibilityStore((s) => s.setAllSublayers)

  const allOn = sublayerMap ? Object.values(sublayerMap).every(Boolean) : true
  const entries = Object.entries(subtypes)

  return (
    <div
      role="group"
      aria-label="Sub-filters"
      className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/40 shadow-2xl backdrop-blur-md"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${columnCount}, 5rem)` }}>
        <button
          onClick={() => setAllSublayers(layerKey, !allOn)}
          aria-pressed={allOn}
          className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center text-xs font-medium transition-colors select-none ${
            allOn ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white/60'
          }`}
        >
          <svg
            className="h-7 w-7 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
              aria-pressed={active}
              className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center text-xs font-medium transition-colors select-none ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/60'
              }`}
            >
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={subLabel}
                  className={`h-7 w-7 shrink-0 ${active ? 'opacity-100' : 'opacity-40'}`}
                />
              ) : (
                <div className="h-7 w-7" />
              )}
              <span className="mt-1">{subLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
