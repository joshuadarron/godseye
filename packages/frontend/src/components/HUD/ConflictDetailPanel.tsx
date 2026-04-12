import { memo, useEffect } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useConflictStore } from '../../stores/conflictStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'

const DEFAULT_WIDTH = 360

export default function ConflictDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  const { pos, initialized, resetPosition, onPointerDownHeader, onPointerMove, onPointerUp } =
    useDraggablePanel({ layerKey: 'conflicts', onClose: clearSelected })

  useEffect(() => {
    resetPosition(selected?.layer)
  }, [selected, resetPosition])

  const isOpen = !!(selected && selected.layer === 'conflicts' && initialized)
  const conflict = isOpen ? useConflictStore.getState().entities.get(selected!.entityId) : null

  const liveConflicts = useConflictStore((s) => s.entities)
  const liveConflict = isOpen && selected ? liveConflicts.get(selected.entityId) : null
  const c = liveConflict ?? conflict

  if (!isOpen || !c) return null

  const reg = layerRegistry.get('conflicts')
  let entityIcon = reg?.iconUrl ?? ''
  if (reg?.classifySubtype && reg.subtypeIcons) {
    const subtype = reg.classifySubtype(c)
    entityIcon = reg.subtypeIcons[subtype] ?? entityIcon
  }

  return (
    <div
      role="dialog"
      aria-label="Conflict details"
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
            {c.eventType}
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
          <DataField label="Event Type" value={c.eventType || '—'} />
          <DataField label="Sub-Event Type" value={c.subEventType || '—'} />
          <DataField label="Date" value={c.eventDate || '—'} />
          <DataField label="Fatalities" value={String(c.fatalities)} />
          <DataField label="Location" value={c.location || '—'} span2 />
          <DataField label="Country" value={c.country || '—'} />
          <DataField label="Region" value={c.admin1 || '—'} />
          <DataField label="Actor 1" value={c.actor1 || '—'} span2 />
          {c.actor2 && <DataField label="Actor 2" value={c.actor2} span2 />}
          <DataField label="Latitude" value={`${c.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${c.lng.toFixed(4)}\u00B0`} />
          <DataField label="Source" value={c.source || '—'} span2 />
          {c.notes && <DataField label="Notes" value={c.notes} span2 />}
        </div>
      </div>
    </div>
  )
}

const DataField = memo(function DataField({
  label,
  value,
  span2,
}: {
  label: string
  value: string
  span2?: boolean
}) {
  return (
    <div className={span2 ? 'col-span-2' : undefined}>
      <span className="text-[11px] tracking-wide text-white/35 uppercase">{label}</span>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
})
