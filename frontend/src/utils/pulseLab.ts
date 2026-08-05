import {
  QUTRIT_PULSE_MODEL,
  COUPLED_TRANSMON_PAIR_PULSE_MODEL,
  TWO_LEVEL_PULSE_MODEL,
  type PulseCostEstimate,
  type PulseLabErrors,
  type PulseLabForm,
  type PulseComplexValue,
  type PulseResponse,
  type PulseWaveformPoint,
  type QutritPulsePoint,
} from '../types/pulse'

const QUTRIT_API_MAX_STEPS = 25000
const PAIR_API_MAX_STEPS = 15000
const TWO_LEVEL_API_MAX_STEPS = 200000
const EPSILON_H = 0.02
const EPSILON_D = 0.02
const QUTRIT_SAMPLES_PER_SIGMA = 32

export const initialPulseLabForm: PulseLabForm = {
  modelId: QUTRIT_PULSE_MODEL,
  evolutionMethod: 'fixed_step_rk4',
  backend: 'auto',
  shape: 'gaussian',
  amplitudeMode: 'target_rotation_angle',
  targetRotationAngleRad: Math.PI / 2,
  peakAmplitudeRadPerUs: 20,
  pulseDurationUs: 0.02,
  sigmaUs: 0.002,
  truncationSigma: 4,
  totalSimulationTimeUs: 0.02,
  phaseRad: 0,
  detuningRadPerUs: 0,
  anharmonicityMhz: -100,
  pairSecondAnharmonicityMhz: -110,
  pairDetuningQ0RadPerUs: 0,
  pairDetuningQ1RadPerUs: 30,
  pairExchangeCouplingRadPerUs: 5,
  pairDriveTarget: 0,
  pairQuasiStaticSigmaQ0RadPerUs: 0,
  pairQuasiStaticSigmaQ1RadPerUs: 0,
  pairQuasiStaticCorrelation: 0,
  pairQuasiStaticQuadratureOrder: 3,
  pairSecondaryDriveEnabled: false,
  pairSecondaryShape: 'gaussian',
  pairSecondaryAmplitudeMode: 'target_rotation_angle',
  pairSecondaryTargetRotationAngleRad: Math.PI / 2,
  pairSecondaryPeakAmplitudeRadPerUs: 20,
  pairSecondaryPulseDurationUs: 0.02,
  pairSecondarySigmaUs: 0.002,
  pairSecondaryTruncationSigma: 4,
  pairSecondaryPhaseRad: 0,
  pairSecondaryDetuningRadPerUs: 0,
  pairSecondaryDragBetaUs: 0,
  dragBetaUs: 0.001,
  environmentMode: 'physical',
  deviceQuality: 0.8,
  temperatureMk: 15,
  fluxNoisePhi0: 0.000001,
  qubitFrequencyGhz: 5,
  t1MaxUs: 100,
  tphiMaxUs: 100,
  gammaDownPerUs: 0.1,
  gammaUpPerUs: 0.02,
  gammaPhiPerUs: 0.05,
  gamma10DownPerUs: 0.2,
  gamma01UpPerUs: 0.02,
  gamma21DownPerUs: 0.4,
  gamma12UpPerUs: 0.03,
  gammaPhiAdjacentPerUs: 0.08,
  quasiStaticNoiseEnabled: false,
  quasiStaticDetuningSigmaRadPerUs: 0.5,
  quasiStaticQuadratureOrder: 5,
  snapshotCount: 101,
}

export function pulseDurationUs(form: PulseLabForm): number {
  return form.shape === 'square'
    ? form.pulseDurationUs
    : 2 * form.sigmaUs * form.truncationSigma
}

