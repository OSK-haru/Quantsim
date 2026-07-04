import type { CircuitPreviewData } from './circuit'

export type OutputProbabilities = Record<string, number>

export type SimulationLoadStatus = 'fixture' | 'loading' | 'api' | 'error'

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
}

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

export type SimulateRequestParameters = {
  normalized_temperature: number
  normalized_magnetic_field: number
  noise_level: number
  duration_us: number
  time_steps: number
  fidelity_threshold: number
}

export type SimulateRequestParameterErrors = Partial<
  Record<keyof SimulateRequestParameters, string>
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
  diagnostics: SimulationDiagnostics
  summary: SimulationSummaryData
  timeline: MetricPoint[]
  output_probabilities: OutputProbabilities
  run: RunPanelData
  warnings: string[]
  issues: SimulationIssue[]
}

export type MockSimulationResult = SimulationSummaryData & {
  output_probabilities: OutputProbabilities
}
