import { useState } from 'react'
import {
  useLayerVisibilityStore,
  SATELLITE_SUBTYPES,
  type SublayerMap,
} from '../../stores/layerVisibilityStore'

interface LayerConfig {
  key: string
  label: string
  icon: string
  subtypes?: Record<string, string>
}

const LAYERS: LayerConfig[] = [
  { key: 'flights', label: 'Flights', icon: '\u2708' },
  { key: 'satellites', label: 'Satellites', icon: '\uD83D\uDEF0', subtypes: SATELLITE_SUBTYPES },
  { key: 'vessels', label: 'Vessels', icon: '\u26F5' },
  { key: 'trains', label: 'Trains', icon: '\uD83D\uDE82' },
  { key: 'events', label: 'Events', icon: '\u26A0' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const layers = useLayerVisibilityStore((s) => s.layers)
  const sublayers = useLayerVisibilityStore((s) => s.sublayers)
  const toggle = useLayerVisibilityStore((s) => s.toggle)
  const toggleSublayer = useLayerVisibilityStore((s) => s.toggleSublayer)
  const setAllSublayers = useLayerVisibilityStore((s) => s.setAllSublayers)

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))

  const filteredLayers = search
    ? LAYERS.filter((l) => l.label.toLowerCase().includes(search.toLowerCase()))
    : LAYERS

  return (
    <div className="fixed left-0 top-0 h-full z-50 flex">
      <div
        className={`h-full bg-black/80 backdrop-blur-md text-white flex flex-col transition-all duration-300 overflow-hidden ${
          collapsed ? 'w-0' : 'w-70'
        }`}
      >
        <div className="p-4 flex flex-col gap-3 min-w-70 h-full overflow-y-auto">
          {/* Header */}
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Layers
          </h2>

          {/* Search bar */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search layers..."
            className="w-full px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500 transition-colors"
          />

          {/* Layer list */}
          <div className="flex flex-col gap-0.5">
            {filteredLayers.map((layer) => {
              const active = layers[layer.key] ?? true
              const hasSubtypes = !!layer.subtypes
              const isExpanded = expanded[layer.key] ?? false
              const subs = sublayers[layer.key] as SublayerMap | undefined
              const allSubsOn = subs
                ? Object.values(subs).every(Boolean)
                : true
              const someSubsOff = subs
                ? Object.values(subs).some((v) => !v)
                : false

              return (
                <div key={layer.key}>
                  {/* Top-level layer row */}
                  <div
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer select-none transition-colors ${
                      active
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {/* Expand/collapse arrow for layers with subtypes */}
                    {hasSubtypes ? (
                      <button
                        onClick={() => toggleExpanded(layer.key)}
                        className="w-4 h-4 flex items-center justify-center text-[10px] text-gray-500 hover:text-white transition-transform cursor-pointer"
                        style={{ transform: isExpanded ? 'rotate(90deg)' : undefined }}
                      >
                        &#9654;
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}

                    {/* Icon */}
                    <span className="text-base leading-none">{layer.icon}</span>

                    {/* Label — clicking toggles the layer */}
                    <span
                      className="flex-1 text-sm font-medium"
                      onClick={() => {
                        toggle(layer.key)
                        if (hasSubtypes) {
                          // When toggling off, collapse. When toggling on, expand.
                          if (active) {
                            setExpanded((p) => ({ ...p, [layer.key]: false }))
                          } else {
                            setExpanded((p) => ({ ...p, [layer.key]: true }))
                          }
                        }
                      }}
                    >
                      {layer.label}
                    </span>

                    {/* Toggle indicator */}
                    <div
                      onClick={() => {
                        toggle(layer.key)
                        if (hasSubtypes) {
                          if (active) {
                            setExpanded((p) => ({ ...p, [layer.key]: false }))
                          } else {
                            setExpanded((p) => ({ ...p, [layer.key]: true }))
                          }
                        }
                      }}
                      className={`w-8 h-4 rounded-full flex items-center transition-colors cursor-pointer ${
                        active ? 'bg-blue-500 justify-end' : 'bg-white/15 justify-start'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-white mx-0.5 shadow-sm" />
                    </div>
                  </div>

                  {/* Sublayer dropdown */}
                  {hasSubtypes && isExpanded && active && layer.subtypes && (
                    <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5">
                      {/* Select All row */}
                      <label
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer select-none hover:bg-white/5 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={allSubsOn}
                          ref={(el) => {
                            if (el) el.indeterminate = !allSubsOn && someSubsOff
                          }}
                          onChange={() => setAllSublayers(layer.key, !allSubsOn)}
                          className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                        />
                        <span className="text-gray-300 font-medium">Select All</span>
                      </label>

                      {/* Individual subtypes */}
                      {Object.entries(layer.subtypes).map(([subKey, subLabel]) => {
                        const subActive = subs?.[subKey] ?? true
                        return (
                          <label
                            key={subKey}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs cursor-pointer select-none transition-colors ${
                              subActive
                                ? 'text-white hover:bg-blue-500/10'
                                : 'text-gray-500 hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={subActive}
                              onChange={() => toggleSublayer(layer.key, subKey)}
                              className="accent-blue-500 w-3.5 h-3.5 rounded cursor-pointer"
                            />
                            <span>{subLabel}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Collapse/expand toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="self-center -ml-px h-10 w-6 flex items-center justify-center bg-black/80 backdrop-blur-md text-gray-400 hover:text-white rounded-r cursor-pointer"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '\u203A' : '\u2039'}
      </button>
    </div>
  )
}
