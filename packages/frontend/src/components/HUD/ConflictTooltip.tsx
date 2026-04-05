import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useConflictStore } from '../../stores/conflictStore'

export default function ConflictTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const conflicts = useConflictStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'conflicts' || !hoverPosition) return null

  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId)
    return null

  const c = conflicts.get(hovered.entityId)
  if (!c) return null

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
        {c.eventType}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TooltipField label="Location" value={c.location || '—'} />
        <TooltipField label="Date" value={c.eventDate || '—'} />
        <TooltipField label="Fatalities" value={String(c.fatalities)} />
        <TooltipField label="Country" value={c.country || '—'} />
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
