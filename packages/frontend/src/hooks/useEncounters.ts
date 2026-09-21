import { useEffect, useRef, useState } from 'react'
import { config } from '../config'

export interface EncounterPair {
  sourceId: string
  targetId: string
  distKm: number
}

const API_BASE = config.apiUrl

function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`
  // Derive from WS URL or fall back to same origin.
  const wsUrl = config.wsUrl
  if (wsUrl) {
    const url = new URL(wsUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = path
    return url.toString()
  }
  return path
}

/**
 * Polls GET /api/graph/encounters every `intervalMs` (default 5s).
 * Returns current encounter pairs for rendering lines on the globe.
 */
export function useEncounters(intervalMs = 5000) {
  const [encounters, setEncounters] = useState<EncounterPair[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    let cancelled = false

    const fetchEncounters = async () => {
      try {
        const res = await fetch(apiUrl('/api/graph/encounters'))
        if (!res.ok) return
        const data: EncounterPair[] = await res.json()
        if (!cancelled) setEncounters(data ?? [])
      } catch {
        // Silently ignore — graph layer may not be running.
      }
    }

    fetchEncounters()
    timerRef.current = setInterval(fetchEncounters, intervalMs)

    return () => {
      cancelled = true
      clearInterval(timerRef.current)
    }
  }, [intervalMs])

  return encounters
}
