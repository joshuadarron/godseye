import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@headlessui/react'
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
} from 'satellite.js'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 200
const MIN_WIDTH = 260
const MIN_HEIGHT = 140

type DragMode = 'move' | 'resize' | null

export default function SatelliteDetailPanel() {
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
    if (selected && selected.layer === 'satellites') {
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

  const isOpen = !!(selected && selected.layer === 'satellites' && initialized)
  const sat = isOpen ? useSatelliteStore.getState().entities.get(selected!.entityId) : null

  // Local SGP4 propagation for smooth stat updates (100ms).
  const [livePos, setLivePos] = useState<{ lat: number; lng: number; alt: number; vel: number } | null>(null)
  useEffect(() => {
    if (!sat?.tle1 || !sat?.tle2) { setLivePos(null); return }
    const satrec = twoline2satrec(sat.tle1, sat.tle2)
    const tick = () => {
      const now = new Date()
      const posVel = propagate(satrec, now)
      if (!posVel || typeof posVel.position === 'boolean' || typeof posVel.velocity === 'boolean') return
      const gst = gstime(now)
      const geo = eciToGeodetic(posVel.position, gst)
      const lat = degreesLat(geo.latitude)
      const lng = degreesLong(geo.longitude)
      const alt = geo.height
      const vel = Math.sqrt(posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2)
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(alt)) {
        setLivePos({ lat, lng, alt, vel })
      }
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [sat?.tle1, sat?.tle2])

  if (!isOpen || !sat) return null

  const displayLat = livePos?.lat ?? sat.lat
  const displayLng = livePos?.lng ?? sat.lng
  const displayAlt = livePos?.alt ?? sat.altitude
  const displayVel = livePos?.vel ?? sat.velocity

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
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 truncate pr-2">
          {sat.name}
        </h2>
        <Button
          onClick={clearSelected}
          className="text-white/30 hover:text-white/60 text-lg leading-none cursor-pointer shrink-0 transition-colors"
        >
          &times;
        </Button>
      </div>

      <div className="flex-1 bg-black/60 backdrop-blur-md text-white overflow-auto px-4 py-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <DataField label="NORAD ID" value={String(sat.noradId)} />
          <DataField label="Latitude" value={`${displayLat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${displayLng.toFixed(4)}\u00B0`} />
          <DataField label="Altitude" value={`${displayAlt.toFixed(1)} km`} />
          <DataField label="Velocity" value={`${displayVel.toFixed(2)} km/s`} />
        </div>
      </div>

      <div
        onPointerDown={onResizeDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
      >
        <svg
          className="w-full h-full text-white/30 hover:text-white/60 transition-colors"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M14 14H10L14 10V14ZM14 8L8 14H6L14 6V8Z" />
        </svg>
      </div>
    </div>
  )
}

const DataField = memo(function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-white/35 text-[11px] uppercase tracking-wide">{label}</span>
      <p className="text-white/90 text-sm font-medium">{value}</p>
    </div>
  )
})
