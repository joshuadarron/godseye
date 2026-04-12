import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_WIDTH = 360
const PANEL_TOP = 119

interface UseDraggablePanelOptions {
  layerKey: string
  onClose: () => void
}

export function useDraggablePanel({ layerKey, onClose }: UseDraggablePanelOptions) {
  const defaultPos = () => ({ x: window.innerWidth - DEFAULT_WIDTH - 16, y: PANEL_TOP })

  const [pos, setPos] = useState(defaultPos)
  const [initialized, setInitialized] = useState(false)

  const dragging = useRef(false)
  const startMouse = useRef({ x: 0, y: 0 })
  const startPos = useRef({ x: 0, y: 0 })

  const resetPosition = useCallback(
    (selectedLayer: string | undefined) => {
      if (selectedLayer === layerKey) {
        setPos(defaultPos())
        setInitialized(true)
      } else {
        setInitialized(false)
      }
    },
    [layerKey],
  )

  // Escape key to close.
  useEffect(() => {
    if (!initialized) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [initialized, onClose])

  const onPointerDownHeader = useCallback(
    (e: React.PointerEvent) => {
      // Skip drag on interactive elements.
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('a')) return
      e.preventDefault()
      dragging.current = true
      startMouse.current = { x: e.clientX, y: e.clientY }
      startPos.current = { ...pos }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - startMouse.current.x
    const dy = e.clientY - startMouse.current.y
    // Clamp to viewport bounds.
    const newX = Math.max(0, Math.min(window.innerWidth - DEFAULT_WIDTH, startPos.current.x + dx))
    const newY = Math.max(0, Math.min(window.innerHeight - 100, startPos.current.y + dy))
    setPos({ x: newX, y: newY })
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  return { pos, initialized, resetPosition, onPointerDownHeader, onPointerMove, onPointerUp }
}
