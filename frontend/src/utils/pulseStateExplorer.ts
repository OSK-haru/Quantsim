/*
 * Pulse の応答は、モデルごとに軌跡の点の形が違う。
 * 2準位は open/closed の占有数を別々に持ち、qutrit は準位ごと、
 * 結合ペアと多トランズモンは基底ラベル付きの同時占有数を持つ。
 * 状態エクスプローラーは同じ読み方（占有数・純度・リーケージ・参照値）で
 * 全モデルを並べたいので、ここで1つの形へ正規化する。
 */

import {
  isCoupledTransmonNetworkResponse,
  isCoupledTransmonPairResponse,
  isQutritPulseResponse,
  type PulseComplexValue,
  type PulseLabForm,
  type PulseResponse,
} from '../types/pulse'
import type { PulseCircuitState } from '../types/pulseCircuit'
import { qutritTargetOverlap } from './pulseLab'

export type PulseExplorerSegment = 'pulse' | 'idle' | 'virtual_z'

export type PulseExplorerPoint = {
  timeUs: number
  segment: PulseExplorerSegment
  stepLabel: string | null
  /* 基底ラベル -> 占有確率。密度行列の対角成分にあたる。 */
  populations: Record<string, number>
  /* 散逸のない閉じた系の占有確率。2準位モデルだけが持つ。 */
  idealPopulations: Record<string, number> | null
  purity: number
  leakage: number | null
  /* 忠実度または目標状態との重なり。モデルによってどちらかになる。 */
  reference: number | null
  densityMatrix: PulseComplexValue[][] | null
}

export type PulseExplorerView = {
  modelLabel: string
  basisLabels: string[]
  computationalLabels: string[]
  dimension: number
  transmonCount: number
  levelCount: number
  points: PulseExplorerPoint[]
  finalDensityMatrix: PulseComplexValue[][] | null
  /* 参照値の呼び名。無い場合は null（結合モデルには対応する参照が無い）。 */
  referenceLabel: string | null
  idealLabel: string | null
  leakageLabel: string | null
  hasPerPointDensityMatrix: boolean
  pulseEndTimeUs: number
  totalTimeUs: number
  sequenceLength: number
}

export function buildPulseExplorerView(
  response: PulseResponse,
  formAtRun: PulseLabForm,
): PulseExplorerView {
  if (isQutritPulseResponse(response)) {
    const isSequence = Number(response.input.sequence_length ?? 1) > 1
    const points: PulseExplorerPoint[] = response.trajectory.map((point) => ({
      timeUs: point.time_us,
      segment: point.segment,
      stepLabel: point.sequence_step_label ?? null,
      populations: {
        '0': point.population_0,
        '1': point.population_1,
        '2': point.population_2,
      },
      idealPopulations: null,
      purity: point.purity,
      leakage: point.leakage_probability,
      reference: isSequence ? null : qutritTargetOverlap(point, formAtRun),
      densityMatrix: point.density_matrix,
    }))
    return {
      modelLabel: '3準位トランズモン qutrit',
      basisLabels: ['0', '1', '2'],
      computationalLabels: ['0', '1'],
      dimension: 3,
      transmonCount: 1,
      levelCount: 3,
      points,
      finalDensityMatrix: response.final.density_matrix,
      referenceLabel: isSequence ? null : '目標状態との重なり',
      idealLabel: null,
      leakageLabel: 'リーケージ P2',
      hasPerPointDensityMatrix: true,
      pulseEndTimeUs: response.pulse_end.time_us,
      totalTimeUs: lastTimeUs(points),
      sequenceLength: Number(response.input.sequence_length ?? 1),
    }
  }

  if (isCoupledTransmonPairResponse(response) || isCoupledTransmonNetworkResponse(response)) {
    const network = isCoupledTransmonNetworkResponse(response)
    const basisLabels = response.model.basis_order
    const transmonCount = network
      ? response.model.logical_qubits
      : 2
    const points: PulseExplorerPoint[] = response.trajectory.map((point) => ({
      timeUs: point.time_us,
      segment: point.segment,
      stepLabel: null,
      populations: { ...point.joint_populations },
      idealPopulations: null,
      purity: point.purity,
      leakage: point.leakage_probability,
      reference: null,
      densityMatrix: point.density_matrix,
    }))
    return {
      modelLabel: network
        ? `${transmonCount}トランズモン・ネットワーク / 3^${transmonCount}準位`
        : '結合トランズモンペア / 3 x 3準位',
      basisLabels,
      computationalLabels: basisLabels.filter((label) => /^[01]+$/.test(label)),
      dimension: basisLabels.length,
      transmonCount,
      levelCount: 3,
      points,
      finalDensityMatrix: response.final.density_matrix,
      referenceLabel: null,
      idealLabel: null,
      leakageLabel: '計算空間外の確率',
      hasPerPointDensityMatrix: true,
      pulseEndTimeUs: response.pulse_end.time_us,
      totalTimeUs: lastTimeUs(points),
      sequenceLength: 1,
    }
  }

  const points: PulseExplorerPoint[] = response.trajectory.map((point) => ({
    timeUs: point.time_us,
    segment: point.segment,
    stepLabel: null,
    populations: {
      '0': point.open_population_0,
      '1': point.open_population_1,
    },
    idealPopulations: {
      '0': point.closed_population_0,
      '1': point.closed_population_1,
    },
    purity: point.purity,
    leakage: null,
    reference: point.fidelity_to_closed,
    /* 2準位の軌跡は占有数だけを返す。密度行列は pulse_end と final にしかない。 */
    densityMatrix: null,
  }))
  return {
    modelLabel: '2準位ベースライン',
    basisLabels: ['0', '1'],
    computationalLabels: ['0', '1'],
    dimension: 2,
    transmonCount: 1,
    levelCount: 2,
    points,
    finalDensityMatrix: response.final.open_density_matrix,
    referenceLabel: '閉じた系への忠実度',
    idealLabel: '閉じた系（散逸なし）',
    leakageLabel: null,
    hasPerPointDensityMatrix: false,
    pulseEndTimeUs: response.pulse_end.time_us,
    totalTimeUs: lastTimeUs(points),
    sequenceLength: 1,
  }
}

