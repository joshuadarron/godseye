import { useEffect, useMemo, useRef } from 'react'
import { useCesium } from 'resium'
import { Cartesian3, Color, Material, PolylineCollection } from 'cesium'
import { useEncounters } from '../../hooks/useEncounters'
import { useFlightStore } from '../../stores/flightStore'
import { useSatelliteStore } from '../../stores/satelliteStore'
import { useVesselStore } from '../../stores/vesselStore'

/** Resolve an entity's current position by checking all stores. */
function resolvePosition(
  id: string,
): { lat: number; lng: number; alt: number; type: string } | null {
  const flight = useFlightStore.getState().entities.get(id)
  if (flight)
    return { lat: flight.lat, lng: flight.lng, alt: flight.altitude ?? 0, type: 'flights' }

  const sat = useSatelliteStore.getState().entities.get(id)
  if (sat)
    return { lat: sat.lat, lng: sat.lng, alt: (sat.altitude ?? 0) * 1000, type: 'satellites' }

  const vessel = useVesselStore.getState().entities.get(id)
  if (vessel) return { lat: vessel.lat, lng: vessel.lng, alt: 0, type: 'vessels' }

  return null
}

/** Line color based on entity type combination. */
function encounterColor(typeA: string, typeB: string): Color {
  const pair = [typeA, typeB].sort().join('-')
  switch (pair) {
    case 'flights-flights':
      return Color.CYAN.withAlpha(0.4)
    case 'flights-vessels':
      return Color.ORANGE.withAlpha(0.4)
    case 'flights-satellites':
      return Color.YELLOW.withAlpha(0.4)
    case 'satellites-satellites':
      return Color.LIME.withAlpha(0.4)
    case 'vessels-vessels':
      return Color.AQUA.withAlpha(0.4)
    default:
      return Color.WHITE.withAlpha(0.3)
  }
}

/**
 * Renders polylines between entity pairs that have NEAR edges in the graph.
 * Polls the encounters endpoint every 5 seconds.
 * Uses imperative Cesium PolylineCollection for performance.
 */
export default function EncounterLayer() {
  const { viewer } = useCesium()
  const encounters = useEncounters(5000)
  const collectionRef = useRef<PolylineCollection | null>(null)

  // Subscribe to version changes so we re-resolve positions when entities update.
  const flightVersion = useFlightStore((s) => s.version)
  const satVersion = useSatelliteStore((s) => s.version)
  const vesselVersion = useVesselStore((s) => s.version)

  // Create/destroy the collection with the viewer lifecycle.
  useEffect(() => {
    if (!viewer) return
    const collection = new PolylineCollection()
    viewer.scene.primitives.add(collection)
    collectionRef.current = collection

    return () => {
      viewer.scene.primitives.remove(collection)
      collectionRef.current = null
    }
  }, [viewer])

  // Rebuild polylines when encounters or entity positions change.
  const lines = useMemo(() => {
    const result: { positions: Cartesian3[]; color: Color }[] = []
    for (const enc of encounters) {
      const a = resolvePosition(enc.sourceId)
      const b = resolvePosition(enc.targetId)
      if (!a || !b) continue
      result.push({
        positions: [
          Cartesian3.fromDegrees(a.lng, a.lat, a.alt),
          Cartesian3.fromDegrees(b.lng, b.lat, b.alt),
        ],
        color: encounterColor(a.type, b.type),
      })
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounters, flightVersion, satVersion, vesselVersion])

  useEffect(() => {
    const collection = collectionRef.current
    if (!collection) return

    collection.removeAll()
    for (const line of lines) {
      collection.add({
        positions: line.positions,
        width: 1.5,
        material: Material.fromType('Color', { color: line.color }),
      })
    }
  }, [lines])

  return null
}