export function validatePulseLabForm(form: PulseLabForm): PulseLabErrors {
  const errors: PulseLabErrors = {}
  const positive = (key: keyof PulseLabForm, value: number, label: string) => {
    if (!Number.isFinite(value) || value <= 0) {
      errors[key] = `${label} must be greater than 0.`
    }
  }
  const nonnegative = (key: keyof PulseLabForm, value: number, label: string) => {
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = `${label} must be 0 or greater.`
    }
  }

  positive('totalSimulationTimeUs', form.totalSimulationTimeUs, 'Total simulation time')
  if (form.shape === 'square') {
    positive('pulseDurationUs', form.pulseDurationUs, 'Pulse duration')
  } else {
    positive('sigmaUs', form.sigmaUs, 'Gaussian sigma')
    positive('truncationSigma', form.truncationSigma, 'Truncation sigma')
  }
  if (form.amplitudeMode === 'target_rotation_angle') {
    if (!Number.isFinite(form.targetRotationAngleRad)) {
      errors.targetRotationAngleRad = 'Target angle must be finite.'
    }
  } else {
    if (!Number.isFinite(form.peakAmplitudeRadPerUs)) {
      errors.peakAmplitudeRadPerUs = 'Peak amplitude must be finite.'
    }
  }
  if (!Number.isFinite(form.phaseRad)) {
    errors.phaseRad = 'Phase must be finite.'
  }
  if (!Number.isFinite(form.detuningRadPerUs)) {
    errors.detuningRadPerUs = 'Detuning must be finite.'
  }
  nonnegative(
    'quasiStaticDetuningSigmaRadPerUs',
    form.quasiStaticDetuningSigmaRadPerUs,
    'Quasi-static detuning sigma',
  )
  if (form.quasiStaticNoiseEnabled && form.quasiStaticDetuningSigmaRadPerUs <= 0) {
    errors.quasiStaticDetuningSigmaRadPerUs =
      'Enabled quasi-static noise requires a sigma greater than 0.'
  }
  if (![3, 5, 7, 9].includes(form.quasiStaticQuadratureOrder)) {
    errors.quasiStaticQuadratureOrder = 'Quadrature order must be 3, 5, 7, or 9.'
  }
  if (pulseDurationUs(form) > form.totalSimulationTimeUs) {
    errors.totalSimulationTimeUs =
      'Total simulation time must include the full pulse duration.'
  }
  if (
    !Number.isInteger(form.snapshotCount) ||
    form.snapshotCount < 2 ||
    form.snapshotCount > 1001
  ) {
    errors.snapshotCount = 'Snapshot count must be an integer from 2 to 1001.'
  }

  if (form.modelId !== TWO_LEVEL_PULSE_MODEL) {
    if (!Number.isFinite(form.anharmonicityMhz) || form.anharmonicityMhz >= 0) {
      errors.anharmonicityMhz = 'Anharmonicity must be a finite negative value.'
    }
    if (form.shape === 'gaussian') {
      if (!Number.isFinite(form.dragBetaUs)) {
        errors.dragBetaUs = 'DRAG beta must be finite.'
      }
    }
    if (
      form.environmentMode === 'physical' &&
      form.qubitFrequencyGhz + form.anharmonicityMhz / 1000 <= 0
    ) {
      errors.anharmonicityMhz =
        'The resulting |1>-|2> transition frequency must remain positive.'
    }
  }
  if (form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL) {
    if (!Number.isFinite(form.pairSecondAnharmonicityMhz) || form.pairSecondAnharmonicityMhz >= 0) {
      errors.pairSecondAnharmonicityMhz = 'The second anharmonicity must be finite and negative.'
    }
    if (!Number.isFinite(form.pairDetuningQ0RadPerUs)) {
      errors.pairDetuningQ0RadPerUs = 'q0 detuning must be finite.'
    }
    if (!Number.isFinite(form.pairDetuningQ1RadPerUs)) {
      errors.pairDetuningQ1RadPerUs = 'q1 detuning must be finite.'
    }
    nonnegative(
      'pairExchangeCouplingRadPerUs',
      form.pairExchangeCouplingRadPerUs,
      'Exchange coupling',
    )
    nonnegative('pairQuasiStaticSigmaQ0RadPerUs', form.pairQuasiStaticSigmaQ0RadPerUs, 'q0 quasi-static sigma')
    nonnegative('pairQuasiStaticSigmaQ1RadPerUs', form.pairQuasiStaticSigmaQ1RadPerUs, 'q1 quasi-static sigma')
    if (!Number.isFinite(form.pairQuasiStaticCorrelation) || Math.abs(form.pairQuasiStaticCorrelation) > 1) {
      errors.pairQuasiStaticCorrelation = 'Noise correlation must be between -1 and 1.'
    }
    if (form.pairSecondaryDriveEnabled) {
      if (
        form.pairSecondaryAmplitudeMode === 'target_rotation_angle'
        && !Number.isFinite(form.pairSecondaryTargetRotationAngleRad)
      ) {
        errors.pairSecondaryTargetRotationAngleRad = 'Secondary target angle must be finite.'
      }
      if (
        form.pairSecondaryAmplitudeMode === 'peak_amplitude'
        && !Number.isFinite(form.pairSecondaryPeakAmplitudeRadPerUs)
      ) {
        errors.pairSecondaryPeakAmplitudeRadPerUs = 'Secondary peak amplitude must be finite.'
      }
      if (form.pairSecondaryShape === 'square') {
        positive('pairSecondaryPulseDurationUs', form.pairSecondaryPulseDurationUs, 'Secondary pulse duration')
      } else {
        positive('pairSecondarySigmaUs', form.pairSecondarySigmaUs, 'Secondary Gaussian sigma')
        positive('pairSecondaryTruncationSigma', form.pairSecondaryTruncationSigma, 'Secondary truncation sigma')
      }
      if (!Number.isFinite(form.pairSecondaryPhaseRad)) {
        errors.pairSecondaryPhaseRad = 'Secondary phase must be finite.'
      }
      if (!Number.isFinite(form.pairSecondaryDetuningRadPerUs)) {
        errors.pairSecondaryDetuningRadPerUs = 'Secondary detuning must be finite.'
      }
      if (!Number.isFinite(form.pairSecondaryDragBetaUs)) {
        errors.pairSecondaryDragBetaUs = 'Secondary DRAG beta must be finite.'
      }
      const secondaryDuration = form.pairSecondaryShape === 'square'
        ? form.pairSecondaryPulseDurationUs
        : 2 * form.pairSecondarySigmaUs * form.pairSecondaryTruncationSigma
      if (secondaryDuration > form.totalSimulationTimeUs) {
        errors.totalSimulationTimeUs = 'Total time must include both simultaneous pulses.'
      }
    }
  }

  if (form.environmentMode === 'physical') {
    if (
      !Number.isFinite(form.deviceQuality) ||
      form.deviceQuality < 0 ||
      form.deviceQuality > 1
    ) {
      errors.deviceQuality = 'Device quality must be between 0 and 1.'
    }
    nonnegative('temperatureMk', form.temperatureMk, 'Temperature')
    nonnegative('fluxNoisePhi0', form.fluxNoisePhi0, 'Flux noise')
    positive('qubitFrequencyGhz', form.qubitFrequencyGhz, 'Qubit frequency')
    positive('t1MaxUs', form.t1MaxUs, 'Max T1')
    positive('tphiMaxUs', form.tphiMaxUs, 'Max Tphi')
  } else if (form.modelId === TWO_LEVEL_PULSE_MODEL) {
    nonnegative('gammaDownPerUs', form.gammaDownPerUs, 'gamma down')
    nonnegative('gammaUpPerUs', form.gammaUpPerUs, 'gamma up')
    nonnegative('gammaPhiPerUs', form.gammaPhiPerUs, 'gamma phi')
  } else {
    nonnegative('gamma10DownPerUs', form.gamma10DownPerUs, 'gamma 10 down')
    nonnegative('gamma01UpPerUs', form.gamma01UpPerUs, 'gamma 01 up')
    nonnegative('gamma21DownPerUs', form.gamma21DownPerUs, 'gamma 21 down')
    nonnegative('gamma12UpPerUs', form.gamma12UpPerUs, 'gamma 12 up')
    nonnegative(
      'gammaPhiAdjacentPerUs',
      form.gammaPhiAdjacentPerUs,
      'adjacent dephasing rate',
    )
  }
  return errors
}

