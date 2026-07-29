import { useEffect, useEffectEvent, useRef, useState } from 'react'
import './SimulatePage.css'
import { CircuitSummaryCard } from '../components/CircuitSummaryCard'
import { DensityMatrixSummaryCard } from '../components/DensityMatrixSummaryCard'
import { DiagnosticsCard, type SimulationDiagnostics } from '../components/DiagnosticsCard'
import { MetricTimeline } from '../components/MetricTimeline'
import { ModelInfoPanel } from '../components/ModelInfoPanel'
import { OutputProbabilities } from '../components/OutputProbabilities'
import { ParameterPanel } from '../components/ParameterPanel'
import { RunPanel } from '../components/RunPanel'
import { ResultDrawer } from '../components/ResultDrawer'
import { SimulationSummary } from '../components/SimulationSummary'
import { uiResponseExample } from '../mock/uiResponseExample'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { validateCircuitConfigForRun } from '../utils/circuitValidation'
import { estimateSimulationCost } from '../utils/simulationCost'
import { useCircuitContext } from '../context/useCircuitContext'
import type {
  GateDurationDefaultErrors,
  GateDurationDefaults,
  GateAwareEvolutionMethod,
  SimulateRequestParameterErrors,
  SimulateRequestParameters,
  SnapshotOptions,
  SimulationLoadStatus,
  SimulationResponse,
  SimulationSummaryData,
} from '../types/simulation'

type StatusItem = {
  label: string
  value: string
}

type SimulatePageProps = {
  diagnostics: SimulationDiagnostics
  result: SimulationSummaryData
  statusItems: StatusItem[]
  gateDurationDefaults: GateDurationDefaults
  onGateDurationDefaultsChange: (gateDurationDefaults: GateDurationDefaults) => void
  onBackToHome: () => void
  onOpenCircuitStudio: () => void
  onOpenStateExplorer: () => void
  onOpenHelp: () => void
  onOpenPulseLab: () => void
  onSuccessfulResponse: (response: SimulationResponse) => void
}

type SimulateRequestPayload = {
  simulation_backend: 'python_dense'
  evolution_method: GateAwareEvolutionMethod
  input_mode: 'physical'
  circuit_config: ReturnType<typeof circuitEditorStateToConfig>
  gate_duration_defaults: GateDurationDefaults
  snapshot_options: SnapshotOptions
  parameters: SimulateRequestParameters
}

type RequestErrorKind = 'none' | 'api' | 'validation'
const API_EXAMPLE_TIMEOUT_MS = 10000
const RUN_REQUEST_MIN_TIMEOUT_MS = 15000
const RUN_REQUEST_TIMEOUT_PER_STEP_MS = 25

const initialSimulationParameters: SimulateRequestParameters = {
  device_quality: 0.8,
  temperature_mk: 15.0,
  flux_noise_phi0: 0.000001,
  qubit_frequency_ghz: 5.0,
  t1_max_us: 100.0,
  tphi_max_us: 100.0,
  duration_us: 2.0,
  time_steps: 101,
  fidelity_threshold: 0.9,
}

const initialSnapshotOptions: SnapshotOptions = {
  enabled: true,
  uniform_count: 10,
  custom_times_us: [],
  include_initial: true,
  include_final: true,
  include_column_boundaries: true,
  include_after_circuit: true,
}

const requiredResponseKeys: Array<keyof SimulationResponse> = [
  'circuit',
  'parameters',
  'rates',
  'diagnostics',
  'summary',
  'timeline',
  'output_probabilities',
  'run',
  'warnings',
  'issues',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResponseArray(value: unknown) {
  return Array.isArray(value)
}

function hasRequiredResponseKeys(value: unknown): value is SimulationResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    requiredResponseKeys.every((key) => Object.prototype.hasOwnProperty.call(candidate, key)) &&
    isRecord(candidate.circuit) &&
    isRecord(candidate.parameters) &&
    isRecord(candidate.rates) &&
    isRecord(candidate.diagnostics) &&
    isRecord(candidate.summary) &&
    isResponseArray(candidate.timeline) &&
    isRecord(candidate.output_probabilities) &&
    isRecord(candidate.run) &&
    isResponseArray(candidate.warnings) &&
    isResponseArray(candidate.issues)
  )
}

