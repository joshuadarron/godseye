import { useEffect, useRef, useState, useCallback } from 'react'
import type { DeltaMessage } from '../types/common'
import { entityRegistry } from '../stores/entityRegistry'
import { useAuthStore } from '../stores/authStore'
import { useConnectionStore } from '../stores/connectionStore'

// Ensure stores are registered before the hook runs.
import '../stores/flightStore'
import '../stores/satelliteStore'
import '../stores/vesselStore'
import '../stores/earthquakeStore'
import '../stores/conflictStore'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

const MAX_BACKOFF_MS = 30_000

// Module-level WebSocket reference for use outside React components.
let activeWs: WebSocket | null = null

/** Send a raw string message over the active WebSocket connection. */
export function sendMessage(data: string): void {
  if (activeWs && activeWs.readyState === WebSocket.OPEN) {
    activeWs.send(data)
  }
}

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<DeltaMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // rAF batching: buffer incoming messages and flush once per frame.
  const bufferRef = useRef<DeltaMessage[]>([])
  const rafRef = useRef(0)

  const flush = useCallback(() => {
    rafRef.current = 0
    const messages = bufferRef.current
    bufferRef.current = []

    // Group by layer, merging entity arrays.
    const grouped = new Map<string, { action: 'upsert' | 'remove'; entities: unknown[] }>()

    for (const msg of messages) {
      const key = `${msg.layer}:${msg.action}`
      const existing = grouped.get(key)
      if (existing) {
        existing.entities.push(...msg.entities)
      } else {
        grouped.set(key, { action: msg.action, entities: [...msg.entities] })
      }
    }

    for (const [key, { action, entities }] of grouped) {
      const layer = key.split(':')[0]
      const store = entityRegistry.get(layer)
      if (store) {
        store.getState().processDeltas(entities as any, action)
      }
    }

    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1])
    }
  }, [])

  const connect = useCallback(() => {
    const baseUrl = import.meta.env.VITE_WS_URL as string | undefined
    if (!baseUrl) return

    // Use subprotocol for auth: godseye.v1.TOKEN, or godseye.v1 if anonymous.
    const accessToken = useAuthStore.getState().accessToken
    const protocols = accessToken
      ? [`godseye.v1.${accessToken}`]
      : ['godseye.v1']

    setStatus('connecting')
    useConnectionStore.getState().setStatus('connecting')
    const ws = new WebSocket(baseUrl, protocols)
    wsRef.current = ws
    activeWs = ws

    ws.onopen = () => {
      setStatus('connected')
      useConnectionStore.getState().setStatus('connected')
      retriesRef.current = 0
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as DeltaMessage
        bufferRef.current.push(msg)
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(flush)
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = () => {
      setStatus('disconnected')
      useConnectionStore.getState().setStatus('disconnected')
      activeWs = null
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [flush])

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, lastMessage }
}
