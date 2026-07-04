import { useState } from 'react'
import './App.css'
import { type SimulationDiagnostics } from './components/DiagnosticsCard'
import { type MockSimulationResult } from './types/simulation'
import { HomePage } from './pages/HomePage'
import { HelpPage } from './pages/HelpPage'
import { SimulatePage } from './pages/SimulatePage'

const statusItems = [
  { label: 'Simulation model', value: 'gate_aware_open_system' },
  { label: 'Evolution mode', value: 'gate_aware_hamiltonian_lindblad_v1' },
  { label: 'Default backend', value: 'python_dense' },
  { label: 'Preview backend', value: 'rust_dense_preview' },
  { label: 'Future mode', value: 'gate_aware_cptp_kraus' },
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

function App() {
  const [screen, setScreen] = useState<'home' | 'simulate' | 'help'>('home')

  if (screen === 'home') {
    return <HomePage onStartSimulation={() => setScreen('simulate')} />
  }

  if (screen === 'help') {
    return <HelpPage onBackToSimulation={() => setScreen('simulate')} />
  }

  return (
    <SimulatePage
      diagnostics={mockDiagnostics}
      result={mockResult}
      statusItems={statusItems}
      onBackToHome={() => setScreen('home')}
      onOpenHelp={() => setScreen('help')}
    />
  )
}

export default App
