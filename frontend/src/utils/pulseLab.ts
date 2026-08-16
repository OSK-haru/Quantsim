import {
  COUPLED_TRANSMON_NETWORK_PULSE_MODEL,
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
import type { PulseCircuitState } from '../types/pulseCircuit'
import {
  applyPulseStepToForm,
  isDrivePulseStep,
  normalizeFramePhase,
  pulseStepDurationUs,
} from './pulseCircuit'

const QUTRIT_API_MAX_STEPS = 25000
const PAIR_API_MAX_STEPS = 15000
const TWO_LEVEL_API_MAX_STEPS = 200000
const EPSILON_H = 0.02
const EPSILON_D = 0.02
const QUTRIT_SAMPLES_PER_SIGMA = 32
const MHZ_TO_RAD_PER_US = 2 * Math.PI
/*
 * api/pulse_transmon_network_service.py と同じ予算。1ステップの費用は
 * 固定オーバーヘッドと dim^3 の密行列演算の和として数える。
 */
const NETWORK_STEP_OVERHEAD_UNITS = 12000
const NETWORK_MAX_DENSE_WORK_UNITS = 1200000000
const NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS = 250000

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
      errors[key] = `${label}は0より大きい値である必要があります。`
    }
  }
  const nonnegative = (key: keyof PulseLabForm, value: number, label: string) => {
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = `${label}は0以上である必要があります。`
    }
  }

  positive('totalSimulationTimeUs', form.totalSimulationTimeUs, '総シミュレーション時間')
  if (form.shape === 'square') {
    positive('pulseDurationUs', form.pulseDurationUs, 'Pulse幅')
  } else {
    positive('sigmaUs', form.sigmaUs, 'Gaussian σ')
    positive('truncationSigma', form.truncationSigma, '打ち切りσ')
  }
  if (form.amplitudeMode === 'target_rotation_angle') {
    if (!Number.isFinite(form.targetRotationAngleRad)) {
      errors.targetRotationAngleRad = '目標角度は有限の値である必要があります。'
    }
  } else {
    if (!Number.isFinite(form.peakAmplitudeRadPerUs)) {
      errors.peakAmplitudeRadPerUs = 'ピーク振幅は有限の値である必要があります。'
    }
  }
  if (!Number.isFinite(form.phaseRad)) {
    errors.phaseRad = '位相は有限の値である必要があります。'
  }
  if (!Number.isFinite(form.detuningRadPerUs)) {
    errors.detuningRadPerUs = 'デチューニングは有限の値である必要があります。'
  }
  nonnegative(
    'quasiStaticDetuningSigmaRadPerUs',
    form.quasiStaticDetuningSigmaRadPerUs,
    '準静的デチューニングσ',
  )
  if (form.quasiStaticNoiseEnabled && form.quasiStaticDetuningSigmaRadPerUs <= 0) {
    errors.quasiStaticDetuningSigmaRadPerUs =
      '準静的ノイズを有効にする場合、σは0より大きい値である必要があります。'
  }
  if (![3, 5, 7, 9].includes(form.quasiStaticQuadratureOrder)) {
    errors.quasiStaticQuadratureOrder = '直交次数は3、5、7、9のいずれかである必要があります。'
  }
  if (pulseDurationUs(form) > form.totalSimulationTimeUs) {
    errors.totalSimulationTimeUs =
      '総シミュレーション時間はPulse幅全体を含む必要があります。'
  }
  if (
    !Number.isInteger(form.snapshotCount) ||
    form.snapshotCount < 2 ||
    form.snapshotCount > 1001
  ) {
    errors.snapshotCount = 'スナップショット数は2から1001までの整数である必要があります。'
  }

  if (form.modelId !== TWO_LEVEL_PULSE_MODEL) {
    if (!Number.isFinite(form.anharmonicityMhz) || form.anharmonicityMhz >= 0) {
      errors.anharmonicityMhz = '非調和性は有限の負の値である必要があります。'
    }
    if (form.shape === 'gaussian') {
      if (!Number.isFinite(form.dragBetaUs)) {
        errors.dragBetaUs = 'DRAG βは有限の値である必要があります。'
      }
    }
    if (
      form.environmentMode === 'physical' &&
      form.qubitFrequencyGhz + form.anharmonicityMhz / 1000 <= 0
    ) {
      errors.anharmonicityMhz =
        '結果として得られる|1>-|2>遷移周波数は正の値を保つ必要があります。'
    }
  }
  if (form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL) {
    if (!Number.isFinite(form.pairSecondAnharmonicityMhz) || form.pairSecondAnharmonicityMhz >= 0) {
      errors.pairSecondAnharmonicityMhz = '2つ目の非調和性は有限かつ負の値である必要があります。'
    }
    if (!Number.isFinite(form.pairDetuningQ0RadPerUs)) {
      errors.pairDetuningQ0RadPerUs = 'q0のデチューニングは有限の値である必要があります。'
    }
    if (!Number.isFinite(form.pairDetuningQ1RadPerUs)) {
      errors.pairDetuningQ1RadPerUs = 'q1のデチューニングは有限の値である必要があります。'
    }
    nonnegative(
      'pairExchangeCouplingRadPerUs',
      form.pairExchangeCouplingRadPerUs,
      '交換結合',
    )
    nonnegative('pairQuasiStaticSigmaQ0RadPerUs', form.pairQuasiStaticSigmaQ0RadPerUs, 'q0 準静的σ')
    nonnegative('pairQuasiStaticSigmaQ1RadPerUs', form.pairQuasiStaticSigmaQ1RadPerUs, 'q1 準静的σ')
    if (!Number.isFinite(form.pairQuasiStaticCorrelation) || Math.abs(form.pairQuasiStaticCorrelation) > 1) {
      errors.pairQuasiStaticCorrelation = 'ノイズ相関は-1から1の間である必要があります。'
    }
    if (form.pairSecondaryDriveEnabled) {
      if (
        form.pairSecondaryAmplitudeMode === 'target_rotation_angle'
        && !Number.isFinite(form.pairSecondaryTargetRotationAngleRad)
      ) {
        errors.pairSecondaryTargetRotationAngleRad = '副目標角度は有限の値である必要があります。'
      }
      if (
        form.pairSecondaryAmplitudeMode === 'peak_amplitude'
        && !Number.isFinite(form.pairSecondaryPeakAmplitudeRadPerUs)
      ) {
        errors.pairSecondaryPeakAmplitudeRadPerUs = '副ピーク振幅は有限の値である必要があります。'
      }
      if (form.pairSecondaryShape === 'square') {
        positive('pairSecondaryPulseDurationUs', form.pairSecondaryPulseDurationUs, '副Pulse幅')
      } else {
        positive('pairSecondarySigmaUs', form.pairSecondarySigmaUs, '副Gaussian σ')
        positive('pairSecondaryTruncationSigma', form.pairSecondaryTruncationSigma, '副打ち切りσ')
      }
      if (!Number.isFinite(form.pairSecondaryPhaseRad)) {
        errors.pairSecondaryPhaseRad = '副位相は有限の値である必要があります。'
      }
      if (!Number.isFinite(form.pairSecondaryDetuningRadPerUs)) {
        errors.pairSecondaryDetuningRadPerUs = '副デチューニングは有限の値である必要があります。'
      }
      if (!Number.isFinite(form.pairSecondaryDragBetaUs)) {
        errors.pairSecondaryDragBetaUs = '副DRAG βは有限の値である必要があります。'
      }
      const secondaryDuration = form.pairSecondaryShape === 'square'
        ? form.pairSecondaryPulseDurationUs
        : 2 * form.pairSecondarySigmaUs * form.pairSecondaryTruncationSigma
      if (secondaryDuration > form.totalSimulationTimeUs) {
        errors.totalSimulationTimeUs = '総時間は同時発生する両方のPulseを含む必要があります。'
      }
    }
  }
  if (form.modelId === COUPLED_TRANSMON_NETWORK_PULSE_MODEL) {
    if (!Number.isFinite(form.pairDetuningQ0RadPerUs)) {
      errors.pairDetuningQ0RadPerUs = 'q0の基準離調は有限値にしてください。'
    }
    if (!Number.isFinite(form.pairDetuningQ1RadPerUs)) {
      errors.pairDetuningQ1RadPerUs = 'q1の基準離調は有限値にしてください。'
    }
    nonnegative(
      'pairExchangeCouplingRadPerUs',
      form.pairExchangeCouplingRadPerUs,
      '隣接交換結合',
    )
  }

  if (form.environmentMode === 'physical') {
    if (
      !Number.isFinite(form.deviceQuality) ||
      form.deviceQuality < 0 ||
      form.deviceQuality > 1
    ) {
      errors.deviceQuality = 'デバイス品質は0から1の間である必要があります。'
    }
    nonnegative('temperatureMk', form.temperatureMk, '温度')
    nonnegative('fluxNoisePhi0', form.fluxNoisePhi0, '磁束ノイズ')
    positive('qubitFrequencyGhz', form.qubitFrequencyGhz, '量子ビット周波数')
    positive('t1MaxUs', form.t1MaxUs, '最大T1')
    positive('tphiMaxUs', form.tphiMaxUs, '最大Tφ')
  } else if (form.modelId === TWO_LEVEL_PULSE_MODEL) {
    nonnegative('gammaDownPerUs', form.gammaDownPerUs, 'γ↓ (下降)')
    nonnegative('gammaUpPerUs', form.gammaUpPerUs, 'γ↑ (上昇)')
    nonnegative('gammaPhiPerUs', form.gammaPhiPerUs, 'γφ (位相緩和)')
  } else {
    nonnegative('gamma10DownPerUs', form.gamma10DownPerUs, 'γ10↓ (下降)')
    nonnegative('gamma01UpPerUs', form.gamma01UpPerUs, 'γ01↑ (上昇)')
    nonnegative('gamma21DownPerUs', form.gamma21DownPerUs, 'γ21↓ (下降)')
    nonnegative('gamma12UpPerUs', form.gamma12UpPerUs, 'γ12↑ (上昇)')
    nonnegative(
      'gammaPhiAdjacentPerUs',
      form.gammaPhiAdjacentPerUs,
      '隣接デフェージングレート',
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

export function buildTransmonNetworkPayload(
  form: PulseLabForm,
  circuit: PulseCircuitState,
): Record<string, unknown> {
  const transmonCount = circuit.transmons.length
  const drives: Array<Record<string, unknown>> = []
  const boundaryTimes = new Set<number>()

  circuit.lanes.forEach((lane) => {
    let startTimeUs = 0
    let framePhaseRad = 0
    lane.steps.forEach((step, stepIndex) => {
      if (!isDrivePulseStep(step)) {
        framePhaseRad = normalizeFramePhase(framePhaseRad + step.angleRad)
        return
      }
      const pulseForm = applyPulseStepToForm(form, step.pulse)
      const durationUs = pulseStepDurationUs(step.pulse)
      drives.push({
        target: lane.transmonIndex,
        start_time_us: startTimeUs,
        pulse: {
          ...qutritPulsePayload(pulseForm),
          phase_rad: normalizeFramePhase(pulseForm.phaseRad + framePhaseRad),
        },
      })
      boundaryTimes.add(startTimeUs)
      boundaryTimes.add(startTimeUs + durationUs)
      const hasLaterDrive = lane.steps
        .slice(stepIndex + 1)
        .some(isDrivePulseStep)
      startTimeUs += durationUs + (hasLaterDrive
        ? circuit.executionConstraints.interPulseGapUs
        : 0)
    })
  })

  const dimension = 3 ** transmonCount
  const boundaryReserve = Math.max(0, boundaryTimes.size - 2)
  const snapshotLimit = Math.max(
    2,
    Math.floor(NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS / (dimension * dimension))
      - boundaryReserve,
  )
  const environment = form.environmentMode === 'physical'
    ? {
        input_mode: 'physical',
        device_quality: form.deviceQuality,
        temperature_mk: form.temperatureMk,
        flux_noise_phi0: form.fluxNoisePhi0,
        qubit_frequency_ghz: form.qubitFrequencyGhz,
        t1_max_us: form.t1MaxUs,
        tphi_max_us: form.tphiMaxUs,
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
    model_id: COUPLED_TRANSMON_NETWORK_PULSE_MODEL,
    transmon_count: transmonCount,
    initial_state: '0'.repeat(transmonCount),
    frequencies_ghz: circuit.transmons.map((transmon) => transmon.frequencyGhz),
    anharmonicities_mhz: circuit.transmons.map((transmon) => transmon.anharmonicityMhz),
    detunings_rad_per_us: Array.from(
      { length: transmonCount },
      (_, index) => index === 0
        ? form.pairDetuningQ0RadPerUs
        : index === 1
          ? form.pairDetuningQ1RadPerUs
          : 0,
    ),
    couplings: Array.from({ length: Math.max(0, transmonCount - 1) }, (_, left) => ({
      left,
      right: left + 1,
      exchange_coupling_rad_per_us: form.pairExchangeCouplingRadPerUs,
    })),
    drives,
    total_simulation_time_us: form.totalSimulationTimeUs,
    evolution_method: 'fixed_step_rk4',
    backend: form.backend,
    environment,
    snapshot_options: {
      uniform_count: Math.min(form.snapshotCount, snapshotLimit),
      custom_times_us: [...boundaryTimes].filter(
        (timeUs) => timeUs <= form.totalSimulationTimeUs,
      ),
    },
  }
}

export function estimateTransmonNetworkCost(
  form: PulseLabForm,
  circuit: PulseCircuitState,
): PulseCostEstimate {
  const driveForms = circuit.lanes.flatMap((lane) => lane.steps
    .filter(isDrivePulseStep)
    .map((step) => ({
      transmonIndex: lane.transmonIndex,
      form: applyPulseStepToForm(form, step.pulse),
    })))
  const dimension = 3 ** circuit.transmons.length
  const effectiveSnapshotCount = Math.min(
    form.snapshotCount,
    Math.max(
      2,
      Math.floor(NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS / (dimension * dimension))
        - 2 * driveForms.length,
    ),
  )
  /*
   * 刻み幅はAPIの step policy と同じ量で決める。ハミルトニアンの
   * 固有値スパンを上界で置き換えるとAPIが受け付ける要求までUIが
   * 止めてしまうため、ここでは3準位の固有値スパンを直接使う。
   */
  const anharmonicityRadPerUs = MHZ_TO_RAD_PER_US * Math.min(
    ...circuit.transmons.map((transmon) => transmon.anharmonicityMhz),
  )
  const couplingStepLimitUs = form.pairExchangeCouplingRadPerUs > 0
    ? EPSILON_H / (4 * Math.abs(form.pairExchangeCouplingRadPerUs))
    : Number.POSITIVE_INFINITY
  const stepCapUs = Math.min(
    couplingStepLimitUs,
    ...driveForms.map(({ transmonIndex, form: driveForm }) => qutritStepCapUs(
      driveForm,
      anharmonicityRadPerUs,
      Math.abs(networkBaseDetuningRadPerUs(form, transmonIndex))
        + Math.abs(driveForm.detuningRadPerUs),
    )),
  )
  const estimatedInternalSteps = driveForms.length === 0 || !(stepCapUs > 0)
    ? effectiveSnapshotCount
    : Math.ceil(form.totalSimulationTimeUs / stepCapUs) + effectiveSnapshotCount
  const maximumInternalSteps = Math.floor(
    NETWORK_MAX_DENSE_WORK_UNITS / (dimension ** 3 + NETWORK_STEP_OVERHEAD_UNITS),
  )
  return costResult(estimatedInternalSteps, maximumInternalSteps)
}

export function networkBaseDetuningRadPerUs(
  form: PulseLabForm,
  transmonIndex: number,
): number {
  if (transmonIndex === 0) {
    return form.pairDetuningQ0RadPerUs
  }
  return transmonIndex === 1 ? form.pairDetuningQ1RadPerUs : 0
}

/*
 * `recommended_qutrit_step_policy` のTypeScript版。刻み幅を決める4つの
 * 上限（パルス長・固有値スパン・散逸・Gaussianの分解能）を同じ式で評価する。
 */
function qutritStepCapUs(
  form: PulseLabForm,
  anharmonicityRadPerUs: number,
  detuningRadPerUs: number,
): number {
  const duration = pulseDurationUs(form)
  const driveMagnitude = maximumDriveMagnitudeRadPerUs(form)
  const spectralDiameter = Math.max(
    qutritSpectralDiameterRadPerUs(detuningRadPerUs, anharmonicityRadPerUs, 0),
    qutritSpectralDiameterRadPerUs(
      detuningRadPerUs,
      anharmonicityRadPerUs,
      driveMagnitude,
    ),
  )
  const dissipationScale = form.environmentMode === 'direct_rates'
    ? form.gamma10DownPerUs
      + form.gamma01UpPerUs
      + form.gamma21DownPerUs
      + form.gamma12UpPerUs
      + 4 * form.gammaPhiAdjacentPerUs
    : 0
  const limits = [
    duration,
    ...(spectralDiameter > 0 ? [EPSILON_H / spectralDiameter] : []),
    ...(dissipationScale > 0 ? [EPSILON_D / dissipationScale] : []),
    ...(form.shape === 'gaussian' ? [form.sigmaUs / QUTRIT_SAMPLES_PER_SIGMA] : []),
  ]
  return Math.min(...limits.filter((value) => Number.isFinite(value) && value > 0))
}

function maximumDriveMagnitudeRadPerUs(form: PulseLabForm): number {
  const peak = Math.abs(peakAmplitude(form))
  if (form.shape !== 'gaussian' || form.dragBetaUs === 0) {
    return peak
  }
  /*
   * DRAGでは sqrt(Omega^2 + (beta dOmega/dt)^2) の最大値を取る。
   * 端点と、存在する場合の停留点を比べる。
   */
  const ratio = Math.abs(form.dragBetaUs) / form.sigmaUs
  const candidates = [0, form.truncationSigma]
  if (ratio > 1) {
    const stationary = Math.sqrt(1 - 1 / (ratio * ratio))
    if (stationary <= form.truncationSigma) {
      candidates.push(stationary)
    }
  }
  return Math.max(...candidates.map((normalized) => peak
    * Math.exp(-0.5 * normalized * normalized)
    * Math.sqrt(1 + (ratio * normalized) ** 2)))
}

/*
 * 3準位回転系ハミルトニアンの固有値スパン。実対称三重対角なので
 * 対称3x3の解析解をそのまま使える。
 */
function qutritSpectralDiameterRadPerUs(
  detuningRadPerUs: number,
  anharmonicityRadPerUs: number,
  amplitudeRadPerUs: number,
): number {
  const coupling01 = 0.5 * amplitudeRadPerUs
  const coupling12 = Math.SQRT2 * coupling01
  const diagonal = [
    0,
    -detuningRadPerUs,
    -2 * detuningRadPerUs + anharmonicityRadPerUs,
  ]
  const offDiagonalSquares = coupling01 ** 2 + coupling12 ** 2
  const mean = (diagonal[0] + diagonal[1] + diagonal[2]) / 3
  const shifted = diagonal.map((value) => value - mean)
  const scale = Math.sqrt(
    (shifted[0] ** 2 + shifted[1] ** 2 + shifted[2] ** 2 + 2 * offDiagonalSquares) / 6,
  )
  if (scale === 0) {
    return 0
  }
  const determinant = (
    shifted[0] * (shifted[1] * shifted[2] - coupling12 ** 2)
    - coupling01 * (coupling01 * shifted[2])
  ) / scale ** 3
  const angle = Math.acos(Math.max(-1, Math.min(1, determinant / 2))) / 3
  return 2 * scale * (Math.cos(angle) - Math.cos(angle + (2 * Math.PI) / 3))
}

function qutritPulsePayload(form: PulseLabForm): Record<string, unknown> {
  return form.shape === 'square'
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
        drag_beta_us: form.dragBetaUs,
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
      ? `推定計算量が ${maximum.toLocaleString()} ステップのAPI上限を超えています。`
      : ratio >= 0.7
        ? 'このリクエストはAPIの計算量上限に近く、数秒かかる場合があります。'
        : '推定計算量はAPIの実行上限内です。',
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
