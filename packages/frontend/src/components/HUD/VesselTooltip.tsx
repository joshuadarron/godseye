import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useVesselStore } from '../../stores/vesselStore'

export default function VesselTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const vessels = useVesselStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'vessels' || !hoverPosition) return null

  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId) return null

  const vessel = vessels.get(hovered.entityId)
  if (!vessel) return null

  return (
    <div
      className="fixed z-[100] pointer-events-none px-4 py-3 rounded-xl bg-black/40 backdrop-blur-md text-white shadow-2xl border border-white/[0.08]"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
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
      <span className="text-white/35 text-[11px] uppercase tracking-wide">{label}</span>
      <p className="text-white/90 text-sm font-medium">{value}</p>
    </div>
  )
}
