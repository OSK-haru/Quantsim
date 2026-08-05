export const TWO_LEVEL_PULSE_MODEL = 'driven_two_level_rwa_experimental_v1' as const
export const QUTRIT_PULSE_MODEL = 'driven_transmon_qutrit_rwa_experimental_v1' as const
export const COUPLED_TRANSMON_PAIR_PULSE_MODEL = 'driven_coupled_transmon_pair_rwa_experimental_v1' as const

export type PulseModelId =
  | typeof TWO_LEVEL_PULSE_MODEL
  | typeof QUTRIT_PULSE_MODEL
  | typeof COUPLED_TRANSMON_PAIR_PULSE_MODEL
export type PulseShape = 'square' | 'gaussian'
export type PulseAmplitudeMode = 'target_rotation_angle' | 'peak_amplitude'
export type PulseEnvironmentMode = 'physical' | 'direct_rates'
export type PulseEvolutionMethod = 'fixed_step_rk4' | 'explicit_cptp'
export type QuasiStaticQuadratureOrder = 3 | 5 | 7 | 9
export type PulseBackend = 'python' | 'rust' | 'auto'

export type PulseLabForm = {
  modelId: PulseModelId
  evolutionMethod: PulseEvolutionMethod
  backend: PulseBackend
  shape: PulseShape
  amplitudeMode: PulseAmplitudeMode
  targetRotationAngleRad: number
  peakAmplitudeRadPerUs: number
  pulseDurationUs: number
  sigmaUs: number
  truncationSigma: number
  totalSimulationTimeUs: number
  phaseRad: number
  detuningRadPerUs: number
  anharmonicityMhz: number
  pairSecondAnharmonicityMhz: number
  pairDetuningQ0RadPerUs: number
  pairDetuningQ1RadPerUs: number
  pairExchangeCouplingRadPerUs: number
  pairDriveTarget: 0 | 1
  pairQuasiStaticSigmaQ0RadPerUs: number
  pairQuasiStaticSigmaQ1RadPerUs: number
  pairQuasiStaticCorrelation: number
  pairQuasiStaticQuadratureOrder: 3 | 5
  pairSecondaryDriveEnabled: boolean
  pairSecondaryShape: PulseShape
  pairSecondaryAmplitudeMode: PulseAmplitudeMode
  pairSecondaryTargetRotationAngleRad: number
  pairSecondaryPeakAmplitudeRadPerUs: number
  pairSecondaryPulseDurationUs: number
  pairSecondarySigmaUs: number
  pairSecondaryTruncationSigma: number
  pairSecondaryPhaseRad: number
  pairSecondaryDetuningRadPerUs: number
  pairSecondaryDragBetaUs: number
  dragBetaUs: number
  environmentMode: PulseEnvironmentMode
  deviceQuality: number
  temperatureMk: number
  fluxNoisePhi0: number
  qubitFrequencyGhz: number
  t1MaxUs: number
  tphiMaxUs: number
  gammaDownPerUs: number
  gammaUpPerUs: number
  gammaPhiPerUs: number
  gamma10DownPerUs: number
  gamma01UpPerUs: number
  gamma21DownPerUs: number
  gamma12UpPerUs: number
  gammaPhiAdjacentPerUs: number
  quasiStaticNoiseEnabled: boolean
  quasiStaticDetuningSigmaRadPerUs: number
  quasiStaticQuadratureOrder: QuasiStaticQuadratureOrder
  snapshotCount: number
}

export type PulseLabField = keyof PulseLabForm
export type PulseLabErrors = Partial<Record<PulseLabField, string>>

export type PulseComplexValue = {
  real: number
  imag: number
}

export type PulsePhysicality = {
  trace_error: number
  hermiticity_error: number
  minimum_eigenvalue: number
}

export type PulseEvolutionDiagnostics = {
  internal_step_count: number
  rhs_evaluation_count: number
  hamiltonian_evaluation_count: number
  minimum_internal_step_us: number
  maximum_internal_step_us: number
  raw_trace_error: number
  raw_hermiticity_error: number
  raw_minimum_eigenvalue: number
  cleanup_correction_norm: number
  actual_duration_us: number
}

export type TwoLevelPulsePoint = {
  time_us: number
  segment: 'pulse' | 'idle'
  open_population_0: number
  open_population_1: number
  closed_population_0: number
  closed_population_1: number
  fidelity_to_closed: number
  purity: number
  raw_physicality: PulsePhysicality
  cleaned_physicality: PulsePhysicality
  cleanup_correction_norm: number
}

export type TwoLevelPulseState = TwoLevelPulsePoint & {
  open_density_matrix: PulseComplexValue[][]
  closed_density_matrix: PulseComplexValue[][]
}

