import { useEffect, useRef, useState } from 'react'
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
  onSuccessfulResponse: (response: SimulationResponse) => void
}

type SimulateRequestPayload = {
  simulation_backend: 'python_dense'
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
      errors[name] = `${label} must be between 0 and 1.`
    }
  }

  validateZeroToOne('device_quality', 'Device quality')
  validateZeroToOne('fidelity_threshold', 'Fidelity threshold')

  if (!Number.isFinite(parameters.temperature_mk)) {
    errors.temperature_mk = 'Temperature must be a finite number.'
  } else if (parameters.temperature_mk < 0) {
    errors.temperature_mk = 'Temperature must be greater than or equal to 0 mK.'
  }

  if (!Number.isFinite(parameters.flux_noise_phi0)) {
    errors.flux_noise_phi0 = 'Flux noise must be a finite number.'
  } else if (parameters.flux_noise_phi0 < 0) {
    errors.flux_noise_phi0 = 'Flux noise must be greater than or equal to 0.'
  }

  if (!Number.isFinite(parameters.qubit_frequency_ghz)) {
    errors.qubit_frequency_ghz = 'Qubit frequency must be a finite number.'
  } else if (parameters.qubit_frequency_ghz <= 0) {
    errors.qubit_frequency_ghz = 'Qubit frequency must be greater than 0 GHz.'
  }

  if (!Number.isFinite(parameters.t1_max_us)) {
    errors.t1_max_us = 'Max T1 must be a finite number.'
  } else if (parameters.t1_max_us <= 0) {
    errors.t1_max_us = 'Max T1 must be greater than 0 us.'
  }

  if (!Number.isFinite(parameters.tphi_max_us)) {
    errors.tphi_max_us = 'Max Tphi must be a finite number.'
  } else if (parameters.tphi_max_us <= 0) {
    errors.tphi_max_us = 'Max Tphi must be greater than 0 us.'
  }

  if (!Number.isFinite(parameters.duration_us)) {
    errors.duration_us = 'Duration must be a finite number.'
  } else if (parameters.duration_us <= 0) {
    errors.duration_us = 'Duration must be greater than 0.'
  }

  if (!Number.isFinite(parameters.time_steps)) {
    errors.time_steps = 'Time steps must be a finite number.'
  } else if (!Number.isInteger(parameters.time_steps) || parameters.time_steps < 2) {
    errors.time_steps = 'Time steps must be an integer greater than or equal to 2.'
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
      errors[name] = `${label} must be greater than or equal to 0 us.`
    }
  }

  const validatePositive = (name: keyof GateDurationDefaults, label: string) => {
    const value = gateDurations[name]
    if (!Number.isFinite(value) || value <= 0) {
      errors[name] = `${label} must be greater than 0 us.`
    }
  }

  validatePositive('H', 'H duration')
  validatePositive('X', 'X duration')
  validateNonNegative('Z', 'Z duration')
  validatePositive('CNOT', 'CNOT duration')
  validateNonNegative('MEASURE', 'Measure duration')

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
    return { times: [], error: 'Use at most 100 custom snapshot times.' }
  }
  const times = parts.map(Number)
  if (times.some((time) => !Number.isFinite(time) || time < 0)) {
    return { times: [], error: 'Custom times must be finite, non-negative numbers.' }
  }
  return { times, error: null }
}

function validateSnapshotOptions(
  options: SnapshotOptions,
  durationUs: number,
): string | null {
  if (!Number.isInteger(options.uniform_count) || options.uniform_count < 0 || options.uniform_count > 100) {
    return 'Uniform count must be an integer from 0 to 100.'
  }
  if (options.uniform_count === 1) {
    return 'Uniform count 1 is ambiguous; use 0 or at least 2.'
  }
  if (options.custom_times_us.some((time) => time > durationUs)) {
    return 'Custom snapshot times must not exceed total simulation time.'
  }
  return null
}

