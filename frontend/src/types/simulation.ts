import type { CircuitPreviewData } from './circuit'

export type OutputProbabilities = Record<string, number>

export type SimulationLoadStatus = 'fixture' | 'loading' | 'api' | 'error'
export type GateAwareEvolutionMethod = 'fixed_step_rk4' | 'explicit_cptp'
export type GateCompilationMode = 'logical_direct' | 'auto_decompose'
export type SimulationBackend = 'python_dense' | 'rust_dense_preview'

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
  | 'measurement'
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

export type PhysicalTimelineOperation = {
  gate: string
  qubits: number[]
  targets: number[]
  controls: number[]
  declared_duration_us: number
  effective_column_duration_us: number
}

export type PhysicalTimelineEvent = {
  id: string
  kind: 'circuit_column' | 'instantaneous_column' | 'idle' | string
  execution_column_index: number | null
  circuit_step: number | null
  source_circuit_columns: number[]
  start_us: number
  duration_us: number
  end_us: number
  operations: PhysicalTimelineOperation[]
}

export type PhysicalTimeline = {
  schema_version: string
  time_unit: 'us' | string
  column_timing_model: string
  total_duration_us: number
  circuit_completion_time_us: number
  sampled_times_us: number[]
  events: PhysicalTimelineEvent[]
}

export type CircuitProbe = {
  id: string
  circuit_position: {
    column_index: number | null
    boundary: 'before' | 'after' | 'completion' | 'final' | string
  }
  noisy_snapshot_index: number
  ideal_snapshot_index?: number | null
  time_us: number
}

export type StateTransferCheckpoint = {
  role: 'message' | 'receive' | string
  column_index: number
  qubit: number | null
  noisy_snapshot_index: number | null
  ideal_snapshot_index: number | null
  time_us: number | null
  available: boolean
}

export type StateTransferMetadata = {
  schema_version: string
  available: boolean
  reason: string | null
  message: { column_index: number; gate_index: number; qubit: number; operation: 'MESSAGE' | string } | null
  receive: { annotation_id: string | null; source_id: string | null; column_index: number; qubit: number | null } | null
  checkpoints: StateTransferCheckpoint[]
  metrics?: {
    noisy_message_to_receive_frobenius: number | null
    ideal_message_to_receive_frobenius: number | null
  }
}

export type MeasurementOptions = {
  shots: number
  seed: number
}

export type MeasurementResult = {
  mode: string
  shots: number
  seed: number
  counts: Record<string, number>
  frequencies: OutputProbabilities
  explicit_measurement_mode: string
  explicit_measurement_count: number
  explicit_measurement_targets: number[]
  explicit_measurement_bindings: Array<{ qubit: number; classical_bit: number }>
  classical_register_bits: number
  classical_register_mode: string
  classical_conditioning_supported: boolean
  classical_branch_count: number
  classical_branching_noise_applied: boolean
  classical_branches: Array<{
    probability: number
    classical_bits: number[]
    measurements: Array<Record<string, unknown>>
  }>
  classical_shot_preview: Array<{
    shot_index: number
    branch_index: number
    classical_bits: number[]
    measurements: Array<Record<string, unknown>>
  }>
  branch_probability_sum?: number | null
  branch_probability_normalized?: boolean | null
  branch_state_representation?: string
  conditional_operations?: Array<{
    gate: string
    targets: number[]
    conditions: Array<{ bit: number; value: number }>
    column_index: number
  }>
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
  Y: number
  Z: number
  S: number
  T: number
  RX: number
  RY: number
  RZ: number
  CNOT: number
  CZ: number
  SWAP: number
  CP: number
  CCX: number
  MEASURE: number
  MESSAGE: number
  RECEIVED: number
}

export type GateDurationDefaultErrors = Partial<
  Record<keyof GateDurationDefaults, string>
>

export type RunPanelData = {
  status: string
  selected_backend: string
  last_run_label: string
  can_run?: boolean
  compilation?: {
    mode: GateCompilationMode
    native_gate_set_id: string
    logical_gate_count: number
    compiled_gate_count: number
    logical_depth: number
    compiled_depth: number
    logical_duration_us: number | null
    compiled_duration_us: number | null
    decomposition_rules_used: string[]
    source_map: Array<{
      logical_column: number
      source_gate: string
      rule_id: string | null
      compiled_operations: Array<{
          compiled_column: number
          gate: string
          targets: number[]
          controls: number[]
          params: Record<string, number>
      }>
    }>
    compiled_circuit: {
      columns?: Array<{
        step: number
        gates: Array<{ type: string }>
      }>
    }
  }
  comparison?: {
    ideal_timeline: MetricPoint[]
    ideal_state_snapshots: StateSnapshot[]
  }
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
  physical_timeline?: PhysicalTimeline
  circuit_probes?: CircuitProbe[]
  state_transfer?: StateTransferMetadata
  output_probabilities: OutputProbabilities
  measurement: MeasurementResult
  state_snapshots: StateSnapshot[]
  run: RunPanelData
  warnings: string[]
  issues: SimulationIssue[]
}

export type MockSimulationResult = SimulationSummaryData & {
  output_probabilities: OutputProbabilities
}
