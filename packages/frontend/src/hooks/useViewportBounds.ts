import { useEffect, useRef } from 'react'
import { useCesium } from 'resium'
import { Math as CesiumMath, Viewer as CesiumViewer } from 'cesium'
import { sendMessage } from './useWebSocket'

const THROTTLE_MS = 500

/**
 * Listens to camera moveEnd events and sends viewport bounds to the server
 * so it can spatially filter entities before broadcasting.
 */
export function useViewportBounds() {
  const { viewer: rawViewer } = useCesium()
  const lastSentRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    function sendBounds() {
      const rect = viewer.camera.computeViewRectangle()
      if (!rect) return

      const bounds = {
        west: CesiumMath.toDegrees(rect.west),
        south: CesiumMath.toDegrees(rect.south),
        east: CesiumMath.toDegrees(rect.east),
        north: CesiumMath.toDegrees(rect.north),
      }

      sendMessage(JSON.stringify({ type: 'viewport', bounds }))
      lastSentRef.current = Date.now()
    }

    function onMoveEnd() {
      const elapsed = Date.now() - lastSentRef.current
      if (elapsed >= THROTTLE_MS) {
        sendBounds()
      } else {
        // Schedule a deferred send if we're within the throttle window.
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(sendBounds, THROTTLE_MS - elapsed)
      }
    }

    viewer.camera.moveEnd.addEventListener(onMoveEnd)

    // Send initial bounds once the viewer is ready.
    sendBounds()

    return () => {
      viewer.camera.moveEnd.removeEventListener(onMoveEnd)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [rawViewer])
}
