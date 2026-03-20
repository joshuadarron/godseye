import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useVesselStore } from '../../stores/vesselStore'

export default function VesselTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const vessels = useVesselStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'vessels' || !hoverPosition) return null

  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId)
    return null

  const vessel = vessels.get(hovered.entityId)
  if (!vessel) return null

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
        {vessel.name || vessel.id}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TooltipField label="Speed" value={`${vessel.speed.toFixed(1)} kn`} />
        <TooltipField label="Course" value={`${vessel.course.toFixed(1)}\u00B0`} />
        <TooltipField label="Destination" value={vessel.destination || '—'} />
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
