import type { OutputProbabilities } from '../types/simulation'

export type OutputProbabilityRow = {
  state: string
  probability: number
  isExpected: boolean
}

const BINARY_STATE_PATTERN = /^[01]+$/

export function basisLabels(logicalQubits: number): string[] {
  const qubitCount = sanitizeLogicalQubitCount(logicalQubits) ?? 2
  const count = 2 ** qubitCount
  return Array.from({ length: count }, (_, index) =>
    index.toString(2).padStart(qubitCount, '0'),
  )
}

export function resolveOutputProbabilityQubitCount(
  outputProbabilities: OutputProbabilities,
  qubitCount?: number | null,
): number {
  const sanitizedQubitCount = sanitizeLogicalQubitCount(qubitCount)
  if (sanitizedQubitCount !== null) {
    return sanitizedQubitCount
  }

  const binaryKeys = Object.keys(outputProbabilities).filter((key) =>
    BINARY_STATE_PATTERN.test(key),
  )
  if (binaryKeys.length > 0) {
    return binaryKeys[0].length
  }

  return 2
}

export function buildOutputProbabilityRows(
  outputProbabilities: OutputProbabilities,
  qubitCount?: number | null,
): { qubitCount: number; rows: OutputProbabilityRow[] } {
  const resolvedQubitCount = resolveOutputProbabilityQubitCount(
    outputProbabilities,
    qubitCount,
  )
  const expectedLabels = basisLabels(resolvedQubitCount)
  const expectedLabelSet = new Set(expectedLabels)

  const rows: OutputProbabilityRow[] = expectedLabels.map((state) => ({
    state,
    probability: normalizeProbability(outputProbabilities[state]),
    isExpected: true,
  }))

  const extraRows = Object.entries(outputProbabilities)
    .filter(([state]) => !expectedLabelSet.has(state))
    .sort(([leftState], [rightState]) => {
      const leftBinary = BINARY_STATE_PATTERN.test(leftState)
      const rightBinary = BINARY_STATE_PATTERN.test(rightState)
      if (leftBinary !== rightBinary) {
        return leftBinary ? -1 : 1
      }
      if (leftState.length !== rightState.length) {
        return leftState.length - rightState.length
      }
      return leftState.localeCompare(rightState)
    })
    .map(([state, probability]) => ({
      state,
      probability: normalizeProbability(probability),
      isExpected: false,
    }))

  return {
    qubitCount: resolvedQubitCount,
    rows: [...rows, ...extraRows],
  }
}

function sanitizeLogicalQubitCount(value: number | null | undefined): number | null {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return null
  }
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1) {
    return null
  }
  return count
}

function normalizeProbability(value: number | undefined): number {
  if (!Number.isFinite(value ?? Number.NaN)) {
    return 0
  }
  const clamped = Math.max(0, Math.min(1, Number(value)))
  return clamped
}