export function buildPulsePayload(
  form: PulseLabForm,
  initialDensityMatrix?: PulseComplexValue[][],
): Record<string, unknown> {
  const pulse =
    form.shape === 'square'
      ? {
          shape: 'square',
          amplitude_mode: form.amplitudeMode,
          ...(form.amplitudeMode === 'target_rotation_angle'
            ? { target_rotation_angle_rad: form.targetRotationAngleRad }
            : { peak_amplitude_rad_per_us: form.peakAmplitudeRadPerUs }),
          pulse_duration_us: form.pulseDurationUs,
          phase_rad: form.phaseRad,
          detuning_rad_per_us: form.detuningRadPerUs,
          drag_beta_us: 0,
        }
      : {
          shape: 'gaussian',
          amplitude_mode: form.amplitudeMode,
          ...(form.amplitudeMode === 'target_rotation_angle'
            ? { target_rotation_angle_rad: form.targetRotationAngleRad }
            : { peak_amplitude_rad_per_us: form.peakAmplitudeRadPerUs }),
          sigma_us: form.sigmaUs,
          truncation_sigma: form.truncationSigma,
          phase_rad: form.phaseRad,
          detuning_rad_per_us: form.detuningRadPerUs,
          drag_beta_us:
            form.modelId !== TWO_LEVEL_PULSE_MODEL ? form.dragBetaUs : 0,
        }
  const environment =
    form.environmentMode === 'physical'
      ? {
          input_mode: 'physical',
          device_quality: form.deviceQuality,
          temperature_mk: form.temperatureMk,
          flux_noise_phi0: form.fluxNoisePhi0,
          qubit_frequency_ghz: form.qubitFrequencyGhz,
          t1_max_us: form.t1MaxUs,
          tphi_max_us: form.tphiMaxUs,
        }
      : form.modelId === TWO_LEVEL_PULSE_MODEL
        ? {
            input_mode: 'direct_rates',
            gamma_down_per_us: form.gammaDownPerUs,
            gamma_up_per_us: form.gammaUpPerUs,
            gamma_phi_per_us: form.gammaPhiPerUs,
          }
        : {
            input_mode: 'direct_rates',
            gamma_10_down_per_us: form.gamma10DownPerUs,
            gamma_01_up_per_us: form.gamma01UpPerUs,
            gamma_21_down_per_us: form.gamma21DownPerUs,
            gamma_12_up_per_us: form.gamma12UpPerUs,
            gamma_phi_adjacent_per_us: form.gammaPhiAdjacentPerUs,
          }

  return {
    model_id: form.modelId,
    initial_state: '0',
    ...(initialDensityMatrix ? { initial_density_matrix: initialDensityMatrix } : {}),
    ...(form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
      ? {
          initial_state: '00',
          anharmonicities_mhz: [
            form.anharmonicityMhz,
            form.pairSecondAnharmonicityMhz,
          ],
          detunings_rad_per_us: [
            form.pairDetuningQ0RadPerUs,
            form.pairDetuningQ1RadPerUs,
          ],
          exchange_coupling_rad_per_us: form.pairExchangeCouplingRadPerUs,
          drive_target: form.pairDriveTarget,
          backend: form.backend,
          quasi_static_detuning_sigmas_rad_per_us: [
            form.pairQuasiStaticSigmaQ0RadPerUs,
            form.pairQuasiStaticSigmaQ1RadPerUs,
          ],
          quasi_static_detuning_correlation: form.pairQuasiStaticCorrelation,
          quasi_static_quadrature_order: form.pairQuasiStaticQuadratureOrder,
          ...(form.pairSecondaryDriveEnabled
            ? { secondary_pulse: buildSecondaryPairPulse(form) }
            : {}),
        }
      : form.modelId === QUTRIT_PULSE_MODEL
      ? {
          anharmonicity_mhz: form.anharmonicityMhz,
          quasi_static_noise: {
            enabled: form.quasiStaticNoiseEnabled,
            sigma_detuning_rad_per_us: form.quasiStaticNoiseEnabled
              ? form.quasiStaticDetuningSigmaRadPerUs
              : 0,
            quadrature_order: form.quasiStaticQuadratureOrder,
          },
        }
      : {}),
    pulse,
    total_simulation_time_us: form.totalSimulationTimeUs,
    evolution_method: form.evolutionMethod,
    ...(form.modelId !== COUPLED_TRANSMON_PAIR_PULSE_MODEL
      ? { backend: form.backend }
      : {}),
    environment,
    snapshot_options: {
      uniform_count: form.snapshotCount,
      custom_times_us: [pulseDurationUs(form)],
    },
  }
}

