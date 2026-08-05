import type { PulseLabForm } from './pulse'

export type DrivePulsePrimitive = 'x90' | 'x180' | 'y90' | 'y180' | 'custom'
export type PulsePrimitive = DrivePulsePrimitive | 'virtual_z'

export type PulseStepParameters = Pick<
  PulseLabForm,
  | 'shape'
  | 'amplitudeMode'
  | 'targetRotationAngleRad'
  | 'peakAmplitudeRadPerUs'
  | 'pulseDurationUs'
  | 'sigmaUs'
  | 'truncationSigma'
  | 'phaseRad'
  | 'detuningRadPerUs'
  | 'dragBetaUs'
>

export type DrivePulseCircuitStep = {
  id: string
  operation: 'drive'
  primitive: DrivePulsePrimitive
  label: string
  pulse: PulseStepParameters
}

export type VirtualZCircuitStep = {
  id: string
  operation: 'virtual_z'
  primitive: 'virtual_z'
  label: string
  angleRad: number
}

export type PulseCircuitStep = DrivePulseCircuitStep | VirtualZCircuitStep

export type PulseCircuitLane = {
  transmonIndex: number
  steps: PulseCircuitStep[]
}

export type PulseTransmonConfig = {
  id: string
  index: number
  label: string
  frequencyGhz: number
  anharmonicityMhz: number
}

export type PulseExecutionConstraints = {
  maximumDriveAmplitudeRadPerUs: number
  minimumPulseDurationUs: number
  awgSamplePeriodUs: number
  phaseResolutionRad: number
  amplitudeResolutionRadPerUs: number
  maximumDetuningRadPerUs: number
  interPulseGapUs: number
}

export type PulseCircuitState = {
  transmons: PulseTransmonConfig[]
  lanes: PulseCircuitLane[]
  executionConstraints: PulseExecutionConstraints
}
