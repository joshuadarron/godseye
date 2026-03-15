import Globe from './components/Globe/Globe'
import HUDToolbar from './components/HUD/HUDToolbar'
import SearchResultsPanel from './components/HUD/SearchResultsPanel'
import EntityTooltip from './components/HUD/EntityTooltip'
import EntityDetailPanel from './components/HUD/EntityDetailPanel'

function App() {
  return (
    <div className="relative w-full h-full bg-black">
      <Globe />
      <HUDToolbar />
      <SearchResultsPanel />
      <EntityTooltip />
      <EntityDetailPanel />
    </div>
  )
}

export default App
