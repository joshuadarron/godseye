import { useEffect, useMemo, useReducer } from 'react'

export interface NearbyEntity {
  id: string
  type: string
  lat: number
  lng: number
  heading: number
  altitude: number
  distKm: number
}

const API_BASE = import.meta.env.VITE_API_URL as string | undefined

function apiUrl(path: string): string {
  if (API_BASE) return `${API_BASE}${path}`
  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined
  if (wsUrl) {
    const url = new URL(wsUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = path
    return url.toString()
  }
  return path
}

type State = {
  entityId: string | null
  nearby: NearbyEntity[]
  loading: boolean
}

type Action =
  | { type: 'success'; entityId: string; nearby: NearbyEntity[] }
  | { type: 'error'; entityId: string }

function reducer(_state: State, action: Action): State {
  switch (action.type) {
    case 'success':
      return { entityId: action.entityId, nearby: action.nearby, loading: false }
    case 'error':
      return { entityId: action.entityId, nearby: [], loading: false }
  }
}

const initial: State = { entityId: null, nearby: [], loading: false }

/**
 * Fetches nearby entities for a given entity ID from the graph.
 * Returns empty array if graph layer is not available.
 */
export function useNearby(entityId: string | null, hops = 1) {
  const [state, dispatch] = useReducer(reducer, initial)

  useEffect(() => {
    if (!entityId) return

    let cancelled = false

    fetch(apiUrl(`/api/graph/nearby?id=${encodeURIComponent(entityId)}&hops=${hops}`))
      .then((res) => {
        if (!res.ok) throw new Error('not ok')
        return res.json()
      })
      .then((data: NearbyEntity[]) => {
        if (!cancelled) dispatch({ type: 'success', entityId, nearby: data ?? [] })
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'error', entityId })
      })

    return () => {
      cancelled = true
    }
  }, [entityId, hops])

  const loading = entityId !== null && state.entityId !== entityId
  const nearby = useMemo(() => (state.entityId === entityId ? state.nearby : []), [state, entityId])

  return { nearby, loading }
}
