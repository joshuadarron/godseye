import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { layerRegistry } from '../../registries/layerRegistry'

export default function EntityDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)

  if (!selected) return null

  const reg = layerRegistry.get(selected.layer)
  if (!reg?.detailPanel) return null

  const Panel = reg.detailPanel
  return <Panel entityId={selected.entityId} />
}
