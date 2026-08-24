import { useEffect, useState } from 'react'
import './App.css'
import { type SimulationDiagnostics } from './components/DiagnosticsCard'
import { type MockSimulationResult } from './types/simulation'
import type { GateDurationDefaults } from './types/simulation'
import { CircuitProvider } from './context/CircuitContext'
import { TutorialProvider } from './context/TutorialContext'
import { TutorialOverlay } from './components/TutorialOverlay'
import { TutorialCircuitWatcher } from './components/TutorialCircuitWatcher'
import { QuantumFluctuationField } from './components/QuantumFluctuationField'
import { AlgorithmLibraryPage } from './pages/AlgorithmLibraryPage'
import { CircuitStudioPage } from './pages/CircuitStudioPage'
import { HomePage } from './pages/HomePage'
import { HelpPage } from './pages/HelpPage'
import { SimulatePage } from './pages/SimulatePage'
import { StateExplorerPage } from './pages/StateExplorerPage'
import { PulseLabPage } from './pages/PulseLabPage'
import { PulseCircuitStudioPage } from './pages/PulseCircuitStudioPage'
import { PulseStateExplorerPage } from './pages/PulseStateExplorerPage'
import {
  AppNavigation,
  type NavigationRoute,
} from './components/AppNavigation'
import type { SimulationResponse } from './types/simulation'
import type { CircuitConfig } from './utils/circuitConfig'
import { initialPulseLabForm } from './utils/pulseLab'
import {
  applyPulseStepToForm,
  createDefaultPulseCircuit,
} from './utils/pulseCircuit'
import type { PulseCircuitState, PulseStepParameters } from './types/pulseCircuit'
import type { PulseRunRecord } from './types/pulse'
import { pulseSetupSignature } from './utils/pulseStateExplorer'
import { modeAtTurn, type ModeId } from './utils/homeModes'

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
  Y: 0.02,
  Z: 0.0,
  S: 0.0,
  T: 0.0,
  RX: 0.02,
  RY: 0.02,
  RZ: 0.02,
  CNOT: 0.2,
  CZ: 0.2,
  SWAP: 0.2,
  CP: 0.2,
  CCX: 0.4,
  QFT: 0.2,
  ORACLE: 0.2,
  MEASURE: 0.0,
  MESSAGE: 0.04,
  RECEIVED: 0.0,
}

type Screen = NavigationRoute

function navigationDomainForRoute(route: NavigationRoute): 'home' | 'gate-aware' | 'pulse' {
  if (route === 'home') {
    return 'home'
  }
  return route === 'pulse-lab'
    || route === 'pulse-circuit-studio'
    || route === 'pulse-state-explorer'
    ? 'pulse'
    : 'gate-aware'
}

/*
 * 背景のゆらぎの相。画面の役割をそのまま場の性格に写す。
 * ホームだけはドラムが正面に出している面で決まる。
 * ヘルプは中身が説明文なので、ドキュメントと同じ凪いだ相に置く。
 */
function fieldRegimeForScreen(screen: Screen, homeModeTurn: number): ModeId {
  if (screen === 'home') {
    return modeAtTurn(homeModeTurn)
  }
  if (screen === 'help') {
    return 'docs'
  }
  return navigationDomainForRoute(screen) === 'pulse' ? 'pulse' : 'gate-aware'
}

