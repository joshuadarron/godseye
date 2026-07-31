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

/** A batch of deltas for one layer, merged from a single animation frame. */
export interface DeltaGroup {
  action: 'upsert' | 'remove'
  entities: unknown[]
}

/**
 * Merges a frame's worth of messages by layer and action, concatenating their
 * entity arrays so each store is updated once per frame instead of once per
 * message. Upserts and removes stay in separate groups — collapsing them would
 * lose the distinction between adding and deleting an entity.
 */
export function groupDeltas(messages: DeltaMessage[]): Map<string, DeltaGroup> {
  const grouped = new Map<string, DeltaGroup>()

  for (const msg of messages) {
    const key = `${msg.layer}:${msg.action}`
    const existing = grouped.get(key)
    if (existing) {
      existing.entities.push(...msg.entities)
    } else {
      grouped.set(key, { action: msg.action, entities: [...msg.entities] })
    }
  }

  return grouped
}

/** Exponential reconnect delay, doubling per attempt up to MAX_BACKOFF_MS. */
export function backoffDelay(retries: number): number {
  return Math.min(1000 * 2 ** retries, MAX_BACKOFF_MS)
}

/**
 * Builds the WebSocket subprotocols carrying the access token. The token rides
 * in the subprotocol rather than a query parameter so it stays out of server
 * access logs.
 */
export function buildProtocols(token: string | null): string[] {
  return token ? [`godseye.v1.${token}`] : ['godseye.v1']
}

export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<DeltaMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const retriesRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  // rAF batching: buffer incoming messages and flush once per frame.
  const bufferRef = useRef<DeltaMessage[]>([])
  const rafRef = useRef(0)

  const flush = useCallback(() => {
    rafRef.current = 0
    const messages = bufferRef.current
    bufferRef.current = []

    const grouped = groupDeltas(messages)

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
    const protocols = buildProtocols(accessToken)

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

      // Cleanup closes the socket, which fires this handler. Without the guard
      // we would schedule a reconnect after the cleanup already cleared the
      // timer, leaking a timer that nothing will ever cancel.
      if (unmountedRef.current) return
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [flush])

  const scheduleReconnect = useCallback(() => {
    const delay = backoffDelay(retriesRef.current)
    retriesRef.current += 1
    timerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    // Reset on every mount, not just the first — StrictMode mounts, unmounts,
    // then remounts, and a stale `true` here would kill reconnects for good.
    unmountedRef.current = false
    connect()

    return () => {
      unmountedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, lastMessage }
}
