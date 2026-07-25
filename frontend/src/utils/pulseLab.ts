import {
  QUTRIT_PULSE_MODEL,
  TWO_LEVEL_PULSE_MODEL,
  type PulseCostEstimate,
  type PulseLabErrors,
  type PulseLabForm,
  type PulseResponse,
  type PulseWaveformPoint,
  type QutritPulsePoint,
} from '../types/pulse'

const QUTRIT_API_MAX_STEPS = 4000
const TWO_LEVEL_API_MAX_STEPS = 200000
const EPSILON_H = 0.02
const EPSILON_D = 0.02
const QUTRIT_SAMPLES_PER_SIGMA = 32

export const initialPulseLabForm: PulseLabForm = {
  modelId: QUTRIT_PULSE_MODEL,
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

  if (form.modelId === QUTRIT_PULSE_MODEL) {
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

export function buildPulsePayload(form: PulseLabForm): Record<string, unknown> {
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
            form.modelId === QUTRIT_PULSE_MODEL ? form.dragBetaUs : 0,
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
    ...(form.modelId === QUTRIT_PULSE_MODEL
      ? { anharmonicity_mhz: form.anharmonicityMhz }
      : {}),
    pulse,
    total_simulation_time_us: form.totalSimulationTimeUs,
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
      form.modelId === QUTRIT_PULSE_MODEL && form.shape === 'gaussian'
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

  const duration = pulseDurationUs(form)
  const peak = Math.abs(peakAmplitude(form))
  const dragMagnitude =
    form.shape === 'gaussian'
      ? Math.abs(form.dragBetaUs) * peak / Math.max(form.sigmaUs, 1e-12)
      : 0
  const drive = Math.hypot(peak, dragMagnitude)
  const diagonal = [
    0,
    -form.detuningRadPerUs,
    -2 * form.detuningRadPerUs + form.anharmonicityMhz * 2 * Math.PI,
  ]
  const diagonalSpan = Math.max(...diagonal) - Math.min(...diagonal)
  const hamiltonianScale = diagonalSpan + 2 * Math.SQRT2 * drive
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
  const step = Math.min(...limits.filter((value) => Number.isFinite(value) && value > 0))
  const estimated =
    Math.ceil(duration / step) +
    Math.ceil(Math.max(0, form.totalSimulationTimeUs - duration) / step) +
    form.snapshotCount
  return costResult(estimated, QUTRIT_API_MAX_STEPS)
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
