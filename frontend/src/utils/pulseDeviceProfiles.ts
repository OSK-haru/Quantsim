import type { PulseExecutionConstraints } from '../types/pulseCircuit'

export type PulseDeviceProfile = {
  id: string
  name: string
  description: string
  constraints: PulseExecutionConstraints
}

export const pulseDeviceProfiles: PulseDeviceProfile[] = [
  {
    id: 'educational-default',
    name: '教育用デフォルト',
    description: '既定のPulseを試しやすい、比較用の仮想デバイスです。',
    constraints: {
      maximumDriveAmplitudeRadPerUs: 1000,
      minimumPulseDurationUs: 0.004,
      awgSamplePeriodUs: 0.0005,
      phaseResolutionRad: Math.PI / 180,
      amplitudeResolutionRadPerUs: 0.1,
      maximumDetuningRadPerUs: 500,
      interPulseGapUs: 0.001,
    },
  },
  {
    id: 'transmon-standard-awg',
    name: '標準トランズモンAWG',
    description: '帯域と時間分解能を控えめにした、一般的な制約の学習用モデルです。',
    constraints: {
      maximumDriveAmplitudeRadPerUs: 250,
      minimumPulseDurationUs: 0.008,
      awgSamplePeriodUs: 0.001,
      phaseResolutionRad: Math.PI / 180,
      amplitudeResolutionRadPerUs: 0.25,
      maximumDetuningRadPerUs: 100,
      interPulseGapUs: 0.004,
    },
  },
  {
    id: 'high-bandwidth-awg',
    name: '高帯域AWG',
    description: '短いPulseと細かな量子化を許す、将来拡張向けの仮想プロファイルです。',
    constraints: {
      maximumDriveAmplitudeRadPerUs: 1500,
      minimumPulseDurationUs: 0.002,
      awgSamplePeriodUs: 0.00025,
      phaseResolutionRad: Math.PI / 360,
      amplitudeResolutionRadPerUs: 0.05,
      maximumDetuningRadPerUs: 1000,
      interPulseGapUs: 0.0005,
    },
  },
]

export function matchingPulseDeviceProfile(
  constraints: PulseExecutionConstraints,
): PulseDeviceProfile | null {
  return pulseDeviceProfiles.find((profile) => constraintsEqual(profile.constraints, constraints)) ?? null
}

export function pulseDeviceProfileConstraints(profileId: string): PulseExecutionConstraints | null {
  const profile = pulseDeviceProfiles.find((candidate) => candidate.id === profileId)
  return profile ? { ...profile.constraints } : null
}

function constraintsEqual(
  left: PulseExecutionConstraints,
  right: PulseExecutionConstraints,
): boolean {
  return (Object.keys(left) as Array<keyof PulseExecutionConstraints>).every(
    (key) => Math.abs(left[key] - right[key]) <= 1e-12,
  )
}