export function pulseWaveform(form: PulseLabForm, count = 121): PulseWaveformPoint[] {
  const duration = Math.max(0, pulseDurationUs(form))
  const peak = peakAmplitude(form)
  const cosine = Math.cos(form.phaseRad)
  const sine = Math.sin(form.phaseRad)
  const safeSigmaUs = Math.max(Math.abs(form.sigmaUs), 1e-12)
  return Array.from({ length: count }, (_, index) => {
    const timeUs = (duration * index) / (count - 1)
    let amplitude = peak
    let derivative = 0
    if (form.shape === 'gaussian') {
      const offset = timeUs - duration / 2
      amplitude = peak * Math.exp(-(offset * offset) / (2 * safeSigmaUs ** 2))
      derivative = (-offset / safeSigmaUs ** 2) * amplitude
    }
    const quadrature =
      form.modelId !== TWO_LEVEL_PULSE_MODEL && form.shape === 'gaussian'
        ? form.dragBetaUs * derivative
        : 0
    return {
      timeUs,
      omegaX: amplitude * cosine - quadrature * sine,
      omegaY: amplitude * sine + quadrature * cosine,
    }
  })
}

export function estimatePulseCost(form: PulseLabForm): PulseCostEstimate {
  if (form.modelId === TWO_LEVEL_PULSE_MODEL) {
    const estimated = Math.max(form.snapshotCount, Math.ceil(form.totalSimulationTimeUs / 0.001))
    return costResult(estimated, TWO_LEVEL_API_MAX_STEPS)
  }

  const pair = form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
  const secondaryDuration = form.pairSecondaryShape === 'square'
    ? form.pairSecondaryPulseDurationUs
    : 2 * form.pairSecondarySigmaUs * form.pairSecondaryTruncationSigma
  const duration = pair && form.pairSecondaryDriveEnabled
    ? Math.max(pulseDurationUs(form), secondaryDuration)
    : pulseDurationUs(form)
  const peak = Math.abs(peakAmplitude(form))
  const dragMagnitude =
    form.shape === 'gaussian'
      ? Math.abs(form.dragBetaUs) * peak / Math.max(form.sigmaUs, 1e-12)
      : 0
  const primaryDrive = Math.hypot(peak, dragMagnitude)
  const secondaryPeak = form.pairSecondaryAmplitudeMode === 'peak_amplitude'
    ? Math.abs(form.pairSecondaryPeakAmplitudeRadPerUs)
    : form.pairSecondaryShape === 'square'
      ? Math.abs(form.pairSecondaryTargetRotationAngleRad / Math.max(form.pairSecondaryPulseDurationUs, 1e-12))
      : Math.abs(form.pairSecondaryTargetRotationAngleRad / Math.max(
          form.pairSecondarySigmaUs * Math.sqrt(2 * Math.PI),
          1e-12,
        ))
  const drive = pair && form.pairSecondaryDriveEnabled
    ? Math.max(primaryDrive, secondaryPeak)
    : primaryDrive
  const detuningForCost = form.quasiStaticNoiseEnabled
    ? Math.abs(form.detuningRadPerUs) + 5 * form.quasiStaticDetuningSigmaRadPerUs
    : form.detuningRadPerUs
  const detuning = pair
    ? Math.max(
        Math.abs(form.pairDetuningQ0RadPerUs),
        Math.abs(form.pairDetuningQ1RadPerUs),
      )
    : detuningForCost
  const diagonal = [
    0,
    -detuning,
    -2 * detuning + form.anharmonicityMhz * 2 * Math.PI,
  ]
  const diagonalSpan = Math.max(...diagonal) - Math.min(...diagonal)
  const hamiltonianScale = diagonalSpan + 2 * Math.SQRT2 * drive
    + (pair ? 4 * form.pairExchangeCouplingRadPerUs : 0)
  const dissipationScale =
    form.environmentMode === 'direct_rates'
      ? form.gamma10DownPerUs +
        form.gamma01UpPerUs +
        form.gamma21DownPerUs +
        form.gamma12UpPerUs +
        4 * form.gammaPhiAdjacentPerUs
      : 0
  const limits = [
    duration,
    EPSILON_H / Math.max(hamiltonianScale, 1e-12),
    ...(dissipationScale > 0 ? [EPSILON_D / dissipationScale] : []),
    ...(form.shape === 'gaussian' ? [form.sigmaUs / QUTRIT_SAMPLES_PER_SIGMA] : []),
  ]
  const baseStep = Math.min(...limits.filter((value) => Number.isFinite(value) && value > 0))
  const step = pair && form.evolutionMethod === 'explicit_cptp'
    ? Math.min(baseStep * 5, duration / 8)
    : baseStep
  const singleEvolutionEstimate =
    Math.ceil(duration / step) +
    Math.ceil(Math.max(0, form.totalSimulationTimeUs - duration) / step) +
    form.snapshotCount
  const activePairNoiseAxes = Number(form.pairQuasiStaticSigmaQ0RadPerUs > 0)
    + Number(form.pairQuasiStaticSigmaQ1RadPerUs > 0)
  const ensembleMultiplier = pair && activePairNoiseAxes > 0
    ? form.pairQuasiStaticQuadratureOrder ** activePairNoiseAxes
    : form.quasiStaticNoiseEnabled ? form.quasiStaticQuadratureOrder : 1
  const estimated = singleEvolutionEstimate * ensembleMultiplier
  const pairMaximum = form.evolutionMethod === 'explicit_cptp'
    && ensembleMultiplier === 1 ? 500 : PAIR_API_MAX_STEPS
  return costResult(estimated, pair ? pairMaximum : QUTRIT_API_MAX_STEPS)
}

