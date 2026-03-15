import SearchInput from './SearchInput'
import SearchResultsPanel from './SearchResultsPanel'
import LayerTab from './LayerTab'
import { LAYERS } from './layerConfigs'

export default function HUDToolbar() {
  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <div className="flex items-start gap-4 px-4 py-3">
        {/* Search — left */}
        <div className="pointer-events-auto flex flex-col">
          <SearchInput />
          <SearchResultsPanel />
        </div>

        {/* Layer tabs — center */}
        <div className="flex-1 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.08] overflow-hidden">
            {LAYERS.map((layer) => (
              <LayerTab key={layer.key} layer={layer} />
            ))}
          </div>
        </div>

        {/* Spacer — right (for future controls) */}
        <div className="w-56" />
      </div>
    </div>
  )
}
