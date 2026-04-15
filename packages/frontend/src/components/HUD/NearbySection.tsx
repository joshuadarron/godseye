import { memo } from 'react'
import { useNearby } from '../../hooks/useNearby'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { getViewer } from '../../utils/viewerRef'
import { Cartesian3 } from 'cesium'

const TYPE_LABELS: Record<string, string> = {
  Flight: 'Flight',
  Satellite: 'Satellite',
  Vessel: 'Vessel',
}

interface Props {
  entityId: string
}

/**
 * "Nearby" section for detail panels. Shows entities connected via
 * NEAR edges in the graph. Each entry has a focus button to fly to it.
 */
function NearbySection({ entityId }: Props) {
  const { nearby, loading } = useNearby(entityId)
  const setSelected = useSelectedEntityStore((s) => s.setSelected)

  if (loading && nearby.length === 0) {
    return (
      <div className="border-t border-white/[0.08] px-4 py-2">
        <span className="text-[11px] tracking-wide text-white/35 uppercase">Nearby</span>
        <p className="mt-1 text-xs text-white/50">Loading...</p>
      </div>
    )
  }

  if (nearby.length === 0) return null

  const handleFocus = (entity: (typeof nearby)[0]) => {
    const viewer = getViewer()
    if (!viewer) return

    // Fly to entity position.
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(entity.lng, entity.lat, entity.altitude + 50000),
      duration: 1.5,
    })

    // Select the entity.
    const layerKey =
      entity.type === 'Flight' ? 'flights' : entity.type === 'Satellite' ? 'satellites' : 'vessels'
    setSelected({ layer: layerKey, entityId: entity.id })
  }

  return (
    <div className="border-t border-white/[0.08] px-4 py-2">
      <span className="text-[11px] tracking-wide text-white/35 uppercase">Nearby</span>
      <div className="mt-1 space-y-1">
        {nearby.slice(0, 8).map((e) => (
          <button
            key={e.id}
            onClick={() => handleFocus(e)}
            className="flex w-full items-center justify-between rounded px-2 py-1 text-xs text-white/80 transition-colors hover:bg-white/10"
          >
            <span className="truncate">
              <span className="text-white/50">{TYPE_LABELS[e.type] ?? e.type}</span> {e.id}
            </span>
            <span className="ml-2 shrink-0 text-white/40">{e.distKm.toFixed(1)} km</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default memo(NearbySection)
