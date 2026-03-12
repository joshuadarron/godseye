import { useEffect } from 'react'
import { Ion, Color, UrlTemplateImageryProvider, Viewer as CesiumViewer } from 'cesium'
import { Viewer, Globe as CesiumGlobe, Scene, SkyAtmosphere, useCesium } from 'resium'
import FlightLayer from './FlightLayer'
import SatelliteLayer from './SatelliteLayer'
import { useWebSocket } from '../../hooks/useWebSocket'

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

    // Hide the Cesium Ion credit logo.
    const credit = viewer.cesiumWidget.creditContainer as HTMLElement
    credit.style.display = 'none'

    // Force a resize so the viewer picks up final CSS-computed dimensions.
    viewer.resize()
  }, [rawViewer])

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
      <CesiumGlobe showGroundAtmosphere />
      <ViewerInit />
      <FlightLayer />
      <SatelliteLayer />
    </Viewer>
  )
}
