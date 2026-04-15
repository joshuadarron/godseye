import { useEffect, useMemo } from 'react'
import {
  Ion,
  Color,
  UrlTemplateImageryProvider,
  Viewer as CesiumViewer,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cartesian2,
} from 'cesium'
import { Viewer, Globe as CesiumGlobe, Scene, SkyAtmosphere, useCesium } from 'resium'
import GenericEntityLayer from './GenericEntityLayer'
import EncounterLayer from './EncounterLayer'
import { layerRegistry } from '../../registries/layerRegistry'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useViewportBounds } from '../../hooks/useViewportBounds'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'
import { useLayerVisibilityStore } from '../../stores/layerVisibilityStore'
import { setViewer } from '../../utils/viewerRef'

// Import registrations to populate the registry.
import '../../registries/flights'
import '../../registries/satellites'
import '../../registries/vessels'
import '../../registries/events'
import '../../registries/conflicts'

const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
if (token) {
  Ion.defaultAccessToken = token
}

function ViewerInit() {
  const { viewer: rawViewer } = useCesium()

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer

    // Replace the default Ion imagery with Google satellite + labels.
    viewer.imageryLayers.removeAll()
    viewer.imageryLayers.addImageryProvider(
      new UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      }),
    )

    // Run the clock in real-time so day/night matches reality.
    viewer.clock.multiplier = 1.0
    viewer.clock.shouldAnimate = true

    // Hide the Cesium Ion credit logo.
    const credit = viewer.cesiumWidget.creditContainer as HTMLElement
    credit.style.display = 'none'

    // Force a resize so the viewer picks up final CSS-computed dimensions.
    viewer.resize()

    // Expose the viewer for non-Resium components (e.g. search fly-to).
    setViewer(viewer)
    return () => setViewer(null)
  }, [rawViewer])

  return null
}

/** Sends camera viewport bounds to the server on camera move. */
function ViewportBoundsReporter() {
  useViewportBounds()
  return null
}

function PickHandler() {
  const { viewer: rawViewer } = useCesium()
  const setHovered = useSelectedEntityStore((s) => s.setHovered)
  const setSelected = useSelectedEntityStore((s) => s.setSelected)

  useEffect(() => {
    if (!rawViewer) return
    const viewer = rawViewer as CesiumViewer
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)

    // Throttle hover picks to at most once every 50ms and skip if entity hasn't changed.
    let lastPickTime = 0
    let lastHoveredId: string | null = null

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      const now = performance.now()
      if (now - lastPickTime < 50) return
      lastPickTime = now

      try {
        const picked = viewer.scene.pick(movement.endPosition)
        if (defined(picked) && picked.id?.layer && picked.id?.entityId) {
          if (picked.id.entityId === lastHoveredId) return
          lastHoveredId = picked.id.entityId
          setHovered(
            { layer: picked.id.layer, entityId: picked.id.entityId },
            { x: movement.endPosition.x, y: movement.endPosition.y },
          )
        } else {
          if (lastHoveredId === null) return
          lastHoveredId = null
          setHovered(null, null)
        }
      } catch {
        lastHoveredId = null
        setHovered(null, null)
      }
    }, ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction((click: { position: Cartesian2 }) => {
      try {
        const picked = viewer.scene.pick(click.position)
        if (defined(picked) && picked.id?.layer && picked.id?.entityId) {
          setSelected(
            { layer: picked.id.layer, entityId: picked.id.entityId },
            { x: click.position.x, y: click.position.y },
          )
        } else {
          setSelected(null)
        }
      } catch {
        setSelected(null)
      }
    }, ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler.destroy()
    }
  }, [rawViewer, setHovered, setSelected])

  return null
}

/**
 * Auto-deselect an entity when its layer or sublayer is toggled off,
 * and render overlays only when the entity is still visible.
 */
function SelectedOverlays() {
  const selected = useSelectedEntityStore((s) => s.selected)
  const clearSelected = useSelectedEntityStore((s) => s.clearSelected)
  const layers = useLayerVisibilityStore((s) => s.layers)
  const sublayers = useLayerVisibilityStore((s) => s.sublayers)

  // Determine if the selected entity's layer + sublayer are both visible.
  const visible = useMemo(() => {
    if (!selected) return false
    if (!layers[selected.layer]) return false

    // Check sublayer visibility if the layer uses subtypes.
    const reg = layerRegistry.get(selected.layer)
    if (reg?.classifySubtype && reg.store) {
      const entity = reg.store.getState().getById(selected.entityId)
      if (entity) {
        const subtype = reg.classifySubtype(entity)
        const sublayerMap = sublayers[selected.layer]
        if (sublayerMap && sublayerMap[subtype] === false) return false
      }
    }
    return true
  }, [selected, layers, sublayers])

  // Clear selection when entity becomes invisible.
  useEffect(() => {
    if (selected && !visible) clearSelected()
  }, [selected, visible, clearSelected])

  if (!selected || !visible) return null

  const reg = layerRegistry.get(selected.layer)
  if (!reg?.overlays?.length) return null

  return (
    <>
      {reg.overlays.map((Overlay, i) => (
        <Overlay key={`${selected.layer}-overlay-${i}`} />
      ))}
    </>
  )
}

export default function Globe() {
  useWebSocket()

  const registrations = Array.from(layerRegistry.values())

  return (
    <Viewer
      full
      timeline={false}
      animation={false}
      fullscreenButton={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      sceneModePicker={false}
      selectionIndicator={false}
      infoBox={false}
    >
      <Scene backgroundColor={Color.BLACK} />
      <SkyAtmosphere />
      <CesiumGlobe showGroundAtmosphere enableLighting dynamicAtmosphereLightingFromSun />
      <ViewerInit />
      <ViewportBoundsReporter />
      <PickHandler />
      {registrations.map((reg) => (
        <GenericEntityLayer key={reg.key} registration={reg} />
      ))}
      <SelectedOverlays />
      <EncounterLayer />
    </Viewer>
  )
}
