import { useEffect, useMemo, useRef, useState } from 'react'
import './ParameterAnimationView.css'
import { CircuitProbeView } from './CircuitProbeView'
import type { CircuitEditorState } from '../types/circuit'
import type {
  GateDurationDefaults,
  GateAwareEvolutionMethod,
  SimulationBackend,
  SimulationResponse,
} from '../types/simulation'
import type { CircuitConfig } from '../utils/circuitConfig'

type ParameterAnimationViewProps = {
  circuit: CircuitEditorState
  circuitConfig: CircuitConfig
  gateDurationDefaults: GateDurationDefaults
  baseResponse: SimulationResponse
}

export type ParameterizedGate = {
  columnIndex: number
  gateIndex: number
  gateType: string
  thetaRad: number
  parameterName: 'theta_rad'
}

const MIN_THETA = -Math.PI
const MAX_THETA = Math.PI
const FRAME_DELAY_MS = 650

export function ParameterAnimationView({
  circuit,
  circuitConfig,
  gateDurationDefaults,
  baseResponse,
}: ParameterAnimationViewProps) {
  const parameterizedGates = useMemo(() => findParameterizedGates(circuit), [circuit])
  const targetGate = parameterizedGates[0]
  const [thetaRad, setThetaRad] = useState(targetGate?.thetaRad ?? 0)
  const [frameResponse, setFrameResponse] = useState<SimulationResponse>(baseResponse)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const thetaRadRef = useRef(thetaRad)
  const requestRef = useRef<AbortController | null>(null)
  const requestDebounceRef = useRef<number | null>(null)
  const animationTimerRef = useRef<number | null>(null)
  const playingRef = useRef(false)

  useEffect(() => () => {
    requestRef.current?.abort()
    if (requestDebounceRef.current !== null) window.clearTimeout(requestDebounceRef.current)
    if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current)
  }, [])

  if (!targetGate) {
    return (
      <section className="parameter-animation-view parameter-animation-view--empty">
        <span>PARAMETER ANIMATION</span>
        <h2>Quirk-style parameter animation</h2>
        <p>RX / RY / RZ / CP の theta_rad を持つゲートがある回路で利用できます。</p>
      </section>
    )
  }

  function scheduleNextFrame() {
    if (!playingRef.current) return
    animationTimerRef.current = window.setTimeout(() => {
      const currentTheta = thetaRadRef.current
      const maxValue = MAX_THETA
      const minValue = MIN_THETA
      const step = 0.16
      const nextTheta = currentTheta >= maxValue - 0.01 ? minValue : currentTheta + step
      thetaRadRef.current = nextTheta
      setThetaRad(nextTheta)
      void requestFrame(nextTheta)
      scheduleNextFrame()
    }, FRAME_DELAY_MS)
  }

  function togglePlaying() {
    const nextPlaying = !playingRef.current
    playingRef.current = nextPlaying
    setPlaying(nextPlaying)
    if (nextPlaying) scheduleNextFrame()
    else if (animationTimerRef.current !== null) window.clearTimeout(animationTimerRef.current)
  }

  function handleThetaChange(nextTheta: number) {
    thetaRadRef.current = nextTheta
    setThetaRad(nextTheta)
    if (requestDebounceRef.current !== null) window.clearTimeout(requestDebounceRef.current)
    requestDebounceRef.current = window.setTimeout(() => {
      requestDebounceRef.current = null
      void requestFrame(nextTheta)
    }, 180)
  }

  async function requestFrame(nextTheta: number) {
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setStatus('loading')
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/simulate?animation_parameter=theta_rad&ts=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildAnimationPayload(
          circuitConfig,
          targetGate,
          nextTheta,
          gateDurationDefaults,
          baseResponse,
        )),
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const parsed = await response.json() as SimulationResponse
      setFrameResponse(parsed)
      setStatus('idle')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'parameter animation failed')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return (
    <section className="parameter-animation-view" aria-labelledby="parameter-animation-title">
      <div className="parameter-animation-view__heading">
        <div><span>PARAMETER ANIMATION</span><h2 id="parameter-animation-title">回路全体を同じ θ で再評価</h2></div>
        <span className="parameter-animation-view__badge">{targetGate.gateType} · θ</span>
      </div>
      <p className="parameter-animation-view__description">
        これは物理時間の再生ではありません。θを一つのアニメーションパラメータとして変化させ、各値で同じ回路をバックエンドから再計算します。ノイズあり／理想のprobeは同じθの結果です。
      </p>
      <div className="parameter-animation-view__controls">
        <button type="button" onClick={togglePlaying}>{playing ? '一時停止' : '再生'}</button>
        <label>
          <span>θ = {thetaRad.toFixed(3)} rad</span>
          <input type="range" min={MIN_THETA} max={MAX_THETA} step="0.01" value={thetaRad} onChange={(event) => { playingRef.current = false; setPlaying(false); handleThetaChange(Number(event.currentTarget.value)) }} />
        </label>
        <button type="button" onClick={() => { playingRef.current = false; setPlaying(false); handleThetaChange(0) }}>リセット</button>
      </div>
      <div className="parameter-animation-view__status" aria-live="polite">
        {status === 'loading' ? 'θの値で回路を再評価中…' : status === 'error' ? errorMessage : `対象ゲート: 第${targetGate.columnIndex + 1}列 ${targetGate.gateType}`}
      </div>
      <CircuitProbeView
        circuit={circuit}
        gateDurationDefaults={gateDurationDefaults}
        probes={frameResponse.circuit_probes}
        noisySnapshots={frameResponse.state_snapshots}
        idealSnapshots={frameResponse.run.comparison?.ideal_state_snapshots ?? []}
      />
    </section>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function findParameterizedGates(circuit: CircuitEditorState): ParameterizedGate[] {
  const supported = new Set(['RX', 'RY', 'RZ', 'CP'])
  return circuit.columns.flatMap((column, columnIndex) => column.gates.flatMap((gate, gateIndex) => {
    if (!supported.has(gate.type)) return []
    return [{
      columnIndex,
      gateIndex,
      gateType: gate.type,
      thetaRad: gate.params?.theta_rad ?? 0,
      parameterName: 'theta_rad',
    }]
  }))
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildAnimationPayload(
  circuitConfig: CircuitConfig,
  targetGate: ParameterizedGate,
  thetaRad: number,
  gateDurationDefaults: GateDurationDefaults,
  baseResponse: SimulationResponse,
) {
  const parameters = baseResponse.parameters
  const inputMode = parameters.input_mode === 'normalized' ? 'normalized' : 'physical'
  const physicalParameters = {
    device_quality: parameters.device_quality ?? 0.8,
    temperature_mk: parameters.temperature_mk ?? 15,
    flux_noise_phi0: parameters.flux_noise_phi0 ?? 1e-6,
    qubit_frequency_ghz: parameters.qubit_frequency_ghz ?? 5,
    t1_max_us: baseResponse.rates.t1_base_us ?? 100,
    tphi_max_us: baseResponse.rates.tphi_base_us ?? 100,
  }
  const normalizedParameters = {
    normalized_temperature: parameters.normalized_temperature ?? 0,
    normalized_magnetic_field: 0,
    noise_level: 0,
  }
  return {
    simulation_backend: resolveBackend(baseResponse),
    evolution_method: resolveEvolutionMethod(baseResponse),
    compilation_mode: baseResponse.run.compilation?.mode ?? 'logical_direct',
    input_mode: inputMode,
    circuit_config: circuitConfig,
    animation_parameter: {
      name: targetGate.parameterName,
      value: thetaRad,
      column_index: targetGate.columnIndex,
      gate_index: targetGate.gateIndex,
    },
    gate_duration_defaults: gateDurationDefaults,
    measurement_options: { shots: baseResponse.measurement.shots, seed: baseResponse.measurement.seed },
    snapshot_options: { enabled: true, uniform_count: 0, custom_times_us: [], include_initial: true, include_final: true, include_column_boundaries: true, include_after_circuit: true },
    parameters: {
      ...parameters,
      ...physicalParameters,
      ...normalizedParameters,
      duration_us: parameters.duration_us,
      time_steps: parameters.time_steps,
      fidelity_threshold: parameters.fidelity_threshold,
    },
  }
}

function resolveBackend(response: SimulationResponse): SimulationBackend {
  return response.diagnostics.backend_requested === 'rust_dense_preview' ? 'rust_dense_preview' : 'python_dense'
}

function resolveEvolutionMethod(response: SimulationResponse): GateAwareEvolutionMethod {
  return response.diagnostics.evolution_method_requested === 'explicit_cptp' ? 'explicit_cptp' : 'fixed_step_rk4'
}
