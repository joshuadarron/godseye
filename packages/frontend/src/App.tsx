import Globe from './components/Globe/Globe'
import HUDToolbar from './components/HUD/HUDToolbar'
import EntityTooltip from './components/HUD/EntityTooltip'
import EntityDetailPanel from './components/HUD/EntityDetailPanel'

function App() {
  return (
    <div className="relative h-full w-full bg-black">
      <Globe />
      <HUDToolbar />
      <EntityTooltip />
      <EntityDetailPanel />
    </div>
  )
}

export default App
