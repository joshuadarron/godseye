import { memo, useState } from 'react'
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
  type SublayerMap,
} from '../../stores/layerVisibilityStore'
import { layerRegistry, type LayerRegistration } from '../../registries/layerRegistry'

// Import registrations so the registry is populated.
import '../../registries/flights'
import '../../registries/satellites'

/** Static layer entries for layers not yet backed by data (vessels, trains, events). */
const ICON_CLASS = 'w-4 h-4 shrink-0 fill-current'
const PLACEHOLDER_LAYERS: LayerRegistration[] = [
  {
    key: 'vessels',
    label: 'Vessels',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M3 17l2 4h14l2-4H3zM12 3v10M8 7h8l2 6H6l2-6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  } as any,
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
  } as any,
  {
    key: 'events',
    label: 'Events',
    icon: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  } as any,
]

interface LayerConfig {
  key: string
  label: string
  icon: React.ReactNode
  subtypes?: Record<string, string>
}

function buildLayerConfigs(): LayerConfig[] {
  const configs: LayerConfig[] = []

  // Add registered layers first.
  for (const reg of layerRegistry.values()) {
    configs.push({
      key: reg.key,
      label: reg.label,
      icon: reg.icon,
      subtypes: reg.subtypes,
    })
  }

  // Add placeholders for unregistered layers.
  for (const placeholder of PLACEHOLDER_LAYERS) {
    if (!layerRegistry.has(placeholder.key)) {
      configs.push({
        key: placeholder.key,
        label: placeholder.label,
        icon: placeholder.icon,
      })
    }
  }

  return configs
}

const LAYERS = buildLayerConfigs()

const LayerRow = memo(function LayerRow({ layer }: { layer: LayerConfig }) {
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
        className={`flex items-center gap-3 w-full text-left py-2.5 px-4 text-base cursor-pointer select-none transition-colors ${
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
            className={`flex items-center gap-3 w-full text-left py-2.5 px-4 text-base cursor-pointer select-none transition-colors ${
              active
                ? 'text-white font-medium bg-white/10'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {layer.icon}
            <span>{layer.label}</span>
            <svg
              className={`w-4 h-4 shrink-0 fill-current transition-transform duration-200 ${
                open ? 'rotate-90' : ''
              }`}
              viewBox="0 0 24 24"
            >
              <path d="M9 6l6 6-6 6V6z" />
            </svg>
            <span className="flex-1" />
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
            className="pb-1 flex flex-col gap-0.5 origin-top transition duration-200 ease-out data-[closed]:-translate-y-1 data-[closed]:opacity-0"
          >
            {/* All toggle */}
            <button
              onClick={() => setAllSublayers(layer.key, !allSubsOn)}
              className={`block w-full text-left py-2 pl-12 pr-4 text-[15px] cursor-pointer select-none transition-colors ${
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
                  className={`block w-full text-left py-2 pl-12 pr-4 text-[15px] cursor-pointer select-none transition-colors ${
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
})

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
        enterTo="w-72 opacity-100"
        leave="transition-all duration-200 ease-in"
        leaveFrom="w-72 opacity-100"
        leaveTo="w-0 opacity-0"
      >
        <div className="h-full bg-black/60 backdrop-blur-md text-white flex flex-col overflow-hidden border-r border-white/[0.06]">
          <div className="pt-5 pb-3 flex flex-col min-w-72 h-full overflow-y-auto">
            <Field className="px-4">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-4 py-2 mb-4 rounded-md bg-white/5 border border-white/[0.08] text-base text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
              />
            </Field>

            <div className="border-t border-white/[0.08] pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3 px-4">
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
