import type { StateSnapshot } from '../types/simulation'

const NUMERICAL_EPSILON = 1e-10

export type BlochQubitState = {
  qubitIndex: number
  x: number
  y: number
  z: number
  radius: number
  phaseRadians: number | null
  polarRadians: number | null
  localPurity: number
  populationZero: number
  populationOne: number
  coherenceReal: number
  coherenceImag: number
}

export type BlochSnapshotResult =
  | {
      valid: true
      qubitCount: number
      states: BlochQubitState[]
    }
  | {
      valid: false
      message: string
    }

export function blochStatesFromSnapshot(
  snapshot: StateSnapshot | null | undefined,
): BlochSnapshotResult {
  const real = snapshot?.density_matrix?.real
  const imag = snapshot?.density_matrix?.imag

  if (!Array.isArray(real) || !Array.isArray(imag)) {
    return { valid: false, message: 'Bloch球を計算するための密度行列がありません。' }
  }

  const dimension = real.length
  const qubitCount = inferQubitCount(dimension)
  if (qubitCount === null) {
    return {
      valid: false,
      message: '密度行列の次元は2のべき乗である必要があります。',
    }
  }

  if (imag.length !== dimension) {
    return { valid: false, message: '密度行列の実部と虚部の形状が一致しません。' }
  }

  for (let row = 0; row < dimension; row += 1) {
    if (
      !Array.isArray(real[row]) ||
      !Array.isArray(imag[row]) ||
      real[row].length !== dimension ||
      imag[row].length !== dimension
    ) {
      return { valid: false, message: '密度行列は正方行列である必要があります。' }
    }

    for (let column = 0; column < dimension; column += 1) {
      if (!Number.isFinite(real[row][column]) || !Number.isFinite(imag[row][column])) {
        return { valid: false, message: '密度行列に有限でない値が含まれています。' }
      }
    }
  }

  return {
    valid: true,
    qubitCount,
    states: Array.from({ length: qubitCount }, (_, qubitIndex) =>
      reduceToBlochState(real, imag, qubitCount, qubitIndex),
    ),
  }
}

function inferQubitCount(dimension: number): number | null {
  if (!Number.isInteger(dimension) || dimension < 2) {
    return null
  }

  const qubitCount = Math.log2(dimension)
  return Number.isInteger(qubitCount) ? qubitCount : null
}

function reduceToBlochState(
  real: number[][],
  imag: number[][],
  qubitCount: number,
  qubitIndex: number,
): BlochQubitState {
  const dimension = real.length
  // QuantaScope uses q0 as the most-significant basis bit.
  const targetBitMask = 1 << (qubitCount - qubitIndex - 1)
  let populationZero = 0
  let populationOne = 0
  let coherenceReal = 0
  let coherenceImag = 0

  for (let basisIndex = 0; basisIndex < dimension; basisIndex += 1) {
    if ((basisIndex & targetBitMask) !== 0) {
      continue
    }

    const zeroIndex = basisIndex
    const oneIndex = basisIndex | targetBitMask
    populationZero += real[zeroIndex][zeroIndex]
    populationOne += real[oneIndex][oneIndex]
    coherenceReal += real[zeroIndex][oneIndex]
    coherenceImag += imag[zeroIndex][oneIndex]
  }

  const trace = populationZero + populationOne
  const normalization = Math.abs(trace) > NUMERICAL_EPSILON ? 1 / trace : 1
  populationZero *= normalization
  populationOne *= normalization
  coherenceReal *= normalization
  coherenceImag *= normalization

  const x = 2 * coherenceReal
  const y = -2 * coherenceImag
  const z = populationZero - populationOne
  const radius = Math.hypot(x, y, z)
  const transverseRadius = Math.hypot(x, y)
  const phaseRadians = transverseRadius > NUMERICAL_EPSILON ? Math.atan2(y, x) : null
  const polarRadians = radius > NUMERICAL_EPSILON
    ? Math.acos(clamp(z / radius, -1, 1))
    : null

  return {
    qubitIndex,
    x,
    y,
    z,
    radius,
    phaseRadians,
    polarRadians,
    localPurity: (1 + radius * radius) / 2,
    populationZero,
    populationOne,
    coherenceReal,
    coherenceImag,
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
