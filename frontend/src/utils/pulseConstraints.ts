import type { PulseLabForm } from '../types/pulse'
import type {
  PulseCircuitStep,
  PulseExecutionConstraints,
} from '../types/pulseCircuit'
import { applyPulseStepToForm, isDrivePulseStep } from './pulseCircuit'
import { pulseDurationUs, pulseWaveform } from './pulseLab'

/*
 * ハードウェア制約の判定は「実行直前」と「回路編集中」の両方から必要になる。
 * 二重定義すると片方だけ緩い判定が残るので、素の判定関数はここに集約する。
 */

export function isAlignedToResolution(value: number, resolution: number): boolean {
  const ratio = value / resolution
  return Number.isFinite(ratio) && Math.abs(ratio - Math.round(ratio)) <= 1e-6
}

export function constraintsAreWellFormed(constraints: PulseExecutionConstraints): boolean {
  const positiveValues = [
    constraints.maximumDriveAmplitudeRadPerUs,
    constraints.minimumPulseDurationUs,
    constraints.awgSamplePeriodUs,
    constraints.phaseResolutionRad,
    constraints.amplitudeResolutionRadPerUs,
    constraints.maximumDetuningRadPerUs,
  ]
  return positiveValues.every((value) => Number.isFinite(value) && value > 0)
    && Number.isFinite(constraints.interPulseGapUs)
    && constraints.interPulseGapUs >= 0
}

export function drivePulseConstraintIssues(
  form: PulseLabForm,
  constraints: PulseExecutionConstraints,
): string[] {
  if (!constraintsAreWellFormed(constraints)) {
    return []
  }
  const issues: string[] = []
  const durationUs = pulseDurationUs(form)

  if (durationUs < constraints.minimumPulseDurationUs) {
    issues.push(`Pulse幅は ${constraints.minimumPulseDurationUs} us 以上である必要があります。`)
  }
  if (!isAlignedToResolution(durationUs, constraints.awgSamplePeriodUs)) {
    issues.push(`Pulse幅は AWG周期 ${constraints.awgSamplePeriodUs} us の倍数である必要があります。`)
  }
  if (Math.abs(form.detuningRadPerUs) > constraints.maximumDetuningRadPerUs) {
    issues.push(`デチューニングが上限 ±${constraints.maximumDetuningRadPerUs} rad/us を超えています。`)
  }
  if (!isAlignedToResolution(form.phaseRad, constraints.phaseResolutionRad)) {
    issues.push(`位相は ${constraints.phaseResolutionRad.toPrecision(4)} rad の倍数である必要があります。`)
  }

  const maximumWaveformAmplitude = Math.max(
    0,
    ...pulseWaveform(form, 129).map((point) => Math.hypot(point.omegaX, point.omegaY)),
  )
  if (maximumWaveformAmplitude > constraints.maximumDriveAmplitudeRadPerUs * (1 + 1e-9)) {
    issues.push(
      `波形のピーク ${maximumWaveformAmplitude.toPrecision(4)} rad/us が上限 ${constraints.maximumDriveAmplitudeRadPerUs} rad/us を超えています。`,
    )
  }
  if (
    form.amplitudeMode === 'peak_amplitude'
    && !isAlignedToResolution(form.peakAmplitudeRadPerUs, constraints.amplitudeResolutionRadPerUs)
  ) {
    issues.push(`ピーク振幅は ${constraints.amplitudeResolutionRadPerUs} rad/us の倍数である必要があります。`)
  }
  return issues
}

export function virtualZConstraintIssues(
  angleRad: number,
  constraints: PulseExecutionConstraints,
): string[] {
  if (!constraintsAreWellFormed(constraints)) {
    return []
  }
  return isAlignedToResolution(angleRad, constraints.phaseResolutionRad)
    ? []
    : [`Virtual Zの角度は ${constraints.phaseResolutionRad.toPrecision(4)} rad の倍数である必要があります。`]
}

export function pulseStepConstraintIssues(
  step: PulseCircuitStep,
  globalForm: PulseLabForm,
  constraints: PulseExecutionConstraints,
): string[] {
  return isDrivePulseStep(step)
    ? drivePulseConstraintIssues(applyPulseStepToForm(globalForm, step.pulse), constraints)
    : virtualZConstraintIssues(step.angleRad, constraints)
}
