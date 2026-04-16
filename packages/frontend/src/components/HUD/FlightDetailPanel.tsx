import { memo, useEffect, useState } from 'react'
import { Button } from '@headlessui/react'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useFlightStore } from '../../stores/flightStore'
import { layerRegistry } from '../../registries/layerRegistry'
import { useDraggablePanel } from '../../hooks/useDraggablePanel'
import { lookupRoute } from '../../utils/routeLookup'
import type { FlightRoute } from '../../utils/routeLookup'
import { lookupAircraft } from '../../utils/aircraftLookup'
import type { AircraftMeta } from '../../utils/aircraftLookup'
import NearbySection from './NearbySection'

const DEFAULT_WIDTH = 360

export default function FlightDetailPanel() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)

  const { pos, initialized, resetPosition, onPointerDownHeader, onPointerMove, onPointerUp } =
    useDraggablePanel({ layerKey: 'flights', onClose: clearSelected })

  useEffect(() => {
    resetPosition(selected?.layer)
  }, [selected, resetPosition])

  const [route, setRoute] = useState<FlightRoute | null>(null)
  const [aircraft, setAircraft] = useState<AircraftMeta | null>(null)

  useEffect(() => {
    if (!selected || selected.layer !== 'flights') {
      setRoute(null)
      setAircraft(null)
      return
    }
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

    return () => {
      cancelled = true
    }
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
      role="dialog"
      aria-label="Flight details"
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
          {entityIcon && (
            <img
              src={entityIcon}
              alt=""
              className="h-5 w-5 drop-shadow-[0_0_3px_rgba(255,255,255,0.3)]"
            />
          )}
          <h2 className="truncate text-[11px] font-semibold tracking-widest text-white/40 uppercase">
            {f.callsign || f.id}
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
          <DataField label="ICAO" value={f.id} />
          <DataField label="Callsign" value={f.callsign || '—'} />
          <DataField label="Registration" value={aircraft?.reg || '—'} />
          <DataField
            label="Type"
            value={
              aircraft ? `${aircraft.type}${aircraft.model ? ` — ${aircraft.model}` : ''}` : '—'
            }
          />
          <DataField label="Operator" value={aircraft?.op || '—'} />
          <DataField label="Origin" value={f.originCountry || '—'} />
          <DataField label="Source" value={f.source} />
          <DataField label="Category" value={categoryLabel(f.category)} />
          <DataField label="Latitude" value={`${f.lat.toFixed(4)}\u00B0`} />
          <DataField label="Longitude" value={`${f.lng.toFixed(4)}\u00B0`} />
          <DataField
            label="Baro Alt."
            value={f.onGround ? 'Ground' : `${Math.round(f.altitude * 3.281).toLocaleString()} ft`}
          />
          <DataField
            label="Geo Alt."
            value={
              f.onGround ? 'Ground' : `${Math.round(f.geoAltitude * 3.281).toLocaleString()} ft`
            }
          />
          <DataField label="Speed" value={`${f.velocity.toFixed(1)} m/s`} />
          <DataField label="Heading" value={`${f.heading.toFixed(1)}\u00B0`} />
          <DataField label="Vert. Rate" value={formatVerticalRate(f.verticalRate)} />
          <DataField label="Squawk" value={f.squawk || '—'} />
          <DataField label="Status" value={f.onGround ? 'On Ground' : 'Airborne'} />
          <DataField
            label="Departure"
            value={route ? `${route.departure.name} (${route.departure.icao})` : '—'}
          />
          <DataField
            label="Arrival"
            value={route ? `${route.arrival.name} (${route.arrival.icao})` : '—'}
          />
        </div>
      </div>

      <NearbySection entityId={f.id} />
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
      <span className="text-[11px] tracking-wide text-white/35 uppercase">{label}</span>
      <p className="text-sm font-medium text-white/90">{value}</p>
    </div>
  )
})
