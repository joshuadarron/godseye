import { memo, useEffect } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useVesselStore } from '../../stores/vesselStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'
import NearbySection from './NearbySection'

const DEFAULT_WIDTH = 360

export default function VesselDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  const { pos, initialized, resetPosition, onPointerDownHeader, onPointerMove, onPointerUp } =
    useDraggablePanel({ layerKey: 'vessels', onClose: clearSelected })

  useEffect(() => {
    resetPosition(selected?.layer)
  }, [selected, resetPosition])

  const isOpen = !!(selected && selected.layer === 'vessels' && initialized)
  const vessel = isOpen ? useVesselStore.getState().entities.get(selected!.entityId) : null

  const liveVessels = useVesselStore((s) => s.entities)
  const liveVessel = isOpen && selected ? liveVessels.get(selected.entityId) : null
  const v = liveVessel ?? vessel

  if (!isOpen || !v) return null

  const reg = layerRegistry.get('vessels')
  let entityIcon = reg?.iconUrl ?? ''
  if (reg?.classifySubtype && reg.subtypeIcons) {
    const subtype = reg.classifySubtype(v)
    entityIcon = reg.subtypeIcons[subtype] ?? entityIcon
  }

  return (
    <div
      role="dialog"
      aria-label="Vessel details"
      className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: DEFAULT_WIDTH }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        onPointerDown={onPointerDownHeader}
        className="flex shrink-0 cursor-grab items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 py-2.5 backdrop-blur-md select-none active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          {entityIcon && <img src={entityIcon} alt="" className="h-5 w-5 opacity-60" />}
          <h2 className="truncate text-[11px] font-semibold tracking-widest text-white/40 uppercase">
            {v.name || v.id}
          </h2>
        </div>
        <Button
          onClick={clearSelected}
          aria-label="Close panel"
          className="shrink-0 cursor-pointer text-lg leading-none text-white/30 transition-colors hover:text-white/60"
        >
          &times;
        </Button>
      </div>

      <div className="bg-black/40 px-4 py-3 text-white backdrop-blur-md">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <DataField label="MMSI" value={v.id} />
          <DataField label="Name" value={v.name || '—'} />
          <DataField label="Callsign" value={v.callsign || '—'} />
          <DataField label="IMO" value={v.imo ? String(v.imo) : '—'} />
          <DataField label="Type" value={shipTypeLabel(v.shipType)} />
          <DataField label="Nav Status" value={navStatusLabel(v.navStatus)} />
          <DataField label="Latitude" value={`${v.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${v.lng.toFixed(4)}\u00B0`} />
          <DataField label="Speed" value={`${v.speed.toFixed(1)} kn`} />
          <DataField label="Course" value={`${v.course.toFixed(1)}\u00B0`} />
          <DataField label="Heading" value={v.heading ? `${v.heading.toFixed(1)}\u00B0` : '—'} />
          <DataField label="Destination" value={v.destination || '—'} />
          <DataField label="Length" value={v.length ? `${v.length} m` : '—'} />
          <DataField label="Width" value={v.width ? `${v.width} m` : '—'} />
          <DataField label="Draught" value={v.draught ? `${v.draught.toFixed(1)} m` : '—'} />
        </div>
      </div>

      <NearbySection entityId={v.id} />
    </div>
  )
}

const NAV_STATUS_LABELS: Record<number, string> = {
  0: 'Under way (engine)',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuvrability',
  4: 'Constrained by draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way (sailing)',
  14: 'AIS-SART',
  15: 'Not defined',
}

function navStatusLabel(status: number): string {
  return NAV_STATUS_LABELS[status] ?? `Status ${status}`
}

function shipTypeLabel(type_: number): string {
  if (type_ >= 70 && type_ <= 79) return 'Cargo'
  if (type_ >= 80 && type_ <= 89) return 'Tanker'
  if (type_ >= 60 && type_ <= 69) return 'Passenger'
  if (type_ === 30) return 'Fishing'
  if (type_ === 35) return 'Military'
  if (type_ === 31 || type_ === 32) return 'Tug'
  if (type_ >= 36 && type_ <= 37) return 'Sailing / Pleasure'
  if (type_ >= 40 && type_ <= 49) return 'High-speed craft'
  if (type_ === 50) return 'Pilot vessel'
  if (type_ === 51) return 'Search & rescue'
  if (type_ === 52) return 'Tug'
  if (type_ === 53) return 'Port tender'
  if (type_ === 55) return 'Law enforcement'
  if (type_ === 58) return 'Medical transport'
  if (type_ === 0) return 'Not specified'
  return `Type ${type_}`
}

const DataField = memo(function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] tracking-wide text-white/35 uppercase">{label}</span>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
})
