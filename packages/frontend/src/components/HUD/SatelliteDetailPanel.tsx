import { memo, useEffect, useState } from 'react'
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
import { layerRegistry } from '../../registries/layerRegistry'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'

const DEFAULT_WIDTH = 360

export default function SatelliteDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  const { pos, initialized, resetPosition, onPointerDownHeader, onPointerMove, onPointerUp } =
    useDraggablePanel({ layerKey: 'satellites', onClose: clearSelected })

  useEffect(() => {
    resetPosition(selected?.layer)
  }, [selected, resetPosition])

  const isOpen = !!(selected && selected.layer === 'satellites' && initialized)
  const sat = isOpen ? useSatelliteStore.getState().entities.get(selected!.entityId) : null

  // Local SGP4 propagation for smooth stat updates (100ms).
  const [livePos, setLivePos] = useState<{
    lat: number
    lng: number
    alt: number
    vel: number
  } | null>(null)
  useEffect(() => {
    if (!sat?.tle1 || !sat?.tle2) {
      setLivePos(null)
      return
    }
    const satrec = twoline2satrec(sat.tle1, sat.tle2)
    const tick = () => {
      const now = new Date()
      const posVel = propagate(satrec, now)
      if (!posVel || typeof posVel.position === 'boolean' || typeof posVel.velocity === 'boolean')
        return
      const gst = gstime(now)
      const geo = eciToGeodetic(posVel.position, gst)
      const lat = degreesLat(geo.latitude)
      const lng = degreesLong(geo.longitude)
      const alt = geo.height
      const vel = Math.sqrt(
        posVel.velocity.x ** 2 + posVel.velocity.y ** 2 + posVel.velocity.z ** 2,
      )
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(alt)) {
        setLivePos({ lat, lng, alt, vel })
      }
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [sat?.tle1, sat?.tle2])

  if (!isOpen || !sat) return null

  const reg = layerRegistry.get('satellites')
  let entityIcon = reg?.iconUrl ?? ''
  if (reg?.classifySubtype && reg.subtypeIcons) {
    const subtype = reg.classifySubtype(sat)
    entityIcon = reg.subtypeIcons[subtype] ?? entityIcon
  }

  const displayLat = livePos?.lat ?? sat.lat
  const displayLng = livePos?.lng ?? sat.lng
  const displayAlt = livePos?.alt ?? sat.altitude
  const displayVel = livePos?.vel ?? sat.velocity

  return (
    <div
      role="dialog"
      aria-label="Satellite details"
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
            {sat.name}
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
          <DataField label="NORAD ID" value={String(sat.noradId)} />
          <DataField label="Latitude" value={`${displayLat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${displayLng.toFixed(4)}\u00B0`} />
          <DataField label="Altitude" value={`${displayAlt.toFixed(1)} km`} />
          <DataField label="Velocity" value={`${displayVel.toFixed(2)} km/s`} />
        </div>
      </div>
    </div>
  )
}

const DataField = memo(function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] tracking-wide text-white/35 uppercase">{label}</span>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
})
