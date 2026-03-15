import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { layerRegistry } from '../../registries/layerRegistry'

export default function EntityTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const selected = useSelectedEntityStore((s) => s.selected)

  // Hide tooltips while a detail panel is open.
  if (selected) return null
  if (!hovered) return null

  const reg = layerRegistry.get(hovered.layer)
  if (!reg?.tooltip) return null

  const Tooltip = reg.tooltip
  return <Tooltip entityId={hovered.entityId} />
}
