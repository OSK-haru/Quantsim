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

// Keep the interactive grid bounded even though the simulator can evolve
// larger density matrices. Rendering 64x64-256x256 cells is not useful UI.
const MAX_RENDERABLE_QUBITS = 5

export function inferQubitCountFromDimension(dimension: number): number | null {
  const qubitCount = Math.log2(dimension)
  return Number.isInteger(qubitCount) && qubitCount >= 1 && qubitCount <= MAX_RENDERABLE_QUBITS
    ? qubitCount
    : null
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
      message: '密度行列グリッドは5量子ビット以下の結果で表示できます。',
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
  const rawValues: Array<{
    row: number
    column: number
    real: number
    imag: number
    magnitude: number
    phase: number
    value: number
  }> = []

  let maxMagnitude = 0
  let maxAbs = 0

  for (let row = 0; row < dimension; row += 1) {
    for (let column = 0; column < dimension; column += 1) {
      const realValue = real[row][column]
      const imagValue = imag[row][column]

      if (!Number.isFinite(realValue) || !Number.isFinite(imagValue)) {
        return { valid: false, message: '密度行列に有限でない値が含まれています。' }
      }

      const magnitude = Math.hypot(realValue, imagValue)
      const phase = magnitude < 1e-12 ? 0 : Math.atan2(imagValue, realValue)
      const value =
        mode === 'magnitude'
          ? magnitude
          : mode === 'real'
            ? realValue
            : mode === 'imaginary'
              ? imagValue
              : phase
      maxMagnitude = Math.max(maxMagnitude, magnitude)
      maxAbs = Math.max(maxAbs, Math.abs(value))
      rawValues.push({
        row,
        column,
        real: realValue,
        imag: imagValue,
        magnitude,
        phase,
        value,
      })
    }
  }

  const denominator = mode === 'magnitude' ? maxMagnitude : maxAbs
  const cells = rawValues.map((entry) => {
    const intensity = mode === 'phase'
      ? (maxMagnitude === 0 ? 0 : Math.min(entry.magnitude / maxMagnitude, 1))
      : (denominator === 0 ? 0 : Math.min(Math.abs(entry.value) / denominator, 1))
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
          ? `0 から ${formatDensityValue(maxMagnitude)}`
          : mode === 'phase'
            ? '-π から +π（濃さは絶対値）'
            : `-${formatDensityValue(maxAbs)} から +${formatDensityValue(maxAbs)}`,
    },
  }
}