function validateSimulationParameters(parameters: SimulateRequestParameters): {
  errors: SimulateRequestParameterErrors
  firstMessage: string | null
} {
  const errors: SimulateRequestParameterErrors = {}

  const validateZeroToOne = (
    name: keyof Pick<
      SimulateRequestParameters,
      | 'device_quality'
      | 'fidelity_threshold'
    >,
    label: string,
  ) => {
    const value = parameters[name]
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors[name] = `${label} は 0 以上 1 以下で入力してください。`
    }
  }

  validateZeroToOne('device_quality', 'デバイス品質')
  validateZeroToOne('fidelity_threshold', '忠実度のしきい値')

  if (!Number.isFinite(parameters.temperature_mk)) {
    errors.temperature_mk = '温度は有限の数値で入力してください。'
  } else if (parameters.temperature_mk < 0) {
    errors.temperature_mk = '温度は 0 mK 以上で入力してください。'
  }

  if (!Number.isFinite(parameters.flux_noise_phi0)) {
    errors.flux_noise_phi0 = '磁束ノイズは有限の数値で入力してください。'
  } else if (parameters.flux_noise_phi0 < 0) {
    errors.flux_noise_phi0 = '磁束ノイズは 0 以上で入力してください。'
  }

  if (!Number.isFinite(parameters.qubit_frequency_ghz)) {
    errors.qubit_frequency_ghz = '量子ビット周波数は有限の数値で入力してください。'
  } else if (parameters.qubit_frequency_ghz <= 0) {
    errors.qubit_frequency_ghz = '量子ビット周波数は 0 GHz より大きい値で入力してください。'
  }

  if (!Number.isFinite(parameters.t1_max_us)) {
    errors.t1_max_us = '最大 T1 は有限の数値で入力してください。'
  } else if (parameters.t1_max_us <= 0) {
    errors.t1_max_us = '最大 T1 は 0 us より大きい値で入力してください。'
  }

  if (!Number.isFinite(parameters.tphi_max_us)) {
    errors.tphi_max_us = '最大 Tφ は有限の数値で入力してください。'
  } else if (parameters.tphi_max_us <= 0) {
    errors.tphi_max_us = '最大 Tφ は 0 us より大きい値で入力してください。'
  }

  if (!Number.isFinite(parameters.duration_us)) {
    errors.duration_us = 'シミュレーション時間は有限の数値で入力してください。'
  } else if (parameters.duration_us <= 0) {
    errors.duration_us = 'シミュレーション時間は 0 より大きい値で入力してください。'
  }

  if (!Number.isFinite(parameters.time_steps)) {
    errors.time_steps = '時間ステップ数は有限の数値で入力してください。'
  } else if (!Number.isInteger(parameters.time_steps) || parameters.time_steps < 2) {
    errors.time_steps = '時間ステップ数は 2 以上の整数で入力してください。'
  }

  const firstMessage = Object.values(errors)[0] ?? null
  return { errors, firstMessage }
}

function validateGateDurationDefaults(gateDurations: GateDurationDefaults): {
  errors: GateDurationDefaultErrors
  firstMessage: string | null
} {
  const errors: GateDurationDefaultErrors = {}

  const validateNonNegative = (name: keyof GateDurationDefaults, label: string) => {
    const value = gateDurations[name]
    if (!Number.isFinite(value) || value < 0) {
      errors[name] = `${label} は 0 us 以上で入力してください。`
    }
  }

  const validatePositive = (name: keyof GateDurationDefaults, label: string) => {
    const value = gateDurations[name]
    if (!Number.isFinite(value) || value <= 0) {
      errors[name] = `${label} は 0 us より大きい値で入力してください。`
    }
  }

  validatePositive('H', 'H の操作時間')
  validatePositive('X', 'X の操作時間')
  validateNonNegative('Z', 'Z の操作時間')
  validatePositive('CNOT', 'CNOT の操作時間')
  validateNonNegative('MEASURE', '測定の操作時間')

  const firstMessage = Object.values(errors)[0] ?? null
  return { errors, firstMessage }
}

function parseCustomSnapshotTimes(value: string): {
  times: number[]
  error: string | null
} {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { times: [], error: null }
  }

  const parts = trimmed.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length > 100) {
    return { times: [], error: 'スナップショット時刻は最大 100 個まで指定できます。' }
  }
  const times = parts.map(Number)
  if (times.some((time) => !Number.isFinite(time) || time < 0)) {
    return { times: [], error: 'カスタム時刻は 0 以上の有限な数値で入力してください。' }
  }
  return { times, error: null }
}

