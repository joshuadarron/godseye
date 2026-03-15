import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useFlightStore } from '../../stores/flightStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { lookupRoute } from '../../utils/routeLookup'
import type { FlightRoute } from '../../utils/routeLookup'
import { lookupAircraft } from '../../utils/aircraftLookup'
import type { AircraftMeta } from '../../utils/aircraftLookup'

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 240
const MIN_WIDTH = 260
const MIN_HEIGHT = 160

type DragMode = 'move' | 'resize' | null

export default function FlightDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  // Align with the search results panel: toolbar py-3 (12px) + search bar (~44px) + mt-3 (12px) = 68px.
const PANEL_TOP = 119
const defaultPos = () => ({ x: window.innerWidth - DEFAULT_WIDTH - 16, y: PANEL_TOP })

  const [pos, setPos] = useState(defaultPos)
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })
  const [initialized, setInitialized] = useState(false)

  const mode = useRef<DragMode>(null)
  const startMouse = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ w: 0, h: 0 })

  useEffect(() => {
    if (selected && selected.layer === 'flights') {
      setSize({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })
      setPos(defaultPos())
      setInitialized(true)
    } else {
      setInitialized(false)
    }
  }, [selected])

  const onMoveDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    mode.current = 'move'
    startMouse.current = { x: e.clientX, y: e.clientY }
    startPos.current = { ...pos }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [pos])

  const onResizeDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    mode.current = 'resize'
    startMouse.current = { x: e.clientX, y: e.clientY }
    startSize.current = { ...size }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [size])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!mode.current) return
    const dx = e.clientX - startMouse.current.x
    const dy = e.clientY - startMouse.current.y
    if (mode.current === 'move') {
      setPos({ x: startPos.current.x + dx, y: startPos.current.y + dy })
    } else {
      setSize({
        w: Math.max(MIN_WIDTH, startSize.current.w + dx),
        h: Math.max(MIN_HEIGHT, startSize.current.h + dy),
      })
    }
  }, [])

  const onPointerUp = useCallback(() => {
    mode.current = null
  }, [])

  const [route, setRoute] = useState<FlightRoute | null>(null)
  const [aircraft, setAircraft] = useState<AircraftMeta | null>(null)

  useEffect(() => {
    if (!selected || selected.layer !== 'flights') { setRoute(null); setAircraft(null); return }
    const flight = useFlightStore.getState().entities.get(selected.entityId)
    let cancelled = false

    if (flight?.callsign) {
      lookupRoute(flight.callsign, flight.lat, flight.lng).then((r) => {
        if (!cancelled) setRoute(r)
      })
    } else {
      setRoute(null)
    }

    lookupAircraft(selected.entityId).then((a) => {
      if (!cancelled) setAircraft(a)
    })

    return () => { cancelled = true }
  }, [selected])

  const isOpen = !!(selected && selected.layer === 'flights' && initialized)
  const flight = isOpen ? useFlightStore.getState().entities.get(selected!.entityId) : null

  // Subscribe to store updates for live data.
  const liveFlights = useFlightStore((s) => s.entities)
  const liveFlight = isOpen && selected ? liveFlights.get(selected.entityId) : null
  const f = liveFlight ?? flight

  if (!isOpen || !f) return null

  const reg = layerRegistry.get('flights')
  let entityIcon = reg?.iconUrl ?? ''
  if (reg?.classifySubtype && reg.subtypeIcons) {
    const subtype = reg.classifySubtype(f)
    entityIcon = reg.subtypeIcons[subtype] ?? entityIcon
  }

  return (
    <div
      className="fixed z-[100] flex flex-col rounded-lg overflow-hidden border border-white/[0.06] shadow-2xl"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        onPointerDown={onMoveDown}
        className="flex items-center justify-between px-4 py-2.5 bg-black/60 backdrop-blur-md cursor-grab active:cursor-grabbing select-none border-b border-white/[0.06] shrink-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          {entityIcon && <img src={entityIcon} alt="" className="w-5 h-5 opacity-60" />}
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 truncate">
            {f.callsign || f.id}
          </h2>
        </div>
        <Button
          onClick={clearSelected}
          className="text-white/30 hover:text-white/60 text-lg leading-none cursor-pointer shrink-0 transition-colors"
        >
          &times;
        </Button>
      </div>

      <div className="flex-1 bg-black/60 backdrop-blur-md text-white overflow-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <DataField label="ICAO" value={f.id} />
          <DataField label="Callsign" value={f.callsign || '—'} />
          <DataField label="Registration" value={aircraft?.reg || '—'} />
          <DataField label="Type" value={aircraft ? `${aircraft.type}${aircraft.model ? ` — ${aircraft.model}` : ''}` : '—'} />
          <DataField label="Operator" value={aircraft?.op || '—'} />
          <DataField label="Origin" value={f.originCountry || '—'} />
          <DataField label="Source" value={f.source} />
          <DataField label="Category" value={categoryLabel(f.category)} />
          <DataField label="Latitude" value={`${f.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${f.lng.toFixed(4)}\u00B0`} />
          <DataField label="Baro Alt." value={f.onGround ? 'Ground' : `${Math.round(f.altitude * 3.281).toLocaleString()} ft`} />
          <DataField label="Geo Alt." value={f.onGround ? 'Ground' : `${Math.round(f.geoAltitude * 3.281).toLocaleString()} ft`} />
          <DataField label="Speed" value={`${f.velocity.toFixed(1)} m/s`} />
          <DataField label="Heading" value={`${f.heading.toFixed(1)}\u00B0`} />
          <DataField label="Vert. Rate" value={formatVerticalRate(f.verticalRate)} />
          <DataField label="Squawk" value={f.squawk || '—'} />
          <DataField label="Status" value={f.onGround ? 'On Ground' : 'Airborne'} />
          <DataField label="Departure" value={route ? `${route.departure.name} (${route.departure.icao})` : '—'} />
          <DataField label="Arrival" value={route ? `${route.arrival.name} (${route.arrival.icao})` : '—'} />
        </div>
      </div>

      <div
        onPointerDown={onResizeDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
      >
        <svg className="w-full h-full text-white/30 hover:text-white/60 transition-colors" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 14H10L14 10V14ZM14 8L8 14H6L14 6V8Z" />
        </svg>
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<number, string> = {
  0: 'No info',
  1: 'No category',
  2: 'Light',
  3: 'Small',
  4: 'Large',
  5: 'High vortex',
  6: 'Heavy',
  7: 'High perf',
  8: 'Rotorcraft',
  9: 'Glider',
  10: 'Lighter-than-air',
  11: 'Parachutist',
  12: 'Ultralight',
  14: 'UAV',
  15: 'Space vehicle',
}

function categoryLabel(cat: number): string {
  return CATEGORY_LABELS[cat] ?? `Cat ${cat}`
}

function formatVerticalRate(rate: number): string {
  if (rate === 0) return '0 ft/min'
  const ftPerMin = Math.round(rate * 196.85)
  return `${ftPerMin > 0 ? '+' : ''}${ftPerMin.toLocaleString()} ft/min`
}

const DataField = memo(function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/35 text-[11px] uppercase tracking-wide">{label}</span>
      <p className="text-white/90 text-sm font-medium">{value}</p>
    </div>
  )
})
