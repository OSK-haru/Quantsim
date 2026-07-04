import { useEffect, useRef, useState } from 'react'
import './SimulatePage.css'
import { CircuitPreview } from '../components/CircuitPreview'
import { DiagnosticsCard, type SimulationDiagnostics } from '../components/DiagnosticsCard'
import { MetricTimeline } from '../components/MetricTimeline'
import { ParameterPanel } from '../components/ParameterPanel'
import { RunPanel } from '../components/RunPanel'
import { SimulationSummary } from '../components/SimulationSummary'
import { uiResponseExample } from '../mock/uiResponseExample'
import type {
  SimulateRequestParameterErrors,
  SimulateRequestParameters,
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
  onBackToHome: () => void
  onOpenHelp: () => void
}

type SimulateRequestPayload = {
  circuit_preset: 'bell'
  simulation_backend: 'python_dense'
  parameters: SimulateRequestParameters
}

type RequestErrorKind = 'none' | 'api' | 'validation'

const initialSimulationParameters: SimulateRequestParameters = {
  normalized_temperature: 0.02,
  normalized_magnetic_field: 0.02,
  noise_level: 0.2,
  duration_us: 2.0,
  time_steps: 11,
  fidelity_threshold: 0.9,
}

const requiredResponseKeys: Array<keyof SimulationResponse> = [
  'circuit',
  'parameters',
  'diagnostics',
  'summary',
  'timeline',
  'output_probabilities',
  'run',
  'warnings',
  'issues',
]

function hasRequiredResponseKeys(value: unknown): value is SimulationResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return requiredResponseKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(candidate, key),
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
      | 'normalized_temperature'
      | 'normalized_magnetic_field'
      | 'noise_level'
      | 'fidelity_threshold'
    >,
    label: string,
  ) => {
    const value = parameters[name]
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors[name] = `${label} must be between 0 and 1.`
    }
  }

  validateZeroToOne('normalized_temperature', 'Normalized temperature')
  validateZeroToOne('normalized_magnetic_field', 'Normalized magnetic field')
  validateZeroToOne('noise_level', 'Noise level')
  validateZeroToOne('fidelity_threshold', 'Fidelity threshold')

  if (!Number.isFinite(parameters.duration_us)) {
    errors.duration_us = 'Duration must be a finite number.'
  } else if (parameters.duration_us <= 0) {
    errors.duration_us = 'Duration must be greater than 0.'
  } else if (parameters.duration_us < 0.1 || parameters.duration_us > 20) {
    errors.duration_us = 'Duration must be between 0.1 and 20 us.'
  }

  if (!Number.isFinite(parameters.time_steps)) {
    errors.time_steps = 'Time steps must be a finite number.'
  } else if (!Number.isInteger(parameters.time_steps) || parameters.time_steps < 2) {
    errors.time_steps = 'Time steps must be an integer greater than or equal to 2.'
  }

  const firstMessage = Object.values(errors)[0] ?? null
  return { errors, firstMessage }
}

export function SimulatePage({
  diagnostics: _diagnostics,
  result: _result,
  statusItems,
  onBackToHome,
  onOpenHelp,
}: SimulatePageProps) {
  const [response, setResponse] = useState<SimulationResponse>(uiResponseExample)
  const [loadStatus, setLoadStatus] = useState<SimulationLoadStatus>('fixture')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastFetchUrl, setLastFetchUrl] = useState<string>('')
  const [lastFetchStartedAt, setLastFetchStartedAt] = useState<string>('')
  const [lastFetchResult, setLastFetchResult] = useState<string>('idle')
  const [latestSourceLabel, setLatestSourceLabel] = useState<string>('Static fixture')
  const [activeRequestLabel, setActiveRequestLabel] = useState<string>('')
  const [simulationParameters, setSimulationParameters] =
    useState<SimulateRequestParameters>(initialSimulationParameters)
  const [parameterErrors, setParameterErrors] =
    useState<SimulateRequestParameterErrors>({})
  const [requestErrorKind, setRequestErrorKind] = useState<RequestErrorKind>('none')
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  function handleSimulationParametersChange(nextParameters: SimulateRequestParameters) {
    const validation = validateSimulationParameters(nextParameters)
    setSimulationParameters(nextParameters)
    setParameterErrors(validation.errors)

    if (requestErrorKind === 'validation' && validation.firstMessage === null) {
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
    const timeoutId = window.setTimeout(() => controller.abort(), 3000)

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
    const validation = validateSimulationParameters(simulationParameters)
    setParameterErrors(validation.errors)
    if (validation.firstMessage !== null) {
      setLoadStatus('error')
      setActiveRequestLabel('POST /api/simulate')
      setLastFetchUrl('not requested - validation failed')
      setLastFetchStartedAt(new Date().toISOString())
      setLastFetchResult('validation failed')
      setRequestErrorKind('validation')
      setErrorMessage(validation.firstMessage)
      return
    }

    abortControllerRef.current?.abort()

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const controller = new AbortController()
    abortControllerRef.current = controller
    const url = `/api/simulate?ts=${Date.now()}`
    const startedAt = new Date().toISOString()
    const timeoutId = window.setTimeout(() => controller.abort(), 3000)

    setLoadStatus('loading')
    setActiveRequestLabel('POST /api/simulate')
    setLastFetchUrl(url)
    setLastFetchStartedAt(startedAt)
    setLastFetchResult('pending')
    setErrorMessage(null)
    setRequestErrorKind('none')

    try {
      const payload: SimulateRequestPayload = {
        circuit_preset: 'bell',
        simulation_backend: 'python_dense',
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
      setLoadStatus('api')
      setLatestSourceLabel('POST /api/simulate')
      setLastFetchResult('success')
      setErrorMessage(null)
      setRequestErrorKind('none')
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return
      }

      let message = 'Run request failed. Keeping the previous result visible.'
      if (error instanceof Error) {
        message =
          error.name === 'AbortError'
            ? 'Run request timed out. Keeping the previous result visible.'
            : `${error.message}. Keeping the previous result visible.`
      }

      setLoadStatus('error')
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

      <div className="simulate-page__stack">
        <CircuitPreview circuit={response.circuit} />
        <ParameterPanel
          parameters={response.parameters}
          editableParameters={simulationParameters}
          validationMessages={parameterErrors}
          onEditableParametersChange={handleSimulationParametersChange}
        />
        <RunPanel
          run={response.run}
          connectionLabel={connectionLabel}
          dataSourceLabel={dataSourceLabel}
          loadStatus={loadStatus}
          errorMessage={errorMessage}
          lastFetchResult={lastFetchResult}
          lastFetchUrl={lastFetchUrl}
          lastFetchStartedAt={lastFetchStartedAt}
          onReloadApiExample={() => {
            void loadExampleFromApi()
          }}
          onRunSimulation={() => {
            void runSimulationFromApi()
          }}
        />
        <DiagnosticsCard diagnostics={response.diagnostics} />
        <MetricTimeline timeline={response.timeline} />
        <SimulationSummary
          summary={response.summary}
          outputProbabilities={response.output_probabilities}
        />
      </div>
    </main>
  )
}
