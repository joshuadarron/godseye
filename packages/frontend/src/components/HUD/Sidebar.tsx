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
  subtypes?: Record<string, string>
}

const LAYERS: LayerConfig[] = [
  { key: 'flights', label: 'Flights' },
  { key: 'satellites', label: 'Satellites', subtypes: SATELLITE_SUBTYPES },
  { key: 'vessels', label: 'Vessels' },
  { key: 'trains', label: 'Trains' },
  { key: 'events', label: 'Events' },
]

function SubtypeTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`py-1.5 pl-2 text-sm text-left cursor-pointer select-none transition-colors rounded-md ${
        active
          ? 'text-white bg-white/10'
          : 'text-white/35 hover:text-white/60 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )
}

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
        className={`block w-full text-left py-1.5 text-[15px] cursor-pointer select-none transition-colors rounded-md px-2 ${
          active
            ? 'text-white font-medium bg-white/10'
            : 'text-white/40 hover:text-white/60 hover:bg-white/5'
        }`}
      >
        {layer.label}
      </button>
    )
  }

  return (
    <Disclosure defaultOpen={active}>
      {({ open }) => (
        <>
          <div className="flex items-center">
            <DisclosureButton
              className={`flex-1 text-left py-1.5 px-2 text-[15px] cursor-pointer select-none transition-colors rounded-md ${
                active ? 'text-white font-medium' : 'text-white/40 hover:text-white/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg
                  className={`w-3 h-3 text-white/40 transition-transform duration-200 ${
                    open ? 'rotate-90' : ''
                  }`}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M6 3l5 5-5 5V3z" />
                </svg>
                {layer.label}
              </span>
            </DisclosureButton>
            <button
              onClick={() => toggle(layer.key)}
              className={`text-xs px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                active
                  ? 'text-sky-400 hover:text-sky-300'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {active ? 'ON' : 'OFF'}
            </button>
          </div>

          <DisclosurePanel
            transition
            className="pl-5 pb-1 flex flex-col gap-0.5 origin-top transition duration-200 ease-out data-[closed]:-translate-y-1 data-[closed]:opacity-0"
          >
            <SubtypeTab
              active={allSubsOn}
              onClick={() => setAllSublayers(layer.key, !allSubsOn)}
              label="All"
            />

            {Object.entries(layer.subtypes!).map(([subKey, subLabel]) => (
              <SubtypeTab
                key={subKey}
                active={sublayerMap?.[subKey] ?? true}
                onClick={() => toggleSublayer(layer.key, subKey)}
                label={subLabel}
              />
            ))}
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
          <div className="px-5 pt-5 pb-3 flex flex-col min-w-56 h-full overflow-y-auto">
            <Field>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-1.5 mb-4 rounded-md bg-white/5 border border-white/[0.08] text-sm text-white placeholder-white/30 outline-none focus:border-white/20 transition-colors"
              />
            </Field>

            <div className="border-t border-white/[0.08] pt-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-3">
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