function screenFromPath(pathname: string): Screen {
  if (pathname === '/simulate') {
    return 'simulate'
  }
  if (pathname === '/algorithm-library') {
    return 'algorithm-library'
  }
  if (pathname === '/circuit-studio') {
    return 'circuit-studio'
  }
  if (pathname === '/state-explorer') {
    return 'state-explorer'
  }
  if (pathname === '/pulse-lab') {
    return 'pulse-lab'
  }
  if (pathname === '/pulse-circuit-studio') {
    return 'pulse-circuit-studio'
  }
  if (pathname === '/pulse-state-explorer') {
    return 'pulse-state-explorer'
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
  if (screen === 'algorithm-library') {
    return '/algorithm-library'
  }
  if (screen === 'circuit-studio') {
    return '/circuit-studio'
  }
  if (screen === 'state-explorer') {
    return '/state-explorer'
  }
  if (screen === 'pulse-lab') {
    return '/pulse-lab'
  }
  if (screen === 'pulse-circuit-studio') {
    return '/pulse-circuit-studio'
  }
  if (screen === 'pulse-state-explorer') {
    return '/pulse-state-explorer'
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
  const [latestGateAwareResult, setLatestGateAwareResult] = useState<{
    response: SimulationResponse
    circuitConfig: CircuitConfig
  } | null>(null)
  const [pulseLabForm, setPulseLabForm] = useState(() => ({ ...initialPulseLabForm }))
  const [pulseCircuit, setPulseCircuit] = useState<PulseCircuitState>(() =>
    createDefaultPulseCircuit(initialPulseLabForm),
  )
  const [activePulseTransmonIndex, setActivePulseTransmonIndex] = useState(0)
  /*
   * Pulseの直近の実行結果。Pulseラボと状態エクスプローラーが同じ1件を見るので、
   * ページを移っても消えないここで保持する。
   */
  const [latestPulseRun, setLatestPulseRun] = useState<PulseRunRecord | null>(null)
  /*
   * ホームのドラムの回転数。ここで持っているのは、背景のゆらぎが
   * 全画面で1枚きりだから。ホームを離れても値が残るので、戻ってきたときに
   * 続きから回る。
   */
  const [homeModeTurn, setHomeModeTurn] = useState(0)

  function selectPulseForRun(transmonIndex: number, pulse: PulseStepParameters) {
    setActivePulseTransmonIndex(transmonIndex)
    setPulseLabForm((current) => applyPulseStepToForm(current, pulse))
  }

  function navigate(nextScreen: Screen) {
    const currentDomain = navigationDomainForRoute(screen)
    const nextDomain = navigationDomainForRoute(nextScreen)
    const crossesWorkspaceDirectly = currentDomain !== 'home'
      && nextDomain !== 'home'
      && currentDomain !== nextDomain
    if (crossesWorkspaceDirectly) {
      return
    }

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

  function renderScreen() {
    if (screen === 'home') {
      return (
        <>
          <AppNavigation currentRoute={screen} onNavigate={navigate} />
          <HomePage
            modeTurn={homeModeTurn}
            onModeTurnChange={setHomeModeTurn}
            onStartSimulation={() => navigate('simulate')}
            onOpenPulseLab={() => navigate('pulse-lab')}
          />
        </>
      )
    }

    if (
      screen === 'pulse-lab'
      || screen === 'pulse-circuit-studio'
      || screen === 'pulse-state-explorer'
    ) {
      const pulseSignature = pulseSetupSignature(pulseLabForm, pulseCircuit)
      return (
        <>
          <AppNavigation currentRoute={screen} onNavigate={navigate} />
          {screen === 'pulse-lab' ? (
            <PulseLabPage
              form={pulseLabForm}
              onFormChange={setPulseLabForm}
              circuit={pulseCircuit}
              sequence={pulseCircuit.lanes[activePulseTransmonIndex]?.steps ?? []}
              activeTransmonIndex={activePulseTransmonIndex}
              executionConstraints={pulseCircuit.executionConstraints}
              onExecutionConstraintsChange={(executionConstraints) => setPulseCircuit((current) => ({
                ...current,
                executionConstraints,
              }))}
              latestRun={latestPulseRun}
              runSignature={pulseSignature}
              onRunCommitted={setLatestPulseRun}
              onOpenPulseStateExplorer={() => navigate('pulse-state-explorer')}
            />
          ) : screen === 'pulse-circuit-studio' ? (
            <PulseCircuitStudioPage
              circuit={pulseCircuit}
              currentForm={pulseLabForm}
              onCircuitChange={setPulseCircuit}
              onSelectPulseForRun={selectPulseForRun}
            />
          ) : (
            <PulseStateExplorerPage
              run={latestPulseRun}
              currentSignature={pulseSignature}
              onOpenPulseLab={() => navigate('pulse-lab')}
            />
          )}
        </>
      )
    }

    return (
      <>
        <AppNavigation currentRoute={screen} onNavigate={navigate} />
        <CircuitProvider gateDurationDefaults={gateDurationDefaults}>
        <TutorialCircuitWatcher />

        {screen === 'help' ? (
          <HelpPage />
        ) : null}

        {screen === 'algorithm-library' ? (
          <AlgorithmLibraryPage onOpenSimulation={() => navigate('simulate')} />
        ) : null}

        {screen === 'circuit-studio' ? (
          <CircuitStudioPage gateDurationDefaults={gateDurationDefaults} />
        ) : null}

        {screen === 'state-explorer' ? (
          <StateExplorerPage
            response={latestGateAwareResult?.response ?? null}
            executedCircuitConfig={latestGateAwareResult?.circuitConfig ?? null}
            gateDurationDefaults={gateDurationDefaults}
            onOpenSimulation={() => navigate('simulate')}
          />
        ) : null}

        {screen === 'simulate' ? (
          <SimulatePage
            diagnostics={mockDiagnostics}
            result={mockResult}
            gateDurationDefaults={gateDurationDefaults}
            onGateDurationDefaultsChange={setGateDurationDefaults}
            onOpenCircuitStudio={() => navigate('circuit-studio')}
            onOpenStateExplorer={() => navigate('state-explorer')}
            previousResponse={latestGateAwareResult?.response ?? null}
            onSuccessfulResponse={(response, circuitConfig) => {
              setLatestGateAwareResult({ response, circuitConfig })
            }}
          />
        ) : null}
        </CircuitProvider>
      </>
    )
  }

  /*
   * チュートリアルはページをまたいで進むので、
   * 画面の出し分けごと Provider の内側へ入れる。
   * 案内幕（TutorialOverlay）はどの画面でも1枚だけ出す。
   */
  return (
    <TutorialProvider currentRoute={screen} onNavigate={navigate}>
      {/*
        真空のゆらぎの下地は、全画面を通して1枚だけ。ページごとに置くと
        画面を移るたびに作り直されて模様が途切れるが、ここに置けば
        相（regime）と出し具合（presence）が緩和で滑らかにつながる。
      */}
      <QuantumFluctuationField
        regime={fieldRegimeForScreen(screen, homeModeTurn)}
        presence={screen === 'home' ? 'feature' : 'ambient'}
      />
      {renderScreen()}
      <TutorialOverlay />
    </TutorialProvider>
  )
}

export default App