function buildSecondaryPairPulse(form: PulseLabForm): Record<string, unknown> {
  return {
    shape: form.pairSecondaryShape,
    amplitude_mode: form.pairSecondaryAmplitudeMode,
    ...(form.pairSecondaryAmplitudeMode === 'target_rotation_angle'
      ? { target_rotation_angle_rad: form.pairSecondaryTargetRotationAngleRad }
      : { peak_amplitude_rad_per_us: form.pairSecondaryPeakAmplitudeRadPerUs }),
    ...(form.pairSecondaryShape === 'square'
      ? { pulse_duration_us: form.pairSecondaryPulseDurationUs }
      : {
          sigma_us: form.pairSecondarySigmaUs,
          truncation_sigma: form.pairSecondaryTruncationSigma,
        }),
    phase_rad: form.pairSecondaryPhaseRad,
    detuning_rad_per_us: form.pairSecondaryDetuningRadPerUs,
    drag_beta_us: form.pairSecondaryShape === 'gaussian'
      ? form.pairSecondaryDragBetaUs
      : 0,
  }
}

export function qutritTargetOverlap(
  point: QutritPulsePoint,
  form: PulseLabForm,
): number | null {
  if (
    form.amplitudeMode !== 'target_rotation_angle' ||
    form.detuningRadPerUs !== 0
  ) {
    return null
  }
  const duration = pulseDurationUs(form)
  const fraction = Math.min(1, point.time_us / duration)
  const angle = form.targetRotationAngleRad * fraction
  const target = [
    { real: Math.cos(angle / 2), imag: 0 },
    {
      real: Math.sin(angle / 2) * Math.sin(form.phaseRad),
      imag: -Math.sin(angle / 2) * Math.cos(form.phaseRad),
    },
    { real: 0, imag: 0 },
  ]
  let overlap = 0
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const left = complexConjugate(target[row])
      const matrix = point.density_matrix[row][column]
      const right = target[column]
      overlap += complexMultiply(complexMultiply(left, matrix), right).real
    }
  }
  return Math.min(1, Math.max(0, overlap))
}

