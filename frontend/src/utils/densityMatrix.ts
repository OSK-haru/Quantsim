import type { StateSnapshot } from '../types/simulation'

export type DensityMatrixMode = 'magnitude' | 'real' | 'imaginary' | 'phase'

export type DensityMatrixCell = {
  row: number
  column: number
  rowLabel: string
  columnLabel: string
  real: number
  imag: number
  magnitude: number
  phase: number
  value: number
  intensity: number
  sign: 'positive' | 'negative' | 'zero'
}

/**
 * Row-major planes covering the whole matrix.
 *
 * The raster renderer uploads these straight to the GPU, and above five qubits
 * they are the only representation built — 8 qubits would otherwise mean 65536
 * per-cell objects rebuilt on every render.
 */
export type DensityMatrixField = {
  real: Float32Array
  imag: Float32Array
  /** Raw mode-dependent value; divide by `denominator` to normalise. */
  value: Float32Array
  /** Brightness weight in [0, 1]. */
  intensity: Float32Array
}

export type ValidatedDensityMatrix = {
  dimension: number
  qubitCount: number
  labels: string[]
  /** Per-cell objects, only populated when the DOM grid can render them. */
  cells: DensityMatrixCell[]
  field: DensityMatrixField
  /** Scale that maps `field.value` onto [-1, 1] for the raster renderer. */
  denominator: number
  gridRenderable: boolean
  scaleLabel: string
}

export type DensityMatrixValidationResult =
  | { valid: true; matrix: ValidatedDensityMatrix }
  | { valid: false; message: string }

// Matches MAX_DENSITY_MATRIX_QUBITS in core/capabilities.py — the simulator
// serialises density matrices up to eight qubits, so the viewer accepts the
// same range and hands anything past the grid limit to the raster renderer.
export const MAX_RENDERABLE_QUBITS = 8

// Past this the DOM grid stops being readable (and stops being cheap): a
// 64x64 matrix is 4096 focusable cells. The raster path takes over instead.
export const GRID_QUBIT_LIMIT = 5

export function inferQubitCountFromDimension(dimension: number): number | null {
  const qubitCount = Math.log2(dimension)
  return Number.isInteger(qubitCount) && qubitCount >= 1 && qubitCount <= MAX_RENDERABLE_QUBITS
    ? qubitCount
    : null
}