export type TwoLevelPulseResponse = {
  contract_version: 'pulse-baseline-a-v1'
  model: {
    model_id: typeof TWO_LEVEL_PULSE_MODEL
    description: string
    frame: 'rotating'
    approximation: 'RWA'
    logical_qubits: 1
    state_levels: 2
    experimental: true
    hardware_calibrated: false
    internal_units: PulseUnits
  }
  input: Record<string, string | number | null>
  rates: Record<string, string | number | null>
  step_policy: Record<string, string | number | boolean | null>
  sample_times_us: number[]
  trajectory: TwoLevelPulsePoint[]
  pulse_end: TwoLevelPulseState
  final: TwoLevelPulseState
  diagnostics: PulseDiagnostics
  warnings: string[]
  limitations: string[]
}

export type QutritPulsePoint = {
  time_us: number
  segment: 'pulse' | 'idle' | 'virtual_z'
  population_0: number
  population_1: number
  population_2: number
  computational_population: number
  leakage_probability: number
  population_sum_error: number
  purity: number
  density_matrix: PulseComplexValue[][]
  raw_physicality: PulsePhysicality
  cleaned_physicality: PulsePhysicality
  cleanup_correction_norm: number
  sequence_step_index?: number
  sequence_step_label?: string
}

export type QutritPulseResponse = {
  contract_version: 'pulse-extension-b-v1'
  model: {
    model_id: typeof QUTRIT_PULSE_MODEL
    description: string
    frame: 'rotating'
    approximation: 'RWA'
    logical_qubits: 1
    state_levels: 3
    basis_order: ['0', '1', '2']
    subsystem_dimensions: [3]
    experimental: true
    hardware_calibrated: false
    internal_units: PulseUnits
  }
  input: Record<string, string | number | null>
  rates: Record<string, string | number | null>
  step_policy: Record<string, string | number | boolean | null>
  sample_times_us: number[]
  trajectory: QutritPulsePoint[]
  leakage: {
    maximum_recorded_leakage_probability: number
    leakage_at_pulse_end: number
    leakage_at_final_time: number
  }
  pulse_end: QutritPulsePoint
  final: QutritPulsePoint
  diagnostics: PulseDiagnostics
  warnings: string[]
  limitations: string[]
}

export type CoupledTransmonPairPoint = {
  time_us: number
  segment: 'pulse' | 'idle'
  joint_populations: Record<string, number>
  computational_population: number
  leakage_probability: number
  population_sum_error: number
  purity: number
  density_matrix: PulseComplexValue[][]
  raw_physicality: PulsePhysicality
  cleaned_physicality: PulsePhysicality
  cleanup_correction_norm: number
}

export type CoupledTransmonPairResponse = {
  contract_version: 'pulse-coupled-pair-v1'
  model: Record<string, unknown> & {
    model_id: typeof COUPLED_TRANSMON_PAIR_PULSE_MODEL
    description: string
    basis_order: string[]
  }
  input: Record<string, unknown>
  rates: Array<Record<string, unknown>>
  step_policy: Record<string, unknown>
  sample_times_us: number[]
  trajectory: CoupledTransmonPairPoint[]
  leakage: {
    maximum_recorded_leakage_probability: number
    leakage_at_pulse_end: number
    leakage_at_final_time: number
  }
  pulse_end: CoupledTransmonPairPoint
  final: CoupledTransmonPairPoint
  diagnostics: Record<string, unknown> & PulseDiagnostics
  warnings: string[]
  limitations: string[]
}

type PulseUnits = {
  time: 'us'
  angular_frequency: 'rad/us'
  rate: '1/us'
}

type PulseDiagnostics = {
  api_runtime_ms: number
  evolution: {
    requested: PulseEvolutionMethod
    resolved: PulseEvolutionMethod
    method_id:
      | 'fixed_step_rk4_v1'
      | 'explicit_cptp_midpoint_gksl_v1'
    cptp_guaranteed_by_construction: boolean
    cleanup_applied: boolean
    open_pulse_audit: Record<string, unknown> | null
    open_idle_audit: Record<string, unknown> | null
    closed_pulse_audit: Record<string, unknown> | null
    closed_idle_audit: Record<string, unknown> | null
  }
  open_pulse: PulseEvolutionDiagnostics
  open_idle: PulseEvolutionDiagnostics | null
  maximum_cleaned_trace_error: number
  maximum_cleaned_hermiticity_error: number
  minimum_cleaned_eigenvalue: number
} & Record<string, unknown>

export type PulseResponse = TwoLevelPulseResponse | QutritPulseResponse | CoupledTransmonPairResponse

export type PulseWaveformPoint = {
  timeUs: number
  omegaX: number
  omegaY: number
}

export type PulseCostEstimate = {
  estimatedInternalSteps: number
  maximumInternalSteps: number
  overBudget: boolean
  level: 'normal' | 'elevated' | 'blocked'
  message: string
}

export function isQutritPulseResponse(
  response: PulseResponse,
): response is QutritPulseResponse {
  return response.model.model_id === QUTRIT_PULSE_MODEL
}


export function isCoupledTransmonPairResponse(
  response: PulseResponse,
): response is CoupledTransmonPairResponse {
  return response.model.model_id === COUPLED_TRANSMON_PAIR_PULSE_MODEL
}
