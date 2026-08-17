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
  evolutionMethod?: 'fixed_step_rk4' | 'explicit_cptp'
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
  evolutionMethod = 'fixed_step_rk4',
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

  // 独立した if で順に評価する。else if で繋ぐと最初の枝で連鎖を抜けてしまい、
  // 例えば gatePressure 20 の low 構成が medium 止まりになる。
  if (gatePressure >= 10 && level === 'low') {
    level = 'medium'
  }
  if (gatePressure >= 14 && level === 'medium') {
    level = 'high'
  }
  if (gatePressure >= 18 && level === 'high') {
    level = 'very_high'
  }

  // Explicit CPTP builds and audits a 4**n superoperator per distinct interval.
  // Measured on python_dense: 4 qubits ~14 s, 5 qubits over 10 minutes. Flag it
  // before the run rather than letting the request hang.
  const cptpAtFiveQubits = evolutionMethod === 'explicit_cptp' && qubits >= 5
  const largeNoisyDensityMatrix = qubits >= 6
  if (cptpAtFiveQubits || largeNoisyDensityMatrix) {
    level = 'very_high'
  }

  return {
    level,
    label: COST_LABELS[level],
    message: cptpAtFiveQubits
      ? `量子ビット ${qubits} 個で Explicit CPTP を選ぶと、区間ごとに ${4 ** qubits} 次元の超演算子を構築・監査します。`
        + ' python_dense では10分以上かかる見込みです。'
      : largeNoisyDensityMatrix
        ? `量子ビット ${qubits} 個のノイズあり密度行列は ${2 ** qubits}x${2 ** qubits} です。実行に数十秒〜分単位かかる場合があります。`
      : buildMessage(qubits, steps, duration, level),
    suggestion: cptpAtFiveQubits
      ? '5量子ビットでは Fixed-step RK4 を使ってください（同条件で数秒です）。'
      : largeNoisyDensityMatrix
        ? 'Fixed-step RK4を選び、time_steps 3〜11、duration_us 0.1〜0.5から試してください。Rust previewも選択できます。'
      : buildSuggestion(qubits, level),
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
    return `${logicalQubits}量子ビットでの推奨設定: time_steps 11〜31、duration_us 0.5〜1.0。`
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
