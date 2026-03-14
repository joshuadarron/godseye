import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore, type ScreenRect } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 200
const MIN_WIDTH = 260
const MIN_HEIGHT = 140
const GAP = 20
/** Must match sidebar w-72 (18rem = 288px). */
const SIDEBAR_WIDTH = 288

type DragMode = 'move' | 'resize' | null

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Globe-safe viewport bounds (excludes the sidebar). */
function globeBounds() {
  const left = SIDEBAR_WIDTH
  const right = window.innerWidth
  const top = 0
  const bottom = window.innerHeight
  return { left, right, top, bottom }
}

/**
 * Pick the side (right, left, below, above) of the orbit bounding box
 * that has the largest area, then place the modal there.
 */
function positionAroundOrbit(
  bounds: ScreenRect,
  clickX: number,
  clickY: number,
  w: number,
  h: number,
) {
  const g = globeBounds()
  const gw = g.right - g.left
  const gh = g.bottom - g.top

  // Available space on each side of the orbit bbox within the globe viewport.
  const spaceRight = g.right - bounds.maxX - GAP
  const spaceLeft = bounds.minX - g.left - GAP
  const spaceBelow = g.bottom - bounds.maxY - GAP
  const spaceAbove = bounds.minY - g.top - GAP

  type Placement = { x: number; y: number }
  const candidates: { area: number; pos: Placement }[] = []

  // Right of orbit.
  if (spaceRight >= w) {
    candidates.push({
      area: spaceRight * gh,
      pos: {
        x: bounds.maxX + GAP,
        y: clamp(clickY - h / 2, g.top + GAP, g.bottom - h - GAP),
      },
    })
  }

  // Left of orbit.
  if (spaceLeft >= w) {
    candidates.push({
      area: spaceLeft * gh,
      pos: {
        x: Math.max(g.left + GAP, bounds.minX - GAP - w),
        y: clamp(clickY - h / 2, g.top + GAP, g.bottom - h - GAP),
      },
    })
  }

  // Below orbit.
  if (spaceBelow >= h) {
    candidates.push({
      area: gw * spaceBelow,
      pos: {
        x: clamp(clickX - w / 2, g.left + GAP, g.right - w - GAP),
        y: bounds.maxY + GAP,
      },
    })
  }

  // Above orbit.
  if (spaceAbove >= h) {
    candidates.push({
      area: gw * spaceAbove,
      pos: {
        x: clamp(clickX - w / 2, g.left + GAP, g.right - w - GAP),
        y: bounds.minY - GAP - h,
      },
    })
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.area - a.area)
    const best = candidates[0].pos
    return { x: Math.round(best.x), y: Math.round(best.y) }
  }

  // Fallback: place to the right of the click point within globe area.
  return {
    x: Math.round(clamp(clickX + GAP, g.left + GAP, g.right - w - GAP)),
    y: Math.round(clamp(clickY - h / 2, g.top + GAP, g.bottom - h - GAP)),
  }
}

/** Simple fallback when no orbit bounds are available. */
function positionNearClick(clickX: number, clickY: number, w: number, h: number) {
  const g = globeBounds()

  let x = clickX + GAP
  if (x + w > g.right - GAP) x = clickX - w - GAP
  x = clamp(x, g.left + GAP, g.right - w - GAP)

  const y = clamp(clickY - h / 2, g.top + GAP, g.bottom - h - GAP)
  return { x: Math.round(x), y: Math.round(y) }
}

export default function SatelliteDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const screenPos = useSelectedEntityStore((s) => s.selectedScreenPosition)
  const orbitBounds = useSelectedEntityStore((s) => s.orbitScreenBounds)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)
  const satellites = useSatelliteStore((s) => s.entities)

  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })
  const [initialized, setInitialized] = useState(false)
  const waitingForBounds = useRef(false)

  const mode = useRef<DragMode>(null)
  const startMouse = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ w: 0, h: 0 })

  // When selection changes, flag that we need bounds before positioning.
  useEffect(() => {
    if (selected && selected.layer === 'satellites') {
      waitingForBounds.current = true
      setSize({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT })
    } else {
      setInitialized(false)
      waitingForBounds.current = false
    }
  }, [selected])

  // Position once orbit bounds arrive (or after a short fallback timeout).
  useEffect(() => {
    if (!selected || selected.layer !== 'satellites') return
    if (!waitingForBounds.current) return

    const clickX = screenPos?.x ?? window.innerWidth / 2
    const clickY = screenPos?.y ?? window.innerHeight / 2

    if (orbitBounds) {
      // Bounds available — position around the trajectory.
      waitingForBounds.current = false
      setPos(positionAroundOrbit(orbitBounds, clickX, clickY, DEFAULT_WIDTH, DEFAULT_HEIGHT))
      setInitialized(true)
      return
    }

    // Fallback: if bounds don't arrive within 100ms, position near click.
    const timer = setTimeout(() => {
      if (waitingForBounds.current) {
        waitingForBounds.current = false
        setPos(positionNearClick(clickX, clickY, DEFAULT_WIDTH, DEFAULT_HEIGHT))
        setInitialized(true)
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [selected, screenPos, orbitBounds])

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
      setPos({
        x: startPos.current.x + dx,
        y: startPos.current.y + dy,
      })
    } else if (mode.current === 'resize') {
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
  const sat = isOpen ? satellites.get(selected!.entityId) : null

  if (!isOpen || !sat) return null

  return (
    <div
      className="fixed z-[100] flex flex-col rounded-lg overflow-hidden border border-white/[0.06] shadow-2xl"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
      }}
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
          <DataField label="Latitude" value={`${sat.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${sat.lng.toFixed(4)}\u00B0`} />
          <DataField label="Altitude" value={`${sat.altitude.toFixed(1)} km`} />
          <DataField label="Velocity" value={`${sat.velocity.toFixed(2)} km/s`} />
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
