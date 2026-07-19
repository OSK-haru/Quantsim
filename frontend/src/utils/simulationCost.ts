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
  low: 'Low cost',
  medium: 'Medium cost',
  high: 'High cost',
  very_high: 'Very high cost',
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
  const prefix = `${logicalQubits}-qubit run, ${timeSteps} time steps, ${durationText} total simulation time`
  const suffix =
    level === 'low'
      ? 'This should usually stay interactive.'
      : level === 'medium'
        ? 'This may take a little longer on python_dense.'
        : level === 'high'
          ? 'This may take tens of seconds with python_dense.'
          : 'This is likely to be slow or timeout on python_dense.'

  return `${prefix}. ${suffix}`
}

function buildSuggestion(logicalQubits: number, level: SimulationCostLevel): string | null {
  if (logicalQubits < 4) {
    return null
  }

  if (level === 'low' || level === 'medium') {
    return 'Suggested interactive settings for 4 qubits: time_steps 11-31, duration_us 0.5-1.0.'
  }

  return 'For interactive testing, try 11-31 time steps or a shorter duration.'
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
