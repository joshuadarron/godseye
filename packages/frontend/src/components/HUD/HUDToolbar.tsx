import SearchInput from './SearchInput'
import LayerTab from './LayerTab'
import { LAYERS } from './layerConfigs'

export default function HUDToolbar() {
  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Search — left */}
        <div className="pointer-events-auto">
          <SearchInput />
        </div>

        {/* Layer tabs — center */}
        <div className="flex-1 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center gap-1 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/[0.08]">
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
