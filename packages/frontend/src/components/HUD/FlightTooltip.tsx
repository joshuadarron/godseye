import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useFlightStore } from '../../stores/flightStore'

export default function FlightTooltip() {
  const hovered = useSelectedEntityStore((s) => s.hovered)
  const hoverPosition = useSelectedEntityStore((s) => s.hoverPosition)
  const selected = useSelectedEntityStore((s) => s.selected)
  const flights = useFlightStore((s) => s.entities)

  if (!hovered || hovered.layer !== 'flights' || !hoverPosition) return null

  // Hide tooltip for the currently selected entity (the modal is already showing its info).
  if (selected && selected.layer === hovered.layer && selected.entityId === hovered.entityId) return null

  const flight = flights.get(hovered.entityId)
  if (!flight) return null

  return (
    <div
      className="fixed z-[100] pointer-events-none px-4 py-3 rounded-xl bg-black/40 backdrop-blur-md text-white shadow-2xl border border-white/[0.08]"
      style={{ left: hoverPosition.x + 14, top: hoverPosition.y - 14 }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
        {flight.callsign || flight.id}
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <TooltipField label="Altitude" value={flight.onGround ? 'Ground' : `${flight.altitude.toFixed(0)} m`} />
        <TooltipField label="Speed" value={`${flight.velocity.toFixed(0)} m/s`} />
        <TooltipField label="Origin" value={flight.originCountry} />
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
