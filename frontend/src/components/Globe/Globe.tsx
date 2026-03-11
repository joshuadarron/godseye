import { Ion, Color, ImageryLayer, IonImageryProvider } from 'cesium'
import { Viewer, Globe as CesiumGlobe, Scene, SkyAtmosphere } from 'resium'
import FlightLayer from './FlightLayer'
import SatelliteLayer from './SatelliteLayer'
import ConnectionStatus from '../HUD/ConnectionStatus'
import EntityCounter from '../HUD/EntityCounter'
import { useWebSocket } from '../../hooks/useWebSocket'

const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined
if (token) {
  Ion.defaultAccessToken = token
}

const defaultBaseLayer = ImageryLayer.fromProviderAsync(
  IonImageryProvider.fromAssetId(2) // Cesium World Imagery
)

export default function Globe() {
  const { status } = useWebSocket()

  return (
    <>
      <Viewer
        full
        baseLayer={defaultBaseLayer}
        timeline={false}
        animation={false}
        fullscreenButton={false}
        baseLayerPicker={false}
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
          enableLighting
          showGroundAtmosphere
        />
        <FlightLayer />
        <SatelliteLayer />
      </Viewer>
      <ConnectionStatus status={status} />
      <EntityCounter />
    </>
  )
}
