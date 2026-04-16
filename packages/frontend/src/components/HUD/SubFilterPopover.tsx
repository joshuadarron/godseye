import { memo } from 'react'
import type { Color } from 'cesium'
import { useLayerVisibilityStore, type SublayerMap } from '../../stores/layerVisibilityStore'

interface SubFilterPopoverProps {
  layerKey: string
  subtypes: Record<string, string>
  subtypeIcons?: Record<string, string>
  subtypeColors?: Record<string, Color>
  columnCount: number
}

/** Convert a Cesium Color to a CSS rgba string. */
function cesiumColorToCSS(c: Color, alpha?: number): string {
  const r = Math.round(c.red * 255)
  const g = Math.round(c.green * 255)
  const b = Math.round(c.blue * 255)
  return `rgba(${r},${g},${b},${alpha ?? c.alpha})`
}

export default memo(function SubFilterPopover({
  layerKey,
  subtypes,
  subtypeIcons,
  subtypeColors,
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
          const color = subtypeColors?.[subKey]
          const colorCSS = color ? cesiumColorToCSS(color, 1) : undefined

          return (
            <button
              key={subKey}
              onClick={() => toggleSublayer(layerKey, subKey)}
              aria-pressed={active}
              className={`relative flex h-20 w-20 cursor-pointer flex-col items-center justify-center text-xs font-medium transition-colors select-none ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/60'
              }`}
            >
              {iconUrl ? (
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                  <img
                    src={iconUrl}
                    alt={subLabel}
                    className={`h-7 w-7 drop-shadow-[0_0_3px_rgba(255,255,255,0.3)] transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}
                  />
                </div>
              ) : (
                <div className="h-7 w-7" />
              )}
              <span className="mt-1">{subLabel}</span>
              {colorCSS && (
                <span
                  className={`absolute bottom-1 h-0.5 w-6 rounded-full transition-opacity ${active ? 'opacity-80' : 'opacity-20'}`}
                  style={{ backgroundColor: colorCSS }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
})
