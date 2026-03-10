import { useFlightStore } from '../../stores/flightStore'
import { useSatelliteStore } from '../../stores/satelliteStore'

export default function EntityCounter() {
  const flightCount = useFlightStore((s) => s.flights.size)
  const satelliteCount = useSatelliteStore((s) => s.satellites.size)

  return (
    <div className="fixed bottom-4 left-4 rounded bg-black/70 px-4 py-2 text-xs text-white">
      <table className="border-collapse">
        <tbody>
          <tr>
            <td className="pr-4 font-semibold">Flights</td>
            <td className="tabular-nums">{flightCount}</td>
          </tr>
          <tr>
            <td className="pr-4 font-semibold">Satellites</td>
            <td className="tabular-nums">{satelliteCount}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
