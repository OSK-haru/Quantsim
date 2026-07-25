export type SimulationCostLevel = 'low' | 'medium' | 'high' | 'very_high'

export type SimulationCostEstimate = {
  level: SimulationCostLevel
  label: string
  message: string
  suggestion: string | null
}

type EstimateSimulationCostInput = {
  logicalQubits: number
  timeSteps: number
  durationUs: number
  circuitGateCount: number
  circuitColumnCount: number
}

const COST_LABELS: Record<SimulationCostLevel, string> = {
  low: '低コスト',
  medium: '中コスト',
  high: '高コスト',
  very_high: '非常に高いコスト',
}

export function estimateSimulationCost({
  logicalQubits,
  timeSteps,
  durationUs,
  circuitGateCount,
  circuitColumnCount,
}: EstimateSimulationCostInput): SimulationCostEstimate {
  const qubits = sanitizePositiveInteger(logicalQubits, 2)
  const steps = sanitizePositiveInteger(timeSteps, 11)
  const duration = sanitizePositiveNumber(durationUs, 1.0)
  const gateCount = sanitizePositiveInteger(circuitGateCount, 0)
  const columnCount = sanitizePositiveInteger(circuitColumnCount, 0)
  const gatePressure = gateCount + columnCount

  let level: SimulationCostLevel
  if (qubits <= 2) {
    level = steps <= 101 && duration <= 2.0 ? 'low' : 'medium'
  } else if (qubits === 3) {
    level = steps <= 101 && duration <= 2.0 ? 'medium' : 'high'
  } else {
    if (steps <= 31 && duration <= 1.0) {
      level = 'medium'
    } else if (steps <= 101 && duration <= 2.0) {
      level = 'high'
    } else {
      level = 'very_high'
    }
  }

  if (gatePressure >= 10 && level === 'low') {
    level = 'medium'
  } else if (gatePressure >= 14 && level === 'medium') {
    level = 'high'
  } else if (gatePressure >= 18 && level === 'high') {
    level = 'very_high'
  }

  return {
    level,
    label: COST_LABELS[level],
    message: buildMessage(qubits, steps, duration, level),
    suggestion: buildSuggestion(qubits, level),
  }
}

function buildMessage(
  logicalQubits: number,
  timeSteps: number,
  durationUs: number,
  level: SimulationCostLevel,
) {
  const durationText = formatDuration(durationUs)
  const prefix = `量子ビット ${logicalQubits} 個、時間ステップ ${timeSteps}、総シミュレーション時間 ${durationText}`
  const suffix =
    level === 'low'
      ? '通常は対話的に実行できます。'
      : level === 'medium'
        ? 'python_dense では少し時間がかかる場合があります。'
        : level === 'high'
          ? 'python_dense では数十秒かかる場合があります。'
          : 'python_dense では遅延またはタイムアウトの可能性があります。'

  return `${prefix}. ${suffix}`
}

function buildSuggestion(logicalQubits: number, level: SimulationCostLevel): string | null {
  if (logicalQubits < 4) {
    return null
  }

  if (level === 'low' || level === 'medium') {
    return '4量子ビットでの推奨設定: time_steps 11〜31、duration_us 0.5〜1.0。'
  }

  return '対話的に試す場合は、時間ステップを 11〜31 にするか、時間を短くしてください。'
}

function formatDuration(value: number) {
  return `${value.toFixed(2)} us`
}

function sanitizePositiveInteger(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : fallback
}

function sanitizePositiveNumber(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}
