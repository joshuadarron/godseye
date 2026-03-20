import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useEarthquakeStore } from '../../stores/earthquakeStore'

export default function EarthquakeTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const earthquakes = useEarthquakeStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'events' || !hoverPosition) return null

  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId)
    return null

  const eq = earthquakes.get(hovered.entityId)
  if (!eq) return null

  const timeAgo = formatTimeAgo(eq.time)

  return (
    <div
      className="pointer-events-none fixed z-[100] rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="mb-2 text-[11px] font-semibold tracking-widest text-white/40 uppercase">
        M{eq.magnitude.toFixed(1)} Earthquake
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TooltipField label="Location" value={eq.place || '—'} />
        <TooltipField label="Depth" value={`${eq.depth.toFixed(1)} km`} />
        <TooltipField label="Time" value={timeAgo} />
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

function formatTimeAgo(isoTime: string): string {
  const diff = Date.now() - new Date(isoTime).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
