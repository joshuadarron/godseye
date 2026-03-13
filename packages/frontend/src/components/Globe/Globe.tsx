import { useEffect } from 'react'
import { Ion, Color, UrlTemplateImageryProvider, IonImageryProvider, ImageryLayer, Viewer as CesiumViewer, ScreenSpaceEventHandler, ScreenSpaceEventType, defined, Cartesian2 } from 'cesium'
import { Viewer, Globe as CesiumGlobe, Scene, SkyAtmosphere, useCesium } from 'resium'
import FlightLayer from './FlightLayer'
import SatelliteLayer from './SatelliteLayer'
import SatelliteOrbitOverlay from './SatelliteOrbitOverlay'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useSelectedEntityStore } from '../../stores/selectedEntityStore'

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

    // Add city lights layer (NASA Black Marble) visible only on the night side.
    IonImageryProvider.fromAssetId(3812).then((nightProvider) => {
      if (!viewer.isDestroyed()) {
        viewer.imageryLayers.add(new ImageryLayer(nightProvider, {
          dayAlpha: 0.0,
          nightAlpha: 1.0,
        }))
      }
    }).catch((err) => console.error('Failed to load city lights layer:', err))

    // Run the clock in real-time so day/night matches reality.
    viewer.clock.multiplier = 1.0
    viewer.clock.shouldAnimate = true

    // Hide the Cesium Ion credit logo.
    const credit = viewer.cesiumWidget.creditContainer as HTMLElement
    credit.style.display = 'none'

    // Force a resize so the viewer picks up final CSS-computed dimensions.
    viewer.resize()
  }, [rawViewer])

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

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      try {
        const picked = viewer.scene.pick(movement.endPosition)
        if (defined(picked) && picked.id?.layer && picked.id?.entityId) {
          setHovered(
            { layer: picked.id.layer, entityId: picked.id.entityId },
            { x: movement.endPosition.x, y: movement.endPosition.y },
          )
        } else {
          setHovered(null, null)
        }
      } catch {
        setHovered(null, null)
      }
    }, ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction((click: { position: Cartesian2 }) => {
      try {
        const picked = viewer.scene.pick(click.position)
        if (defined(picked) && picked.id?.layer && picked.id?.entityId) {
          setSelected({ layer: picked.id.layer, entityId: picked.id.entityId })
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

export default function Globe() {
  useWebSocket()

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
      <CesiumGlobe
        showGroundAtmosphere
        enableLighting
        dynamicAtmosphereLightingFromSun
      />
      <ViewerInit />
      <PickHandler />
      <FlightLayer />
      <SatelliteLayer />
      <SatelliteOrbitOverlay />
    </Viewer>
  )
}
