import { useEffect, useRef, useState, useCallback } from 'react'
import type { DeltaMessage } from '../types/common'
import type { Flight } from '../types/flight'
import type { Satellite } from '../types/satellite'
import { useFlightStore } from '../stores/flightStore'
import { useSatelliteStore } from '../stores/satelliteStore'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const MAX_BACKOFF_MS = 30_000

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<DeltaMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const processFlightDeltas = useFlightStore((s) => s.processDeltas)
  const processSatelliteDeltas = useSatelliteStore((s) => s.processDeltas)

  const dispatch = useCallback(
    (msg: DeltaMessage) => {
      switch (msg.layer) {
        case 'flights':
          processFlightDeltas(msg.entities as Flight[], msg.action)
          break
        case 'satellites':
          processSatelliteDeltas(msg.entities as Satellite[], msg.action)
          break
        default:
          break
      }
    },
    [processFlightDeltas, processSatelliteDeltas],
  )

  const connect = useCallback(() => {
    const url = import.meta.env.VITE_WS_URL as string | undefined
    if (!url) return

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      retriesRef.current = 0
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as DeltaMessage
        setLastMessage(msg)
        dispatch(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [dispatch])

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(1000 * 2 ** retriesRef.current, MAX_BACKOFF_MS)
    retriesRef.current += 1
    timerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, lastMessage }
}