function validateSnapshotOptions(
  options: SnapshotOptions,
  durationUs: number,
): string | null {
  if (!Number.isInteger(options.uniform_count) || options.uniform_count < 0 || options.uniform_count > 100) {
    return '均等サンプル数は 0〜100 の整数で入力してください。'
  }
  if (options.uniform_count === 1) {
    return '均等サンプル数 1 は指定できません。0 または 2 以上を使用してください。'
  }
  if (options.custom_times_us.some((time) => time > durationUs)) {
    return 'カスタムスナップショット時刻は総シミュレーション時間を超えられません。'
  }
  return null
}

function formatApiFailureMessage(status: number, detail: string | null) {
  if (status === 422) {
    const detailSuffix = detail ? `: ${detail}` : ''
    return `HTTP 422: リクエストの検証に失敗しました${detailSuffix}。前回の結果を表示しています。`
  }

  const detailSuffix = detail ? `: ${detail}` : ''
  return `HTTP ${status}${detailSuffix}。前回の結果を表示しています。`
}

function normalizeApiDetail(detail: unknown): string | null {
  if (typeof detail === 'string') {
    const trimmed = detail.trim()
    return trimmed.length > 0 ? trimmed.replace(/\s+/g, ' ').slice(0, 180) : null
  }

  if (Array.isArray(detail)) {
    const joined = detail
      .map((entry) => normalizeApiDetail(entry))
      .filter((entry): entry is string => entry !== null)
      .join('; ')
    return joined.length > 0 ? joined.slice(0, 260) : null
  }

  if (typeof detail === 'object' && detail !== null) {
    const candidate = detail as Record<string, unknown>
    const message = normalizeApiDetail(candidate.message)
    const pydanticMessage = normalizeApiDetail(candidate.msg)
    const location = Array.isArray(candidate.loc)
      ? candidate.loc.map((entry) => String(entry)).join('.')
      : normalizeApiDetail(candidate.loc)
    const errorType = normalizeApiDetail(candidate.error_type)
      ?? normalizeApiDetail(candidate.type)
    const error = normalizeApiDetail(candidate.error)
    if (message || pydanticMessage || location || errorType || error) {
      return [
        location,
        message ?? pydanticMessage,
        errorType ? `(${errorType})` : null,
        error,
      ]
        .filter((entry): entry is string => entry !== null)
        .join(': ')
        .slice(0, 260)
    }
    if ('detail' in candidate) {
      return normalizeApiDetail(candidate.detail)
    }
  }

  return null
}