/** Rebuild a single cell from the field planes, for raster-mode inspection. */
export function densityCellAt(
  matrix: ValidatedDensityMatrix,
  row: number,
  column: number,
): DensityMatrixCell | null {
  const { dimension, field, labels } = matrix
  if (row < 0 || column < 0 || row >= dimension || column >= dimension) {
    return null
  }

  const index = row * dimension + column
  const real = field.real[index]
  const imag = field.imag[index]
  const value = field.value[index]
  const magnitude = Math.hypot(real, imag)
  return {
    row,
    column,
    rowLabel: labels[row],
    columnLabel: labels[column],
    real,
    imag,
    magnitude,
    phase: magnitude < 1e-12 ? 0 : Math.atan2(imag, real),
    value,
    intensity: field.intensity[index],
    sign: Math.abs(value) < 1e-12 ? 'zero' : value > 0 ? 'positive' : 'negative',
  }
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
    return '有限値ではありません'
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
    return '利用できません'
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
    return '利用できません'
  }
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.max(0, Math.min(normalized, 100)).toFixed(1)}%`
}

export function snapshotKindLabel(snapshot: StateSnapshot | null | undefined): string {
  if (!snapshot?.kind) {
    return 'スナップショット'
  }
  if (snapshot.kind === 'initial') {
    return '初期状態'
  }
  if (snapshot.kind === 'column_boundary') {
    return snapshot.column_index == null
      ? '列の後'
      : `列 ${snapshot.column_index + 1} の後`
  }
  if (snapshot.kind === 'measurement') {
    return '測定直後'
  }
  if (snapshot.kind === 'uniform_time') {
    return '均等時刻サンプル'
  }
  if (snapshot.kind === 'custom_time') {
    return 'カスタム時刻サンプル'
  }
  if (snapshot.kind === 'after_circuit') {
    return '回路の後'
  }
  if (snapshot.kind === 'idle_sample') {
    return '待機サンプル'
  }
  if (snapshot.kind === 'final') {
    return '最終状態'
  }
  return 'スナップショット'
}

export function validateDensityMatrixSnapshot(
  snapshot: StateSnapshot | null | undefined,
  mode: DensityMatrixMode,
): DensityMatrixValidationResult {
  const real = snapshot?.density_matrix?.real
  const imag = snapshot?.density_matrix?.imag

  if (!Array.isArray(real) || !Array.isArray(imag)) {
    return { valid: false, message: '密度行列データがありません。' }
  }

  const dimension = real.length
  const qubitCount = inferQubitCountFromDimension(dimension)
  if (qubitCount === null) {
    return {
      valid: false,
      message: `密度行列は${MAX_RENDERABLE_QUBITS}量子ビット以下の結果で表示できます。`,
    }
  }

  if (imag.length !== dimension) {
    return { valid: false, message: '密度行列の実部と虚部の形状が一致しません。' }
  }

  for (let row = 0; row < dimension; row += 1) {
    if (!Array.isArray(real[row]) || !Array.isArray(imag[row])) {
      return { valid: false, message: '密度行列の行形式が不正です。' }
    }
    if (real[row].length !== dimension || imag[row].length !== dimension) {
      return { valid: false, message: '密度行列は正方行列である必要があります。' }
    }
  }

  const labels = basisLabelsForDimension(dimension)
  const count = dimension * dimension
  const fieldReal = new Float32Array(count)
  const fieldImag = new Float32Array(count)
  const fieldValue = new Float32Array(count)
  const fieldIntensity = new Float32Array(count)

  let maxMagnitude = 0
  let maxAbs = 0

  for (let row = 0; row < dimension; row += 1) {
    const realRow = real[row]
    const imagRow = imag[row]
    for (let column = 0; column < dimension; column += 1) {
      const realValue = realRow[column]
      const imagValue = imagRow[column]

      if (!Number.isFinite(realValue) || !Number.isFinite(imagValue)) {
        return { valid: false, message: '密度行列に有限でない値が含まれています。' }
      }

      const magnitude = Math.hypot(realValue, imagValue)
      const value =
        mode === 'magnitude'
          ? magnitude
          : mode === 'real'
            ? realValue
            : mode === 'imaginary'
              ? imagValue
              : magnitude < 1e-12
                ? 0
                : Math.atan2(imagValue, realValue)

      const index = row * dimension + column
      fieldReal[index] = realValue
      fieldImag[index] = imagValue
      fieldValue[index] = value
      // Reused as scratch until the maxima are known, then normalised below.
      fieldIntensity[index] = mode === 'phase' ? magnitude : Math.abs(value)

      maxMagnitude = Math.max(maxMagnitude, magnitude)
      maxAbs = Math.max(maxAbs, Math.abs(value))
    }
  }

  // Phase spans a fixed range, so only the brightness weight is data-scaled.
  const denominator = mode === 'phase' ? Math.PI : mode === 'magnitude' ? maxMagnitude : maxAbs
  const intensityScale = mode === 'phase' ? maxMagnitude : denominator
  for (let index = 0; index < count; index += 1) {
    fieldIntensity[index] = intensityScale === 0
      ? 0
      : Math.min(fieldIntensity[index] / intensityScale, 1)
  }

  const field: DensityMatrixField = {
    real: fieldReal,
    imag: fieldImag,
    value: fieldValue,
    intensity: fieldIntensity,
  }

  const gridRenderable = qubitCount <= GRID_QUBIT_LIMIT
  const matrix: ValidatedDensityMatrix = {
    dimension,
    qubitCount,
    labels,
    cells: [],
    field,
    denominator,
    gridRenderable,
    scaleLabel:
      mode === 'magnitude'
        ? `0 から ${formatDensityValue(maxMagnitude)}`
        : mode === 'phase'
          ? '-π から +π（濃さは絶対値）'
          : `-${formatDensityValue(maxAbs)} から +${formatDensityValue(maxAbs)}`,
  }

  // Only materialise per-cell objects when the DOM grid will actually use them.
  if (gridRenderable) {
    const cells: DensityMatrixCell[] = new Array(count)
    for (let index = 0; index < count; index += 1) {
      cells[index] = densityCellAt(matrix, Math.floor(index / dimension), index % dimension)!
    }
    matrix.cells = cells
  }

  return { valid: true, matrix }
}
