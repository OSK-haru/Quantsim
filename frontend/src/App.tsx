import { useEffect, useState } from 'react'
import './App.css'
import { type SimulationDiagnostics } from './components/DiagnosticsCard'
import { type MockSimulationResult } from './types/simulation'
import type { GateDurationDefaults } from './types/simulation'
import { CircuitProvider } from './context/CircuitContext'
import { CircuitStudioPage } from './pages/CircuitStudioPage'
import { HomePage } from './pages/HomePage'
import { HelpPage } from './pages/HelpPage'
import { SimulatePage } from './pages/SimulatePage'
import { StateExplorerPage } from './pages/StateExplorerPage'
import { MODEL_IDS, modelStatusText } from './utils/modelLabels'
import type { SimulationResponse } from './types/simulation'

const statusItems = [
  { label: 'Simulation model', value: modelStatusText(MODEL_IDS.simulationModel) },
  { label: 'Evolution mode', value: modelStatusText(MODEL_IDS.evolutionMode) },
  { label: 'Default backend', value: modelStatusText(MODEL_IDS.defaultBackend) },
  { label: 'Preview backend', value: modelStatusText(MODEL_IDS.previewBackend) },
  { label: 'Planned mode', value: modelStatusText(MODEL_IDS.plannedMode) },
]

const mockDiagnostics: SimulationDiagnostics = {
  simulation_model: 'gate_aware_open_system',
  evolution_mode: 'gate_aware_hamiltonian_lindblad_v1',
  simulation_backend: 'rust_dense_preview',
  backend_name: 'rust_dense_preview',
  rust_kernel_mode: 'sampled_cleaned_multi_output',
  rust_kernel_call_count: 2,
  rust_kernel_sampled_batch_count: 1,
  backend_fallback_used: false,
  rust_kernel_fallback_used: false,
}

const mockResult: MockSimulationResult = {
  final_fidelity: 0.981649092875,
  final_purity: 0.963818205819,
  completion_fidelity: 0.996993298356,
  completion_purity: 0.994004271723,
  effective_time_us: null,
  output_probabilities: {
    '00': 0.49,
    '01': 0.01,
    '10': 0.01,
    '11': 0.49,
  },
}

const initialGateDurationDefaults: GateDurationDefaults = {
  H: 0.02,
  X: 0.02,
  Z: 0.0,
  CNOT: 0.2,
  MEASURE: 0.0,
}

type Screen = 'home' | 'simulate' | 'circuit-studio' | 'state-explorer' | 'help'

function screenFromPath(pathname: string): Screen {
  if (pathname === '/simulate') {
    return 'simulate'
  }
  if (pathname === '/circuit-studio') {
    return 'circuit-studio'
  }
  if (pathname === '/state-explorer') {
    return 'state-explorer'
  }
  if (pathname === '/help') {
    return 'help'
  }
  return 'home'
}

function pathFromScreen(screen: Screen) {
  if (screen === 'simulate') {
    return '/simulate'
  }
  if (screen === 'circuit-studio') {
    return '/circuit-studio'
  }
  if (screen === 'state-explorer') {
    return '/state-explorer'
  }
  if (screen === 'help') {
    return '/help'
  }
  return '/'
}

function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname))
  const [gateDurationDefaults, setGateDurationDefaults] =
    useState<GateDurationDefaults>(initialGateDurationDefaults)
  const [latestSimulationResponse, setLatestSimulationResponse] =
    useState<SimulationResponse | null>(null)

  function navigate(nextScreen: Screen) {
    const nextPath = pathFromScreen(nextScreen)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath)
    }
    setScreen(nextScreen)
  }

  useEffect(() => {
    function handlePopState() {
      setScreen(screenFromPath(window.location.pathname))
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (screen === 'home') {
    return (
      <HomePage
        onStartSimulation={() => navigate('simulate')}
        onOpenStateExplorer={() => navigate('state-explorer')}
      />
    )
  }

  return (
    <CircuitProvider gateDurationDefaults={gateDurationDefaults}>
      {screen === 'help' ? (
        <HelpPage
          onBackToSimulation={() => navigate('simulate')}
          onOpenCircuitStudio={() => navigate('circuit-studio')}
        />
      ) : null}

      {screen === 'circuit-studio' ? (
        <CircuitStudioPage
          gateDurationDefaults={gateDurationDefaults}
          onOpenSimulation={() => navigate('simulate')}
          onOpenStateExplorer={() => navigate('state-explorer')}
          onOpenHelp={() => navigate('help')}
        />
      ) : null}

      {screen === 'state-explorer' ? (
        <StateExplorerPage
          response={latestSimulationResponse}
          onOpenSimulation={() => navigate('simulate')}
          onOpenCircuitStudio={() => navigate('circuit-studio')}
        />
      ) : null}

      {screen === 'simulate' ? (
        <SimulatePage
          diagnostics={mockDiagnostics}
          result={mockResult}
          statusItems={statusItems}
          gateDurationDefaults={gateDurationDefaults}
          onGateDurationDefaultsChange={setGateDurationDefaults}
          onBackToHome={() => navigate('home')}
          onOpenCircuitStudio={() => navigate('circuit-studio')}
          onOpenStateExplorer={() => navigate('state-explorer')}
          onOpenHelp={() => navigate('help')}
          onSuccessfulResponse={setLatestSimulationResponse}
        />
      ) : null}
    </CircuitProvider>
  )
}

export default App
