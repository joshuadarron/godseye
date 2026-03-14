import Globe from './components/Globe/Globe'
import Sidebar from './components/HUD/Sidebar'
import EntityTooltip from './components/HUD/EntityTooltip'
import EntityDetailPanel from './components/HUD/EntityDetailPanel'

function App() {
  return (
    <div className="relative w-full h-full bg-black">
      <Globe />
      <Sidebar />
      <EntityTooltip />
      <EntityDetailPanel />
    </div>
  )
}

export default App
