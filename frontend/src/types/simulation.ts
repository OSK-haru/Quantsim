import type { CircuitPreviewData } from './circuit'

export type OutputProbabilities = Record<string, number>

export type SimulationLoadStatus = 'fixture' | 'loading' | 'api' | 'error'
export type GateAwareEvolutionMethod = 'fixed_step_rk4' | 'explicit_cptp'

export type SimulationSummaryData = {
  final_fidelity: number | null
  final_purity: number | null
  completion_fidelity: number | null
  completion_purity: number | null
  effective_time_us: number | null
}

export type MetricPoint = {
  time_us: number
  fidelity: number | null
  purity: number | null
}

export type SerializableComplexMatrix = {
  real: number[][]
  imag: number[][]
}

export type StateSnapshotKind =
  | 'initial'
  | 'uniform_time'
  | 'custom_time'
  | 'column_boundary'
  | 'after_circuit'
  | 'idle_sample'
  | 'final'

export type StateSnapshot = {
  index: number
  requested_time_us?: number | null
  time_us?: number
  progress?: number
  kind?: StateSnapshotKind | string
  capture_method?: string | null
  event_kind?: string | null
  column_index?: number | null
  density_matrix: SerializableComplexMatrix
}

export type SnapshotOptions = {
  enabled: boolean
  uniform_count: number
  custom_times_us: number[]
  include_initial: boolean
  include_final: boolean
  include_column_boundaries: boolean
  include_after_circuit: boolean
}

export type SimulationDiagnosticsValue =
  | string
  | number
  | boolean
  | null
  | undefined

export type SimulationDiagnostics = {
  simulation_model: string
  evolution_mode: string
  simulation_backend: string
  backend_name: string
  rust_kernel_mode: string
  rust_kernel_call_count: number
  rust_kernel_sampled_batch_count: number
  backend_fallback_used: boolean
  rust_kernel_fallback_used: boolean
} & Record<string, SimulationDiagnosticsValue>

export type SimulationParameters = {
  environment_model: string
  input_mode: string
  temperature_k: number | null
  temperature_mk: number | null
  normalized_temperature: number | null
  qubit_frequency_ghz: number | null
  device_quality: number | null
  flux_noise_phi0: number | null
  duration_us: number
  time_steps: number
  fidelity_threshold: number
  simulation_backend: string
}

export type SimulationRates = {
  gamma0_per_us: number | null
  gamma_down_per_us: number | null
  gamma_up_per_us: number | null
  gamma_population_relaxation_per_us: number | null
  gamma_phi_per_us: number | null
  t1_base_us: number | null
  t1_effective_us: number | null
  tphi_base_us: number | null
  t2_effective_us: number | null
  gamma1_per_us: number | null
  gamma1_per_us_deprecation: string
}

export type PhysicalSimulationParameters = {
  device_quality: number
  temperature_mk: number
  flux_noise_phi0: number
  qubit_frequency_ghz: number
  t1_max_us: number
  tphi_max_us: number
  duration_us: number
  time_steps: number
  fidelity_threshold: number
}

export type SimulateRequestParameters = PhysicalSimulationParameters

export type SimulateRequestParameterErrors = Partial<
  Record<keyof SimulateRequestParameters, string>
>

export type GateDurationDefaults = {
  H: number
  X: number
  Z: number
  CNOT: number
  MEASURE: number
}

export type GateDurationDefaultErrors = Partial<
  Record<keyof GateDurationDefaults, string>
>

export type RunPanelData = {
  status: string
  selected_backend: string
  last_run_label: string
  can_run?: boolean
}

export type SimulationIssue = {
  level: string
  code: string
  message: string
  detail: string | null
  suggestion: string | null
}

export type SimulationResponse = {
  circuit: CircuitPreviewData
  parameters: SimulationParameters
  rates: SimulationRates
  diagnostics: SimulationDiagnostics
  summary: SimulationSummaryData
  timeline: MetricPoint[]
  output_probabilities: OutputProbabilities
  state_snapshots: StateSnapshot[]
  run: RunPanelData
  warnings: string[]
  issues: SimulationIssue[]
}

export type MockSimulationResult = SimulationSummaryData & {
  output_probabilities: OutputProbabilities
}
