import type { StateSnapshot } from '../types/simulation'

export type DensityMatrixMode = 'magnitude' | 'real' | 'imaginary'

export type DensityMatrixCell = {
  row: number
  column: number
  rowLabel: string
  columnLabel: string
  real: number
  imag: number
  magnitude: number
  value: number
  intensity: number
  sign: 'positive' | 'negative' | 'zero'
}

export type ValidatedDensityMatrix = {
  dimension: number
  qubitCount: number
  labels: string[]
  cells: DensityMatrixCell[]
  scaleLabel: string
}

export type DensityMatrixValidationResult =
  | { valid: true; matrix: ValidatedDensityMatrix }
  | { valid: false; message: string }

export function inferQubitCountFromDimension(dimension: number): number | null {
  if (dimension === 4) {
    return 2
  }
  if (dimension === 8) {
    return 3
  }
  if (dimension === 16) {
    return 4
  }
  return null
}

export function basisLabelsForDimension(dimension: number): string[] {
  const qubitCount = inferQubitCountFromDimension(dimension)
  if (qubitCount === null) {
    return []
  }

  return Array.from({ length: dimension }, (_, index) =>
    index.toString(2).padStart(qubitCount, '0'),
  )
}

export function formatDensityValue(value: number): string {
  if (!Number.isFinite(value)) {
    return 'not finite'
  }
  if (Object.is(value, -0) || Math.abs(value) < 0.0000005) {
    return '0.000000'
  }
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.0001) {
    return value.toExponential(4)
  }
  return value.toFixed(6)
}

export function formatSnapshotTimeUs(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'not available'
  }
  if (Math.abs(value) >= 100) {
    return `${value.toFixed(2)} us`
  }
  if (Math.abs(value) >= 1) {
    return `${value.toFixed(3)} us`
  }
  return `${value.toFixed(5)} us`
}

export function formatSnapshotProgress(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'not available'
  }
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.max(0, Math.min(normalized, 100)).toFixed(1)}%`
}

export function snapshotKindLabel(snapshot: StateSnapshot | null | undefined): string {
  if (!snapshot?.kind) {
    return 'Snapshot'
  }
  if (snapshot.kind === 'initial') {
    return 'Initial state'
  }
  if (snapshot.kind === 'column_boundary') {
    return snapshot.column_index == null
      ? 'After column'
      : `After column ${snapshot.column_index + 1}`
  }
  if (snapshot.kind === 'uniform_time') {
    return 'Uniform time sample'
  }
  if (snapshot.kind === 'custom_time') {
    return 'Custom time sample'
  }
  if (snapshot.kind === 'after_circuit') {
    return 'After circuit'
  }
  if (snapshot.kind === 'idle_sample') {
    return 'Idle sample'
  }
  if (snapshot.kind === 'final') {
    return 'Final state'
  }
  return 'Snapshot'
}

export function validateDensityMatrixSnapshot(
  snapshot: StateSnapshot | null | undefined,
  mode: DensityMatrixMode,
): DensityMatrixValidationResult {
  const real = snapshot?.density_matrix?.real
  const imag = snapshot?.density_matrix?.imag

  if (!Array.isArray(real) || !Array.isArray(imag)) {
    return { valid: false, message: 'Density matrix data is missing.' }
  }

  const dimension = real.length
  const qubitCount = inferQubitCountFromDimension(dimension)
  if (qubitCount === null) {
    return {
      valid: false,
      message: 'Density matrix dimension must be 4x4, 8x8, or 16x16.',
    }
  }

  if (imag.length !== dimension) {
    return { valid: false, message: 'Density matrix real and imaginary shapes do not match.' }
  }

  for (let row = 0; row < dimension; row += 1) {
    if (!Array.isArray(real[row]) || !Array.isArray(imag[row])) {
      return { valid: false, message: 'Density matrix rows are malformed.' }
    }
    if (real[row].length !== dimension || imag[row].length !== dimension) {
      return { valid: false, message: 'Density matrix must be square.' }
    }
  }

  const labels = basisLabelsForDimension(dimension)
  const rawValues: Array<{
    row: number
    column: number
    real: number
    imag: number
    magnitude: number
    value: number
  }> = []

  let maxMagnitude = 0
  let maxAbs = 0

  for (let row = 0; row < dimension; row += 1) {
    for (let column = 0; column < dimension; column += 1) {
      const realValue = real[row][column]
      const imagValue = imag[row][column]

      if (!Number.isFinite(realValue) || !Number.isFinite(imagValue)) {
        return { valid: false, message: 'Density matrix contains non-finite values.' }
      }

      const magnitude = Math.hypot(realValue, imagValue)
      const value =
        mode === 'magnitude' ? magnitude : mode === 'real' ? realValue : imagValue
      maxMagnitude = Math.max(maxMagnitude, magnitude)
      maxAbs = Math.max(maxAbs, Math.abs(value))
      rawValues.push({
        row,
        column,
        real: realValue,
        imag: imagValue,
        magnitude,
        value,
      })
    }
  }

  const denominator = mode === 'magnitude' ? maxMagnitude : maxAbs
  const cells = rawValues.map((entry) => {
    const intensity = denominator === 0 ? 0 : Math.min(Math.abs(entry.value) / denominator, 1)
    const sign: DensityMatrixCell['sign'] =
      Math.abs(entry.value) < 0.000000000001
        ? 'zero'
        : entry.value > 0
          ? 'positive'
          : 'negative'

    return {
      ...entry,
      rowLabel: labels[entry.row],
      columnLabel: labels[entry.column],
      intensity,
      sign,
    }
  })

  return {
    valid: true,
    matrix: {
      dimension,
      qubitCount,
      labels,
      cells,
      scaleLabel:
        mode === 'magnitude'
          ? `0 to ${formatDensityValue(maxMagnitude)}`
          : `-${formatDensityValue(maxAbs)} to +${formatDensityValue(maxAbs)}`,
    },
  }
}
