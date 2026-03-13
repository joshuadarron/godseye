import { useState } from 'react'
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Input,
  Field,
  Button,
  Transition,
} from '@headlessui/react'
import {
  useLayerVisibilityStore,
  SATELLITE_SUBTYPES,
  type SublayerMap,
} from '../../stores/layerVisibilityStore'

interface LayerConfig {
  key: string
  label: string
  icon: React.ReactNode
  subtypes?: Record<string, string>
}

const ICON_CLASS = 'w-4 h-4 shrink-0 fill-current'

const LAYERS: LayerConfig[] = [
  {
    key: 'flights',
    label: 'Flights',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
      </svg>
    ),
  },
  {
    key: 'satellites',
    label: 'Satellites',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M6.6 11.4 1 16l4-1-1 4 4.6-5.6M2 2l2.5 2.5M7 3l-1 2M3 7l2-1M17.4 12.6 23 8l-4 1 1-4-4.6 5.6M22 22l-2.5-2.5M17 21l1-2M21 17l-2 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    subtypes: SATELLITE_SUBTYPES,
  },
  {
    key: 'vessels',
    label: 'Vessels',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M3 17l2 4h14l2-4H3zM12 3v10M8 7h8l2 6H6l2-6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'trains',
    label: 'Trains',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M8 21l-2-3M16 21l2-3M7 4h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM4 12h16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.5" cy="15" r="1" fill="currentColor" />
        <circle cx="15.5" cy="15" r="1" fill="currentColor" />
        <path d="M9 4h6v4H9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'events',
    label: 'Events',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

function LayerRow({ layer }: { layer: LayerConfig }) {
  const active = useLayerVisibilityStore((s) => s.layers[layer.key] ?? true)
  const sublayerMap = useLayerVisibilityStore((s) => s.sublayers[layer.key]) as SublayerMap | undefined
  const toggle = useLayerVisibilityStore((s) => s.toggle)
  const toggleSublayer = useLayerVisibilityStore((s) => s.toggleSublayer)
  const setAllSublayers = useLayerVisibilityStore((s) => s.setAllSublayers)

  const hasSubtypes = !!layer.subtypes
  const allSubsOn = sublayerMap ? Object.values(sublayerMap).every(Boolean) : true

  if (!hasSubtypes || !layer.subtypes) {
    return (
      <button
        onClick={() => toggle(layer.key)}
        className={`flex items-center gap-2.5 w-full text-left py-2 px-3 text-[15px] cursor-pointer select-none transition-colors rounded-md ${
          active
            ? 'text-white font-medium bg-white/10'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
      >
        {layer.icon}
        {layer.label}
      </button>
    )
  }

  return (
    <Disclosure defaultOpen={active}>
      {({ open }) => (
        <>
          {/* Top-level row — same style as other layers, full width */}
          <DisclosureButton
            className={`flex items-center w-full text-left py-2 px-3 text-[15px] cursor-pointer select-none transition-colors rounded-md ${
              active
                ? 'text-white font-medium bg-white/10'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            <svg
              className={`w-3 h-3 mr-2 text-white/40 transition-transform duration-200 shrink-0 ${
                open ? 'rotate-90' : ''
              }`}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6 3l5 5-5 5V3z" />
            </svg>
            <span className="mr-1">{layer.icon}</span>
            <span className="flex-1">{layer.label}</span>
            <span
              onClick={(e) => {
                e.stopPropagation()
                toggle(layer.key)
              }}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                active
                  ? 'text-sky-400 hover:text-sky-300'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {active ? 'ON' : 'OFF'}
            </span>
          </DisclosureButton>

          <DisclosurePanel
            transition
            className="pl-5 pb-1 flex flex-col gap-0.5 origin-top transition duration-200 ease-out data-[closed]:-translate-y-1 data-[closed]:opacity-0"
          >
            {/* All toggle */}
            <button
              onClick={() => setAllSublayers(layer.key, !allSubsOn)}
              className={`block w-full text-left py-1.5 px-3 text-sm cursor-pointer select-none transition-colors rounded-md ${
                allSubsOn
                  ? 'text-white bg-white/10'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              All
            </button>

            {/* Individual subtypes */}
            {Object.entries(layer.subtypes!).map(([subKey, subLabel]) => {
              const subActive = sublayerMap?.[subKey] ?? true
              return (
                <button
                  key={subKey}
                  onClick={() => toggleSublayer(layer.key, subKey)}
                  className={`block w-full text-left py-1.5 px-3 text-sm cursor-pointer select-none transition-colors rounded-md ${
                    subActive
                      ? 'text-white bg-white/10'
                      : 'text-white/35 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  {subLabel}
                </button>
              )
            })}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const filteredLayers = search
    ? LAYERS.filter((l) => l.label.toLowerCase().includes(search.toLowerCase()))
    : LAYERS

  return (
    <div className="fixed left-0 top-0 h-full z-50 flex">
      <Transition
        show={!collapsed}
        enter="transition-all duration-300 ease-out"
        enterFrom="w-0 opacity-0"
        enterTo="w-56 opacity-100"
        leave="transition-all duration-200 ease-in"
        leaveFrom="w-56 opacity-100"
        leaveTo="w-0 opacity-0"
      >
        <div className="h-full bg-black/60 backdrop-blur-md text-white flex flex-col overflow-hidden border-r border-white/[0.06]">
          <div className="px-3 pt-5 pb-3 flex flex-col min-w-56 h-full overflow-y-auto">
            <Field>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-1.5 mb-4 rounded-md bg-white/5 border border-white/[0.08] text-sm text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
              />
            </Field>

            <div className="border-t border-white/[0.08] pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3 px-3">
                Layers
              </h3>
              <nav className="flex flex-col gap-0.5">
                {filteredLayers.map((layer) => (
                  <LayerRow key={layer.key} layer={layer} />
                ))}
              </nav>
            </div>
          </div>
        </div>
      </Transition>

      <Button
        onClick={() => setCollapsed((c) => !c)}
        className="self-center -ml-px h-10 w-6 flex items-center justify-center bg-black/60 backdrop-blur-md border border-white/[0.06] border-l-0 text-white/40 hover:text-white rounded-r cursor-pointer"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '\u203A' : '\u2039'}
      </Button>
    </div>
  )
}