export function hasPulseResponseShape(value: unknown): value is PulseResponse {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.contract_version === 'string' &&
    Array.isArray(candidate.trajectory) &&
    typeof candidate.model === 'object' &&
    candidate.model !== null
  )
}

function peakAmplitude(form: PulseLabForm): number {
  if (form.amplitudeMode === 'peak_amplitude') {
    return Number.isFinite(form.peakAmplitudeRadPerUs)
      ? form.peakAmplitudeRadPerUs
      : 0
  }
  if (form.shape === 'square') {
    return form.pulseDurationUs > 0 &&
      Number.isFinite(form.targetRotationAngleRad)
      ? form.targetRotationAngleRad / form.pulseDurationUs
      : 0
  }
  const areaFactor =
    form.sigmaUs *
    Math.sqrt(2 * Math.PI) *
    erf(form.truncationSigma / Math.SQRT2)
  return areaFactor > 0 && Number.isFinite(form.targetRotationAngleRad)
    ? form.targetRotationAngleRad / areaFactor
    : 0
}

function costResult(estimated: number, maximum: number): PulseCostEstimate {
  const ratio = estimated / maximum
  const overBudget = estimated > maximum
  return {
    estimatedInternalSteps: estimated,
    maximumInternalSteps: maximum,
    overBudget,
    level: overBudget ? 'blocked' : ratio >= 0.7 ? 'elevated' : 'normal',
    message: overBudget
      ? `Estimated work exceeds the ${maximum.toLocaleString()}-step API gate.`
      : ratio >= 0.7
        ? 'This request is close to the API work ceiling and may take several seconds.'
        : 'Estimated work is within the bounded API execution range.',
  }
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  const t = 1 / (1 + 0.3275911 * x)
  const polynomial =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x))
  return sign * polynomial
}

function complexConjugate(value: { real: number; imag: number }) {
  return { real: value.real, imag: -value.imag }
}

function complexMultiply(
  left: { real: number; imag: number },
  right: { real: number; imag: number },
) {
  return {
    real: left.real * right.real - left.imag * right.imag,
    imag: left.real * right.imag + left.imag * right.real,
  }
}
