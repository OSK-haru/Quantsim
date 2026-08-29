import type { PulseLabForm } from '../types/pulse'
import type {
  PulseCircuitStep,
  PulseCircuitState,
  DrivePulseCircuitStep,
  DrivePulsePrimitive,
  PulsePrimitive,
  PulseStepParameters,
} from '../types/pulseCircuit'
import { pulseDeviceProfiles } from './pulseDeviceProfiles'

const primitiveSettings: Record<Exclude<DrivePulsePrimitive, 'custom'>, {
  label: string
  angle: number
  phase: number
}> = {
  x90: { label: 'X/2', angle: Math.PI / 2, phase: 0 },
  x180: { label: 'X', angle: Math.PI, phase: 0 },
  y90: { label: 'Y/2', angle: Math.PI / 2, phase: Math.PI / 2 },
  y180: { label: 'Y', angle: Math.PI, phase: Math.PI / 2 },
}

export function createPulseCircuitStep(
  primitive: PulsePrimitive,
  baseForm: PulseLabForm,
  id: string,
): PulseCircuitStep {
  if (primitive === 'virtual_z') {
    return {
      id,
      operation: 'virtual_z',
      primitive,
      label: 'VZ',
      angleRad: Math.PI / 2,
    }
  }
  if (primitive === 'custom') {
    return {
      id,
      operation: 'drive',
      primitive,
      label: 'Custom',
      pulse: pulseStepParametersFromForm(baseForm),
    }
  }

  const setting = primitiveSettings[primitive]
  return {
    id,
    operation: 'drive',
    primitive,
    label: setting.label,
    pulse: {
      ...pulseStepParametersFromForm(baseForm),
      amplitudeMode: 'target_rotation_angle',
      targetRotationAngleRad: setting.angle,
      phaseRad: setting.phase,
    },
  }
}

export function isDrivePulseStep(
  step: PulseCircuitStep,
): step is DrivePulseCircuitStep {
  return step.operation === 'drive'
}

export function normalizeFramePhase(angleRad: number): number {
  const fullTurn = 2 * Math.PI
  return ((angleRad + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

export function pulseStepParametersFromForm(form: PulseLabForm): PulseStepParameters {
  return {
    shape: form.shape,
    amplitudeMode: form.amplitudeMode,
    targetRotationAngleRad: form.targetRotationAngleRad,
    peakAmplitudeRadPerUs: form.peakAmplitudeRadPerUs,
    pulseDurationUs: form.pulseDurationUs,
    sigmaUs: form.sigmaUs,
    truncationSigma: form.truncationSigma,
    phaseRad: form.phaseRad,
    detuningRadPerUs: form.detuningRadPerUs,
    dragBetaUs: form.dragBetaUs,
  }
}

export function applyPulseStepToForm(
  form: PulseLabForm,
  pulse: PulseStepParameters,
): PulseLabForm {
  return { ...form, ...pulse }
}

export function pulseStepDurationUs(pulse: PulseStepParameters): number {
  return pulse.shape === 'square'
    ? pulse.pulseDurationUs
    : 2 * pulse.sigmaUs * pulse.truncationSigma
}

export function createDefaultPulseCircuit(baseForm: PulseLabForm): PulseCircuitState {
  return {
    transmons: [{
      id: 'transmon-0',
      index: 0,
      label: 'q0',
      frequencyGhz: baseForm.qubitFrequencyGhz,
      anharmonicityMhz: baseForm.anharmonicityMhz,
    }],
    lanes: [{
      transmonIndex: 0,
      steps: [
        createPulseCircuitStep('x90', baseForm, 'pulse-default-1'),
        createPulseCircuitStep('y90', baseForm, 'pulse-default-2'),
      ],
    }],
    executionConstraints: { ...pulseDeviceProfiles[0].constraints },
  }
}

export function resizePulseCircuit(
  circuit: PulseCircuitState,
  transmonCount: number,
): PulseCircuitState {
  const count = Math.min(8, Math.max(1, Math.trunc(transmonCount)))
  return {
    executionConstraints: circuit.executionConstraints,
    transmons: Array.from({ length: count }, (_, index) => (
      circuit.transmons[index] ?? {
        id: `transmon-${index}`,
        index,
        label: `q${index}`,
        frequencyGhz: circuit.transmons[0]?.frequencyGhz ?? 5,
        anharmonicityMhz: circuit.transmons[0]?.anharmonicityMhz ?? -100,
      }
    )),
    lanes: Array.from({ length: count }, (_, transmonIndex) => (
      circuit.lanes.find((lane) => lane.transmonIndex === transmonIndex) ?? {
        transmonIndex,
        steps: [],
      }
    )),
  }
}

/*
 * X/2 などの名前は「その回転をする」という約束であって、単なるラベルではない。
 * 編集で回転角や位相がその約束から外れたブロックにX/2と書き続けると、
 * 回路図の見た目と実際に流れる波形が食い違う。そこで同値性が壊れた時点で
 * Customへ降格させ、名前が嘘をつかないようにする。
 * 波形・σ・DRAG β・離調は理想回転そのものを変えないので、同値性の判定には使わない。
 */
const PRIMITIVE_ANGLE_TOLERANCE_RAD = 1e-9

function anglesMatch(a: number, b: number): boolean {
  return Number.isFinite(a)
    && Number.isFinite(b)
    && Math.abs(normalizeFramePhase(a - b)) <= PRIMITIVE_ANGLE_TOLERANCE_RAD
}

export function matchDrivePulsePrimitive(
  pulse: PulseStepParameters,
): Exclude<DrivePulsePrimitive, 'custom'> | null {
  if (pulse.amplitudeMode !== 'target_rotation_angle') {
    return null
  }
  const entries = Object.entries(primitiveSettings) as Array<
    [Exclude<DrivePulsePrimitive, 'custom'>, (typeof primitiveSettings)[keyof typeof primitiveSettings]]
  >
  for (const [primitive, setting] of entries) {
    if (
      anglesMatch(pulse.targetRotationAngleRad, setting.angle)
      && anglesMatch(pulse.phaseRad, setting.phase)
    ) {
      return primitive
    }
  }
  return null
}

/*
 * 編集後のパルスに合わせて primitive とラベルを付け直す。
 * X/2 を崩せば Custom に落ち、Custom を X/2 の値へ戻せば X/2 に復帰する。
 */
export function reconcileDrivePulseStep(
  step: DrivePulseCircuitStep,
  pulse: PulseStepParameters,
): DrivePulseCircuitStep {
  const matched = matchDrivePulsePrimitive(pulse)
  if (matched) {
    return { ...step, primitive: matched, label: primitiveSettings[matched].label, pulse }
  }
  return { ...step, primitive: 'custom', label: 'Custom', pulse }
}