export function SimulatePage({
  statusItems,
  gateDurationDefaults,
  onGateDurationDefaultsChange,
  onBackToHome,
  onOpenCircuitStudio,
  onOpenStateExplorer,
  onOpenHelp,
  onOpenPulseLab,
  onSuccessfulResponse,
}: SimulatePageProps) {
  const { circuitState } = useCircuitContext()
  const [response, setResponse] = useState<SimulationResponse>(uiResponseExample)
  const [loadStatus, setLoadStatus] = useState<SimulationLoadStatus>('fixture')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastFetchUrl, setLastFetchUrl] = useState<string>('')
  const [lastFetchStartedAt, setLastFetchStartedAt] = useState<string>('')
  const [frontendRunStartedAt, setFrontendRunStartedAt] = useState<string>('')
  const [frontendRunFinishedAt, setFrontendRunFinishedAt] = useState<string>('')
  const [frontendRunElapsedMs, setFrontendRunElapsedMs] = useState<number | null>(null)
  const [frontendRunTimeoutMs, setFrontendRunTimeoutMs] = useState<number | null>(null)
  const [lastFetchResult, setLastFetchResult] = useState<string>('idle')
  const [latestSourceLabel, setLatestSourceLabel] = useState<string>('Static fixture')
  const [activeRequestLabel, setActiveRequestLabel] = useState<string>('')
  const [simulationParameters, setSimulationParameters] =
    useState<SimulateRequestParameters>(initialSimulationParameters)
  const [evolutionMethod, setEvolutionMethod] =
    useState<GateAwareEvolutionMethod>('fixed_step_rk4')
  const [parameterErrors, setParameterErrors] =
    useState<SimulateRequestParameterErrors>({})
  const [gateDurationErrors, setGateDurationErrors] =
    useState<GateDurationDefaultErrors>({})
  const [snapshotOptions, setSnapshotOptions] = useState<SnapshotOptions>(initialSnapshotOptions)
  const [customSnapshotTimesInput, setCustomSnapshotTimesInput] = useState('')
  const [snapshotOptionsError, setSnapshotOptionsError] = useState<string | null>(null)
  const [requestErrorKind, setRequestErrorKind] = useState<RequestErrorKind>('none')
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  function handleSimulationParametersChange(nextParameters: SimulateRequestParameters) {
    const validation = validateSimulationParameters(nextParameters)
    const gateDurationValidation = validateGateDurationDefaults(gateDurationDefaults)
    setSimulationParameters(nextParameters)
    setParameterErrors(validation.errors)

    if (
      requestErrorKind === 'validation' &&
      validation.firstMessage === null &&
      gateDurationValidation.firstMessage === null
    ) {
      setRequestErrorKind('none')
      setErrorMessage(null)
    }
  }

  function handleGateDurationDefaultsChange(nextGateDurations: GateDurationDefaults) {
    const validation = validateGateDurationDefaults(nextGateDurations)
    onGateDurationDefaultsChange(nextGateDurations)
    setGateDurationErrors(validation.errors)

    const parameterValidation = validateSimulationParameters(simulationParameters)
    if (
      requestErrorKind === 'validation' &&
      validation.firstMessage === null &&
      parameterValidation.firstMessage === null
    ) {
      setRequestErrorKind('none')
      setErrorMessage(null)
    }
  }

  async function loadExampleFromApi() {
    abortControllerRef.current?.abort()

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const controller = new AbortController()
    abortControllerRef.current = controller
    const url = `/api/simulation/example?ts=${Date.now()}`
    const startedAt = new Date().toISOString()
    const timeoutId = window.setTimeout(() => controller.abort(), API_EXAMPLE_TIMEOUT_MS)

    setLoadStatus('loading')
    setActiveRequestLabel('GET /api/simulation/example')
    setLastFetchUrl(url)
    setLastFetchStartedAt(startedAt)
    setLastFetchResult('pending')
    setErrorMessage(null)
    setRequestErrorKind('none')

    try {
      const apiResponse = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!apiResponse.ok) {
        throw new Error(`HTTP ${apiResponse.status}`)
      }

      const parsed = (await apiResponse.json()) as unknown
      if (!hasRequiredResponseKeys(parsed)) {
        throw new Error('Invalid response shape')
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setResponse(parsed as SimulationResponse)
      onSuccessfulResponse(parsed as SimulationResponse)
      setLoadStatus('api')
      setLatestSourceLabel('API example')
      setLastFetchResult('success')
      setErrorMessage(null)
      setRequestErrorKind('none')
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      let message = 'Using static fixture fallback.'
      if (error instanceof Error) {
        message =
          error.name === 'AbortError'
            ? 'API request timed out. Using static fixture fallback.'
            : `${error.message}. Using static fixture fallback.`
      }

      setResponse(uiResponseExample)
      setLoadStatus('error')
      setLatestSourceLabel('Static fixture fallback')
      setLastFetchResult('failed')
      setErrorMessage(message)
      setRequestErrorKind('api')
    } finally {
      window.clearTimeout(timeoutId)
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }

  async function runSimulationFromApi() {
    const frontendStartedAtMs = performance.now()
    const frontendStartedAtIso = new Date().toISOString()
    const timeoutMs = getRunRequestTimeoutMs(
      simulationParameters.time_steps,
      circuitState.logical_qubits,
      evolutionMethod,
    )
    setFrontendRunStartedAt(frontendStartedAtIso)
    setFrontendRunFinishedAt('')
    setFrontendRunElapsedMs(null)
    setFrontendRunTimeoutMs(timeoutMs)

    const validation = validateSimulationParameters(simulationParameters)
    const gateDurationValidation = validateGateDurationDefaults(gateDurationDefaults)
    const parsedSnapshotTimes = parseCustomSnapshotTimes(customSnapshotTimesInput)
    const requestedSnapshotOptions = {
      ...snapshotOptions,
      custom_times_us: parsedSnapshotTimes.times,
    }
    const snapshotValidationMessage =
      parsedSnapshotTimes.error ??
      validateSnapshotOptions(requestedSnapshotOptions, simulationParameters.duration_us)
    setSnapshotOptionsError(snapshotValidationMessage)
    setParameterErrors(validation.errors)
    setGateDurationErrors(gateDurationValidation.errors)
    const firstValidationMessage =
      validation.firstMessage ??
      gateDurationValidation.firstMessage ??
      snapshotValidationMessage
    if (firstValidationMessage !== null) {
      setLoadStatus('error')
      setActiveRequestLabel('POST /api/simulate')
      setLastFetchUrl('not requested - validation failed')
      setLastFetchStartedAt(new Date().toISOString())
      setLastFetchResult('validation failed')
      setRequestErrorKind('validation')
      setErrorMessage(firstValidationMessage)
      setFrontendRunFinishedAt(new Date().toISOString())
      setFrontendRunElapsedMs(Number((performance.now() - frontendStartedAtMs).toFixed(1)))
      return
    }

    const circuitConfig = circuitEditorStateToConfig(circuitState)
    const circuitValidation = validateCircuitConfigForRun(circuitConfig)
    if (!circuitValidation.valid) {
      setLoadStatus('error')
      setActiveRequestLabel('POST /api/simulate')
      setLastFetchUrl('not requested - validation failed')
      setLastFetchStartedAt(new Date().toISOString())
      setLastFetchResult('validation failed')
      setRequestErrorKind('validation')
      setErrorMessage(circuitValidation.message)
      setFrontendRunFinishedAt(new Date().toISOString())
      setFrontendRunElapsedMs(Number((performance.now() - frontendStartedAtMs).toFixed(1)))
      return
    }

    abortControllerRef.current?.abort()

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const controller = new AbortController()
    abortControllerRef.current = controller
    const url = `/api/simulate?ts=${Date.now()}`
    const startedAt = new Date().toISOString()
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

    setLoadStatus('loading')
    setActiveRequestLabel('POST /api/simulate')
    setLastFetchUrl(url)
    setLastFetchStartedAt(startedAt)
    setLastFetchResult('pending')
    setErrorMessage(null)
    setRequestErrorKind('none')

    try {
      const payload: SimulateRequestPayload = {
        simulation_backend: 'python_dense',
        evolution_method: evolutionMethod,
        input_mode: 'physical',
        circuit_config: circuitConfig,
        gate_duration_defaults: gateDurationDefaults,
        snapshot_options: requestedSnapshotOptions,
        parameters: simulationParameters,
      }
      const apiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!apiResponse.ok) {
        const rawError = await apiResponse.text()
        let errorDetail: string | null = null
        if (rawError.trim().length > 0) {
          try {
            const parsedError = JSON.parse(rawError) as unknown
            errorDetail = normalizeApiDetail(parsedError)
          } catch {
            errorDetail = rawError.trim().replace(/\s+/g, ' ').slice(0, 180)
          }
        }

        throw new Error(formatApiFailureMessage(apiResponse.status, errorDetail))
      }

      const parsed = (await apiResponse.json()) as unknown
      if (!hasRequiredResponseKeys(parsed)) {
        throw new Error('Invalid response shape')
      }

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      setResponse(parsed as SimulationResponse)
      onSuccessfulResponse(parsed as SimulationResponse)
      setLoadStatus('api')
      setLatestSourceLabel('POST /api/simulate')
      setLastFetchResult('success')
      setErrorMessage(null)
      setRequestErrorKind('none')
      setFrontendRunFinishedAt(new Date().toISOString())
      setFrontendRunElapsedMs(Number((performance.now() - frontendStartedAtMs).toFixed(1)))
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      let message = '実行リクエストに失敗しました。前回の結果を表示しています。'
      if (error instanceof Error) {
        message =
          error.name === 'AbortError'
            ? `${timeoutMs} ms で実行リクエストがタイムアウトしました。前回の結果を表示しています。`
            : error.message
      }

      setLoadStatus('error')
      setLastFetchResult('failed')
      setErrorMessage(message)
      setRequestErrorKind('api')
      setFrontendRunFinishedAt(new Date().toISOString())
      setFrontendRunElapsedMs(Number((performance.now() - frontendStartedAtMs).toFixed(1)))
    } finally {
      window.clearTimeout(timeoutId)
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null
      }
    }
  }

  const loadExampleOnMount = useEffectEvent(() => {
    void loadExampleFromApi()
  })

  useEffect(() => {
    mountedRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      loadExampleOnMount()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const connectionLabel =
    loadStatus === 'loading'
      ? '確認中...'
      : loadStatus === 'api'
        ? '接続済み'
        : loadStatus === 'error'
          ? requestErrorKind === 'validation'
            ? '未送信'
            : 'API は利用できません'
          : '未接続'

  const dataSourceLabel =
    loadStatus === 'loading'
      ? `${activeRequestLabel || 'API リクエスト'} を読み込み中...`
      : loadStatus === 'api'
        ? latestSourceLabel
        : loadStatus === 'error'
          ? requestErrorKind === 'validation'
            ? `前回の結果を保持中（${latestSourceLabel}）`
          : latestSourceLabel === 'Static fixture' ||
            latestSourceLabel === 'Static fixture fallback'
            ? '静的フィクスチャ（フォールバック）'
            : `前回の結果を保持中（${latestSourceLabel}）`
          : '静的フィクスチャ'
  const hasAlerts = response.warnings.length > 0 || response.issues.length > 0
  const circuitGateCount = circuitState.columns.reduce(
    (count, column) => count + column.gates.length,
    0,
  )
  const circuitColumnCount = circuitState.columns.filter((column) => column.gates.length > 0).length
  const costEstimate = estimateSimulationCost({
    logicalQubits: circuitState.logical_qubits,
    timeSteps: simulationParameters.time_steps,
    durationUs: simulationParameters.duration_us,
    circuitGateCount,
    circuitColumnCount,
  })
  return (
    <main className="simulate-page">
      <header className="simulate-page__header">
        <div>
          <div className="simulate-page__eyebrow">QuantaScope</div>
          <h1>シミュレーションワークスペース</h1>
          <p className="simulate-page__lede">
            現在のバックエンドとシミュレーション結果を確認できます。
          </p>
        </div>
        <div className="simulate-page__header-actions">
          <button className="simulate-page__back simulate-page__back--active" type="button">
            シミュレーションラボ
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenCircuitStudio}>
            回路スタジオ
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenStateExplorer}>
            状態エクスプローラー
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenPulseLab}>
            Pulse Lab
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenHelp}>
            ヘルプ / Q&amp;A
          </button>
          <button className="simulate-page__back" type="button" onClick={onBackToHome}>
            ホームに戻る
          </button>
        </div>
      </header>

      <section className="simulate-page__status-grid" aria-label="シミュレーションの状態">
        {statusItems.map((item) => (
          <article className="simulate-page__status-card" key={item.label}>
            <span className="simulate-page__status-label">{item.label}</span>
            <strong className="simulate-page__status-value">{item.value}</strong>
          </article>
        ))}
      </section>

      <div className="simulate-page__core-stack">
        <CircuitSummaryCard
          circuit={circuitState}
          actionLabel="回路スタジオで編集"
          onAction={onOpenCircuitStudio}
        />
        <ParameterPanel
          parameters={response.parameters}
          editableParameters={simulationParameters}
          gateDurationDefaults={gateDurationDefaults}
          validationMessages={parameterErrors}
          gateDurationValidationMessages={gateDurationErrors}
          onEditableParametersChange={handleSimulationParametersChange}
          onGateDurationDefaultsChange={handleGateDurationDefaultsChange}
        />
        <section className="simulate-page__snapshot-controls" aria-labelledby="snapshot-controls-title">
          <div className="simulate-page__snapshot-heading">
            <div>
              <span className="simulate-page__section-eyebrow">サンプリング</span>
              <h2 id="snapshot-controls-title">スナップショットのサンプリング</h2>
            </div>
            <label className="simulate-page__snapshot-toggle">
              <input
                type="checkbox"
                checked={snapshotOptions.enabled}
                onChange={(event) =>
                  setSnapshotOptions((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              有効
            </label>
          </div>
          <p className="simulate-page__snapshot-help">
            初期状態・列の境界・最終状態などのイベントスナップショットを保持しながら、時刻サンプルを指定します。
          </p>
          <div className="simulate-page__snapshot-grid">
            <label>
              均等サンプル数
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={snapshotOptions.uniform_count}
                onChange={(event) =>
                  setSnapshotOptions((current) => ({
                    ...current,
                    uniform_count: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              カスタム時刻 [us]
              <input
                type="text"
                value={customSnapshotTimesInput}
                placeholder="0.5, 1.25"
                onChange={(event) => setCustomSnapshotTimesInput(event.target.value)}
              />
            </label>
          </div>
          <div className="simulate-page__snapshot-checks">
            {([
              ['include_initial', '初期状態'],
              ['include_final', '最終状態'],
              ['include_column_boundaries', '列の境界'],
              ['include_after_circuit', '回路の後'],
            ] as const).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={snapshotOptions[key]}
                  onChange={(event) =>
                    setSnapshotOptions((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          {snapshotOptionsError ? (
            <p className="simulate-page__snapshot-error" role="alert">
              {snapshotOptionsError}
            </p>
          ) : null}
        </section>
        <RunPanel
          run={response.run}
          costEstimate={costEstimate}
          connectionLabel={connectionLabel}
          dataSourceLabel={dataSourceLabel}
          loadStatus={loadStatus}
          errorMessage={errorMessage}
          lastFetchResult={lastFetchResult}
          lastFetchUrl={lastFetchUrl}
          lastFetchStartedAt={lastFetchStartedAt}
          frontendRunStartedAt={frontendRunStartedAt}
          frontendRunFinishedAt={frontendRunFinishedAt}
          frontendRunElapsedMs={frontendRunElapsedMs}
          frontendRunTimeoutMs={frontendRunTimeoutMs}
          evolutionMethod={evolutionMethod}
          onEvolutionMethodChange={setEvolutionMethod}
          onReloadApiExample={() => {
            void loadExampleFromApi()
          }}
          onRunSimulation={() => {
            void runSimulationFromApi()
          }}
        />
        <SimulationSummary summary={response.summary} />
        <MetricTimeline timeline={response.timeline} />
      </div>

      <div className="simulate-page__drawer-stack">
        <ModelInfoPanel
          simulationModelId={response.diagnostics.simulation_model}
          evolutionModeId={response.diagnostics.evolution_mode}
        />
        {hasAlerts ? (
          <ResultDrawer
            eyebrow="アラート"
            title="警告と問題"
            icon="warning"
            description="最新の応答で検出された注意事項です。"
            defaultOpen
          >
            {response.warnings.length > 0 ? (
              <div className="simulate-page__alert-block">
                <div className="simulate-page__alert-heading">警告</div>
                <ul className="simulate-page__warning-list">
                  {response.warnings.map((warning, index) => (
                    <li className="simulate-page__warning-item" key={`${warning}-${index}`}>
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {response.issues.length > 0 ? (
              <div className="simulate-page__alert-block">
                <div className="simulate-page__alert-heading">問題</div>
                <div className="simulate-page__issue-list">
                  {response.issues.map((issue, index) => (
                    <article className="simulate-page__issue-card" key={`${issue.code}-${index}`}>
                      <div className="simulate-page__issue-header">
                        <strong className="simulate-page__issue-code">
                          {issue.level} / {issue.code}
                        </strong>
                        <span className="simulate-page__issue-message">{issue.message}</span>
                      </div>
                      {issue.detail ? (
                        <p className="simulate-page__issue-detail">{issue.detail}</p>
                      ) : null}
                      {issue.suggestion ? (
                        <p className="simulate-page__issue-suggestion">{issue.suggestion}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </ResultDrawer>
        ) : null}
        <OutputProbabilities
          outputProbabilities={response.output_probabilities}
          qubitCount={response.circuit.qubit_count}
        />
        <DensityMatrixSummaryCard
          response={response}
          onOpenStateExplorer={onOpenStateExplorer}
        />
        <DiagnosticsCard diagnostics={response.diagnostics} rates={response.rates} />
      </div>
    </main>
  )
}

function getRunRequestTimeoutMs(
  timeSteps: number,
  logicalQubits: number,
  evolutionMethod: GateAwareEvolutionMethod,
): number {
  const stepBudget = Math.max(
    RUN_REQUEST_MIN_TIMEOUT_MS,
    timeSteps * RUN_REQUEST_TIMEOUT_PER_STEP_MS,
  )
  // 3/4-qubit dense runs need a larger floor while we measure where time is spent.
  const qubitBudget =
    logicalQubits >= 4 ? 60000 : logicalQubits === 3 ? 30000 : RUN_REQUEST_MIN_TIMEOUT_MS
  const evolutionBudget = evolutionMethod === 'explicit_cptp' ? 120000 : 0
  return Math.max(stepBudget, qubitBudget, evolutionBudget)
}
