import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

export default function SatelliteTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const satellites = useSatelliteStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'satellites' || !hoverPosition) return null

  // Hide tooltip for the currently selected entity (the modal is already showing its info).
  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId)
    return null

  const sat = satellites.get(hovered.entityId)
  if (!sat) return null

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
        {sat.name}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TooltipField label="Altitude" value={`${sat.altitude.toFixed(1)} km`} />
        <TooltipField label="Velocity" value={`${sat.velocity.toFixed(2)} km/s`} />
        <TooltipField label="NORAD ID" value={String(sat.noradId)} />
      </div>
    </div>
  )
}

function TooltipField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] tracking-wide text-white/35 uppercase">{label}</span>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
}