function formatApiFailureMessage(status: number, detail: string | null) {
  if (status === 422) {
    const detailSuffix = detail ? `: ${detail}` : ''
    return `HTTP 422: request validation failed${detailSuffix}. Keeping the previous result visible.`
  }

  const detailSuffix = detail ? `: ${detail}` : ''
  return `HTTP ${status}${detailSuffix}. Keeping the previous result visible.`
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

      let message = 'Run request failed. Keeping the previous result visible.'
      if (error instanceof Error) {
        message =
          error.name === 'AbortError'
            ? `Run request timed out after ${timeoutMs} ms. Keeping the previous result visible.`
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

  useEffect(() => {
    mountedRef.current = true
    void loadExampleFromApi()

    return () => {
      mountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const connectionLabel =
    loadStatus === 'loading'
      ? 'Checking...'
      : loadStatus === 'api'
        ? 'Connected'
        : loadStatus === 'error'
          ? requestErrorKind === 'validation'
            ? 'Not sent'
            : 'API unavailable'
          : 'Not connected'

  const dataSourceLabel =
    loadStatus === 'loading'
      ? `Loading ${activeRequestLabel || 'API request'}...`
      : loadStatus === 'api'
        ? latestSourceLabel
        : loadStatus === 'error'
          ? requestErrorKind === 'validation'
            ? `Previous result retained (${latestSourceLabel})`
          : latestSourceLabel === 'Static fixture' ||
            latestSourceLabel === 'Static fixture fallback'
            ? 'Static fixture fallback'
            : `Previous result retained (${latestSourceLabel})`
          : 'Static fixture'
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
          <h1>Simulation workspace</h1>
          <p className="simulate-page__lede">
            Static mock data for the current backend snapshot and simulation result.
          </p>
        </div>
        <div className="simulate-page__header-actions">
          <button className="simulate-page__back simulate-page__back--active" type="button">
            Simulation Lab
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenCircuitStudio}>
            Circuit Studio
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenStateExplorer}>
            State Explorer
          </button>
          <button className="simulate-page__back" type="button" onClick={onOpenHelp}>
            Help / Q&amp;A
          </button>
          <button className="simulate-page__back" type="button" onClick={onBackToHome}>
            Back to home
          </button>
        </div>
      </header>

      <section className="simulate-page__status-grid" aria-label="Simulation status">
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
          actionLabel="Edit in Circuit Studio"
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
              <span className="simulate-page__section-eyebrow">Sampling</span>
              <h2 id="snapshot-controls-title">Snapshot sampling</h2>
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
              Enabled
            </label>
          </div>
          <p className="simulate-page__snapshot-help">
            Choose bounded time samples while keeping event snapshots such as initial, column boundaries, and final.
          </p>
          <div className="simulate-page__snapshot-grid">
            <label>
              Uniform count
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
              Custom times [us]
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
              ['include_initial', 'Initial'],
              ['include_final', 'Final'],
              ['include_column_boundaries', 'Column boundaries'],
              ['include_after_circuit', 'After circuit'],
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
            eyebrow="Alerts"
            title="Warnings and issues"
            icon="warning"
            description="Non-fatal notes surfaced by the latest response."
            defaultOpen
          >
            {response.warnings.length > 0 ? (
              <div className="simulate-page__alert-block">
                <div className="simulate-page__alert-heading">Warnings</div>
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
                <div className="simulate-page__alert-heading">Issues</div>
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

function getRunRequestTimeoutMs(timeSteps: number, logicalQubits: number): number {
  const stepBudget = Math.max(
    RUN_REQUEST_MIN_TIMEOUT_MS,
    timeSteps * RUN_REQUEST_TIMEOUT_PER_STEP_MS,
  )
  // 3/4-qubit dense runs need a larger floor while we measure where time is spent.
  const qubitBudget =
    logicalQubits >= 4 ? 60000 : logicalQubits === 3 ? 30000 : RUN_REQUEST_MIN_TIMEOUT_MS
  return Math.max(stepBudget, qubitBudget)
}