function lastTimeUs(points: PulseExplorerPoint[]): number {
  return points.at(-1)?.timeUs ?? 0
}

/* カーソル時刻にいちばん近い軌跡の点。無ければ -1。 */
export function nearestPulsePointIndex(
  points: PulseExplorerPoint[],
  timeUs: number,
): number {
  if (points.length === 0) {
    return -1
  }
  let bestIndex = 0
  let bestDistance = Number.POSITIVE_INFINITY
  points.forEach((point, index) => {
    const distance = Math.abs(point.timeUs - timeUs)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

export type PulseStateChangePoint = {
  timeUs: number
  value: number
}

/*
 * 隣り合う軌跡の点のあいだで、密度行列がどれだけ動いたか。
 * Gate-aware の「区間状態変化」と同じ Hilbert-Schmidt 距離を使い、
 * 密度行列の最大距離 sqrt(2) で割って 0..1 に収める。
 */
export function pulseStateChangeSeries(
  points: PulseExplorerPoint[],
): PulseStateChangePoint[] {
  const series: PulseStateChangePoint[] = []
  let previous: PulseComplexValue[][] | null = null
  for (const point of points) {
    const matrix = point.densityMatrix
    if (matrix === null) {
      return []
    }
    const distance = previous === null ? 0 : hilbertSchmidtDistance(previous, matrix)
    if (distance === null) {
      return []
    }
    series.push({ timeUs: point.timeUs, value: distance })
    previous = matrix
  }
  return series
}

function hilbertSchmidtDistance(
  left: PulseComplexValue[][],
  right: PulseComplexValue[][],
): number | null {
  if (left.length === 0 || left.length !== right.length) {
    return null
  }
  let squaredNorm = 0
  for (let row = 0; row < left.length; row += 1) {
    if (left[row]?.length !== right[row]?.length) {
      return null
    }
    for (let column = 0; column < left[row].length; column += 1) {
      const realDifference = left[row][column].real - right[row][column].real
      const imaginaryDifference = left[row][column].imag - right[row][column].imag
      if (!Number.isFinite(realDifference) || !Number.isFinite(imaginaryDifference)) {
        return null
      }
      squaredNorm += realDifference ** 2 + imaginaryDifference ** 2
    }
  }
  return Math.max(0, Math.min(1, Math.sqrt(squaredNorm / 2)))
}

/*
 * 実行条件の指紋。Gate-aware の状態エクスプローラーが回路の署名で
 * 結果の古さを判定するのと同じ役目を、Pulse では実行フォームと
 * レーン構成とハードウェア制約が担う。
 * ブロックのidは実行結果に影響しないので、署名から外す。
 */
export function pulseSetupSignature(
  form: PulseLabForm,
  circuit: PulseCircuitState,
): string {
  return JSON.stringify({
    form,
    executionConstraints: circuit.executionConstraints,
    transmons: circuit.transmons.map((transmon) => ({
      index: transmon.index,
      frequencyGhz: transmon.frequencyGhz,
      anharmonicityMhz: transmon.anharmonicityMhz,
    })),
    lanes: circuit.lanes.map((lane) => ({
      transmonIndex: lane.transmonIndex,
      steps: lane.steps.map((step) => (
        step.operation === 'drive'
          ? { operation: step.operation, primitive: step.primitive, pulse: step.pulse }
          : { operation: step.operation, angleRad: step.angleRad }
      )),
    })),
  })
}

export function formatPulseProbability(value: number): string {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(2)}%`
}
