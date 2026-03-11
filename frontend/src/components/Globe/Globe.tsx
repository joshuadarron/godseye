import { Ion, Color } from 'cesium'
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

export default function Globe() {
  const { status } = useWebSocket()

  return (
    <>
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
        <FlightLayer />
        <SatelliteLayer />
      </Viewer>
      <ConnectionStatus status={status} />
      <EntityCounter />
    </>
  )
}
