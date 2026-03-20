import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useEarthquakeStore } from '../../stores/earthquakeStore'
import { layerRegistry } from '../../registries/layerRegistry'

const DEFAULT_WIDTH = 360

type DragMode = 'move' | null

export default function EarthquakeDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  const PANEL_TOP = 119
  const defaultPos = () => ({ x: window.innerWidth - DEFAULT_WIDTH - 16, y: PANEL_TOP })

  const [pos, setPos] = useState(defaultPos)
  const [initialized, setInitialized] = useState(false)

  const mode = useRef<DragMode>(null)
  const startMouse = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (selected && selected.layer === 'events') {
      setPos(defaultPos())
      setInitialized(true)
    } else {
      setInitialized(false)
    }
  }, [selected])

  const onMoveDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      if ((e.target as HTMLElement).closest('a')) return
      e.preventDefault()
      mode.current = 'move'
      startMouse.current = { x: e.clientX, y: e.clientY }
      startPos.current = { ...pos }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!mode.current) return
    const dx = e.clientX - startMouse.current.x
    const dy = e.clientY - startMouse.current.y
    setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy })
  }, [])

  const onPointerUp = useCallback(() => {
    mode.current = null
  }, [])

  const isOpen = !!(selected && selected.layer === 'events' && initialized)
  const eq = isOpen ? useEarthquakeStore.getState().entities.get(selected!.entityId) : null

  const liveEarthquakes = useEarthquakeStore((s) => s.entities)
  const liveEq = isOpen && selected ? liveEarthquakes.get(selected.entityId) : null
  const e = liveEq ?? eq

  if (!isOpen || !e) return null

  const reg = layerRegistry.get('events')
  let entityIcon = reg?.iconUrl ?? ''
  if (reg?.classifySubtype && reg.subtypeIcons) {
    const subtype = reg.classifySubtype(e)
    entityIcon = reg.subtypeIcons[subtype] ?? entityIcon
  }

  const eventDate = new Date(e.time)
  const timeStr = eventDate.toLocaleString()

  return (
    <div
      className="fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-white/[0.08] shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: DEFAULT_WIDTH }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        onPointerDown={onMoveDown}
        className="flex shrink-0 cursor-grab items-center justify-between border-b border-white/[0.08] bg-black/40 px-4 py-2.5 backdrop-blur-md select-none active:cursor-grabbing"
      >
        <div className="flex min-w-0 items-center gap-2">
          {entityIcon && <img src={entityIcon} alt="" className="h-5 w-5 opacity-60" />}
          <h2 className="truncate text-[11px] font-semibold tracking-widest text-white/40 uppercase">
            M{e.magnitude.toFixed(1)} Earthquake
          </h2>
        </div>
        <Button
          onClick={clearSelected}
          className="shrink-0 cursor-pointer text-lg leading-none text-white/30 transition-colors hover:text-white/60"
        >
          &times;
        </Button>
      </div>

      <div className="bg-black/40 px-4 py-3 text-white backdrop-blur-md">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <DataField label="Magnitude" value={`${e.magnitude.toFixed(1)} ${e.magType}`} />
          <DataField label="Depth" value={`${e.depth.toFixed(1)} km`} />
          <DataField label="Location" value={e.place || '—'} span2 />
          <DataField label="Time" value={timeStr} />
          <DataField label="Status" value={e.status || '—'} />
          <DataField label="Latitude" value={`${e.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${e.lng.toFixed(4)}\u00B0`} />
          <DataField label="Significance" value={String(e.significance)} />
          {e.alert && (
            <DataField
              label="Alert Level"
              value={e.alert.charAt(0).toUpperCase() + e.alert.slice(1)}
            />
          )}
          {e.tsunami > 0 && <DataField label="Tsunami" value="Warning issued" />}
        </div>

        {e.url && (
          <a
            href={e.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-xs text-blue-400 underline hover:text-blue-300"
          >
            View on USGS
          </a>
        )}
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
