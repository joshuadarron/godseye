import { useCallback, useRef, useState } from 'react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 180
const MAX_HEIGHT = 500
// Sidebar: w-70 (17.5rem), panel starts flush at sidebar edge
const SIDEBAR_LEFT = '17.5rem'

export default function SatelliteDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)
  const satellites = useSatelliteStore((s) => s.satellites)
  const [height, setHeight] = useState(DEFAULT_HEIGHT)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    startY.current = e.clientY
    startH.current = height
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [height])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = startY.current - e.clientY
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH.current + delta)))
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  if (!selected || selected.layer !== 'satellites') return null

  const sat = satellites.get(selected.entityId)
  if (!sat) return null

  return (
    <div
      className="fixed bottom-0 z-[100] animate-slide-up"
      style={{ left: SIDEBAR_LEFT, right: 0, height }}
    >
      {/* Drag handle */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-2 cursor-ns-resize flex items-center justify-center group"
      >
        <div className="w-10 h-1 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
      </div>

      {/* Panel */}
      <div className="h-[calc(100%-0.5rem)] bg-black/80 backdrop-blur-md text-white border-t border-white/10 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <h3 className="font-semibold text-sm">{sat.name}</h3>
          <button
            onClick={clearSelected}
            className="text-gray-400 hover:text-white text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-3 gap-x-6 gap-y-2 px-4 py-3 text-xs">
          <Field label="NORAD ID" value={String(sat.noradId)} />
          <Field label="Latitude" value={`${sat.lat.toFixed(4)}°`} />
          <Field label="Longitude" value={`${sat.lng.toFixed(4)}°`} />
          <Field label="Altitude" value={`${sat.altitude.toFixed(1)} km`} />
          <Field label="Velocity" value={`${sat.velocity.toFixed(2)} km/s`} />
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}</span>
      <p className="text-white font-mono">{value}</p>
    </div>
  )
}
