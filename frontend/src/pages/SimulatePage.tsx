import { useEffect, useRef, useState } from 'react'
import './SimulatePage.css'
import { CircuitPreview } from '../components/CircuitPreview'
import { CircuitConfigPreview } from '../components/CircuitConfigPreview'
import { DiagnosticsCard, type SimulationDiagnostics } from '../components/DiagnosticsCard'
import { GatePalette } from '../components/GatePalette'
import { MetricTimeline } from '../components/MetricTimeline'
import { ModelInfoPanel } from '../components/ModelInfoPanel'
import { OutputProbabilities } from '../components/OutputProbabilities'
import { ParameterPanel } from '../components/ParameterPanel'
import { RunPanel } from '../components/RunPanel'
import { ResultDrawer } from '../components/ResultDrawer'
import { SimulationSummary } from '../components/SimulationSummary'
import { uiResponseExample } from '../mock/uiResponseExample'
import { createDefaultBellCircuit } from '../utils/circuitDefaults'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { parseCircuitConfigJson } from '../utils/circuitConfigTransfer'
import {
  clearCircuit,
  EDITOR_COLUMN_COUNT,
  getGateIdAtSlot,
  isCircuitEmpty,
  moveSingleGateInCircuit,
  moveCnotGateInCircuit,
  placeCnotGateFromDropInCircuit,
  placeCnotGateInCircuit,
  placeSingleGateInCircuit,
  removeGateById,
} from '../utils/circuitEditing'
import {
  canRedo,
  canUndo,
  commitCircuitChange,
  createCircuitHistory,
  redoCircuitChange,
  undoCircuitChange,
  type CircuitHistoryState,
} from '../utils/circuitHistory'
import type {
  GateDurationDefaultErrors,
  GateDurationDefaults,
  SimulateRequestParameterErrors,
  SimulateRequestParameters,
  SimulationLoadStatus,
  SimulationResponse,
  SimulationSummaryData,
} from '../types/simulation'
import type {
  CircuitEditorState,
  DragGatePayload,
  GateType,
} from '../types/circuit'

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
  simulation_backend: 'python_dense'
  input_mode: 'physical'
  circuit_config: ReturnType<typeof circuitEditorStateToConfig>
  gate_duration_defaults: GateDurationDefaults
  parameters: SimulateRequestParameters
}

type RequestErrorKind = 'none' | 'api' | 'validation'
type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
}
type ActiveDragSession = {
  source: 'palette' | 'circuit'
  gateId?: string
  gateType: GateType
  committed: boolean
}
const API_EXAMPLE_TIMEOUT_MS = 10000
const RUN_REQUEST_MIN_TIMEOUT_MS = 15000
const RUN_REQUEST_TIMEOUT_PER_STEP_MS = 25
const DEFAULT_EDITOR_HINT = 'Choose a gate, then click a circuit slot.'

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

const initialGateDurationDefaults: GateDurationDefaults = {
  H: 0.02,
  X: 0.02,
  Z: 0.0,
  CNOT: 0.2,
  MEASURE: 0.0,
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

export function SimulatePage({
  diagnostics: _diagnostics,
  result: _result,
  statusItems,
  onBackToHome,
  onOpenHelp,
}: SimulatePageProps) {
  const [response, setResponse] = useState<SimulationResponse>(uiResponseExample)
  const [circuitHistory, setCircuitHistory] = useState<CircuitHistoryState>(() =>
    createCircuitHistory(createDefaultBellCircuit()),
  )
  const [loadStatus, setLoadStatus] = useState<SimulationLoadStatus>('fixture')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastFetchUrl, setLastFetchUrl] = useState<string>('')
  const [lastFetchStartedAt, setLastFetchStartedAt] = useState<string>('')
  const [lastFetchResult, setLastFetchResult] = useState<string>('idle')
  const [latestSourceLabel, setLatestSourceLabel] = useState<string>('Static fixture')
  const [activeRequestLabel, setActiveRequestLabel] = useState<string>('')
  const [simulationParameters, setSimulationParameters] =
    useState<SimulateRequestParameters>(initialSimulationParameters)
  const [gateDurationDefaults, setGateDurationDefaults] =
    useState<GateDurationDefaults>(initialGateDurationDefaults)
  const [selectedGateType, setSelectedGateType] = useState<GateType | null>(null)
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null)
  const [dragPayload, setDragPayload] = useState<DragGatePayload | null>(null)
  const [pendingCnotControl, setPendingCnotControl] =
    useState<PendingCnotControl | null>(null)
  const [editorHint, setEditorHint] = useState<string>(DEFAULT_EDITOR_HINT)
  const [parameterErrors, setParameterErrors] =
    useState<SimulateRequestParameterErrors>({})
  const [gateDurationErrors, setGateDurationErrors] =
    useState<GateDurationDefaultErrors>({})
  const [requestErrorKind, setRequestErrorKind] = useState<RequestErrorKind>('none')
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const gateIdCounterRef = useRef(0)
  const activeDragRef = useRef<ActiveDragSession | null>(null)
  const mountedRef = useRef(true)
  const circuitState = circuitHistory.present

  function finalizeCircuitEdit(nextCircuit: CircuitEditorState) {
    setCircuitHistory((currentHistory) =>
      commitCircuitChange(currentHistory, nextCircuit),
    )
    setSelectedGateId(null)
    setPendingCnotControl(null)
  }

  function handleSelectGateType(gateType: GateType | null) {
    setSelectedGateType(gateType)
    setSelectedGateId(null)
    setPendingCnotControl(null)

    if (gateType === null) {
      setEditorHint(DEFAULT_EDITOR_HINT)
      return
    }

    if (gateType === 'CNOT') {
      setEditorHint('CNOT: click control, then target in the same column.')
      return
    }

    setEditorHint(`Selected gate: ${gateType}. Click a circuit slot.`)
  }

  function handleGateSelect(gateId: string | null) {
    setSelectedGateId(gateId)
    setPendingCnotControl(null)
    setEditorHint(
      gateId ? 'Selected gate. Delete it or choose another slot.' : DEFAULT_EDITOR_HINT,
    )
  }

  function handleResetCircuitToBell() {
    finalizeCircuitEdit(createDefaultBellCircuit())
    setSelectedGateType(null)
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(DEFAULT_EDITOR_HINT)
    gateIdCounterRef.current = 0
  }

  function handleCircuitSlotClick(columnIndex: number, qubitIndex: number) {
    if (!selectedGateType) {
      const gateId = getGateIdAtSlot(circuitState, columnIndex, qubitIndex)
      setSelectedGateId(gateId)
      setEditorHint(
        gateId ? 'Selected gate. Delete it or choose another slot.' : DEFAULT_EDITOR_HINT,
      )
      return
    }

    const gateType = selectedGateType

    if (gateType === 'CNOT') {
      if (pendingCnotControl === null) {
        setPendingCnotControl({ columnIndex, qubitIndex })
        setEditorHint(`CNOT: choose target in column ${columnIndex + 1}.`)
        return
      }

      if (pendingCnotControl.columnIndex !== columnIndex) {
        setPendingCnotControl({ columnIndex, qubitIndex })
        setEditorHint(`CNOT: choose target in column ${columnIndex + 1}.`)
        return
      }

      if (pendingCnotControl.qubitIndex === qubitIndex) {
        setEditorHint('CNOT: control and target must differ.')
        return
      }

      finalizeCircuitEdit(
        placeCnotGateInCircuit(
          circuitState,
          EDITOR_COLUMN_COUNT,
          columnIndex,
          pendingCnotControl.qubitIndex,
          qubitIndex,
          gateDurationDefaults.CNOT,
          `cnot-${columnIndex}-${pendingCnotControl.qubitIndex}-${qubitIndex}-${gateIdCounterRef.current++}`,
        ),
      )
      setEditorHint('CNOT placed. Click control, then target in the same column.')
      return
    }

    finalizeCircuitEdit(
      placeSingleGateInCircuit(
        circuitState,
        EDITOR_COLUMN_COUNT,
        columnIndex,
        qubitIndex,
        gateType,
        gateDurationDefaults[gateType],
        `${gateType.toLowerCase()}-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current++}`,
      ),
    )
    setEditorHint(`Selected gate: ${gateType}. Click a circuit slot.`)
  }

  function handleDeleteSelectedGate() {
    if (!selectedGateId) {
      return
    }

    finalizeCircuitEdit(removeGateById(circuitState, selectedGateId))
    setEditorHint('Selected gate deleted.')
  }

  function handleClearCircuit() {
    finalizeCircuitEdit(clearCircuit(circuitState, EDITOR_COLUMN_COUNT))
    setEditorHint('Circuit cleared.')
  }

  function handleUndoCircuit() {
    setCircuitHistory((currentHistory) => undoCircuitChange(currentHistory))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint('Undid last circuit edit.')
  }

  function handleRedoCircuit() {
    setCircuitHistory((currentHistory) => redoCircuitChange(currentHistory))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint('Redid circuit edit.')
  }

  function handlePaletteGateDragStart(gateType: GateType) {
    activeDragRef.current = {
      source: 'palette',
      gateType,
      committed: false,
    }
    setDragPayload({ source: 'palette', gateType })
    setSelectedGateType(null)
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(`Dragging ${gateType}. Drop it onto a circuit slot.`)
  }

  function handleCircuitGateDragStart(
    gateId: string,
    gateType: GateType,
    fromColumn: number,
    fromQubit: number,
  ) {
    activeDragRef.current = {
      source: 'circuit',
      gateId,
      gateType,
      committed: false,
    }
    setDragPayload({
      source: 'circuit',
      gateId,
      gateType,
      fromColumn,
      fromQubit,
    })
    setSelectedGateType(null)
    setSelectedGateId(gateId)
    setPendingCnotControl(null)
    setEditorHint(`Moving ${gateType}. Drop it onto a circuit slot.`)
  }

  function handleGateDragEnd() {
    const dragSession = activeDragRef.current
    if (
      dragSession?.source === 'circuit' &&
      dragSession.committed === false &&
      dragSession.gateId
    ) {
      finalizeCircuitEdit(removeGateById(circuitState, dragSession.gateId))
      setEditorHint(`${dragSession.gateType} deleted by drag-out.`)
    }

    activeDragRef.current = null
    setDragPayload(null)
  }

  function handleCircuitSlotDrop(columnIndex: number, qubitIndex: number) {
    if (!dragPayload) {
      return
    }

    if (dragPayload.source === 'palette') {
      const nextCircuit =
        dragPayload.gateType === 'CNOT'
          ? placeCnotGateFromDropInCircuit(
              circuitState,
              EDITOR_COLUMN_COUNT,
              columnIndex,
              qubitIndex,
              gateDurationDefaults.CNOT,
              `cnot-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current++}`,
            )
          : placeSingleGateInCircuit(
              circuitState,
              EDITOR_COLUMN_COUNT,
              columnIndex,
              qubitIndex,
              dragPayload.gateType,
              gateDurationDefaults[dragPayload.gateType],
              `${dragPayload.gateType.toLowerCase()}-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current++}`,
            )

      if (activeDragRef.current) {
        activeDragRef.current.committed = true
      }

      finalizeCircuitEdit(nextCircuit)
      setEditorHint(`${dragPayload.gateType} placed by drag-and-drop.`)
      setDragPayload(null)
      return
    }

    if (
      dragPayload.fromColumn === columnIndex &&
      dragPayload.fromQubit === qubitIndex
    ) {
      if (activeDragRef.current) {
        activeDragRef.current.committed = true
      }
      setEditorHint(`${dragPayload.gateType} stayed in place.`)
      setDragPayload(null)
      return
    }

    const nextCircuit =
      dragPayload.gateType === 'CNOT'
        ? moveCnotGateInCircuit(
            circuitState,
            EDITOR_COLUMN_COUNT,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
          )
        : moveSingleGateInCircuit(
            circuitState,
            EDITOR_COLUMN_COUNT,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
          )

    if (activeDragRef.current) {
      activeDragRef.current.committed = true
    }

    finalizeCircuitEdit(nextCircuit)
    setEditorHint(
      nextCircuit === circuitState
        ? `${dragPayload.gateType} stayed in place.`
        : `${dragPayload.gateType} moved by drag-and-drop.`,
    )
    setDragPayload(null)
  }

  async function handleImportCircuitConfig(file: File) {
    const text = await file.text()
    const importedCircuit = parseCircuitConfigJson(text)

    finalizeCircuitEdit(importedCircuit)
    setSelectedGateType(null)
    setEditorHint('Imported circuit loaded.')

    return 'Imported circuit loaded.'
  }

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
    setGateDurationDefaults(nextGateDurations)
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
    const gateDurationValidation = validateGateDurationDefaults(gateDurationDefaults)
    setParameterErrors(validation.errors)
    setGateDurationErrors(gateDurationValidation.errors)
    const firstValidationMessage =
      validation.firstMessage ?? gateDurationValidation.firstMessage
    if (firstValidationMessage !== null) {
      setLoadStatus('error')
      setActiveRequestLabel('POST /api/simulate')
      setLastFetchUrl('not requested - validation failed')
      setLastFetchStartedAt(new Date().toISOString())
      setLastFetchResult('validation failed')
      setRequestErrorKind('validation')
      setErrorMessage(firstValidationMessage)
      return
    }

    abortControllerRef.current?.abort()

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    const controller = new AbortController()
    abortControllerRef.current = controller
    const url = `/api/simulate?ts=${Date.now()}`
    const startedAt = new Date().toISOString()
    const timeoutMs = Math.max(
      RUN_REQUEST_MIN_TIMEOUT_MS,
      simulationParameters.time_steps * RUN_REQUEST_TIMEOUT_PER_STEP_MS,
    )
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
        circuit_config: circuitEditorStateToConfig(circuitState),
        gate_duration_defaults: gateDurationDefaults,
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

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase()
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedGateId !== null) {
        event.preventDefault()
        handleDeleteSelectedGate()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [selectedGateId, handleDeleteSelectedGate])

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
  const canUndoCircuit = canUndo(circuitHistory)
  const canRedoCircuit = canRedo(circuitHistory)
  const canDeleteSelected = selectedGateId !== null
  const canClearCircuit = !isCircuitEmpty(circuitState)

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

      <div className="simulate-page__core-stack">
        <GatePalette
          selectedGateType={selectedGateType}
          onSelectGateType={handleSelectGateType}
          onResetToBell={handleResetCircuitToBell}
          statusText={editorHint}
          canUndo={canUndoCircuit}
          canRedo={canRedoCircuit}
          canDeleteSelected={canDeleteSelected}
          canClearCircuit={canClearCircuit}
          onUndo={handleUndoCircuit}
          onRedo={handleRedoCircuit}
          onDeleteSelected={handleDeleteSelectedGate}
          onClearCircuit={handleClearCircuit}
          onGateDragStart={handlePaletteGateDragStart}
          onGateDragEnd={handleGateDragEnd}
        />
        <CircuitPreview
          circuit={circuitState}
          gateDurationDefaults={gateDurationDefaults}
          columnCount={EDITOR_COLUMN_COUNT}
          selectedGateType={selectedGateType}
          selectedGateId={selectedGateId}
          pendingCnotControl={pendingCnotControl}
          dragPayload={dragPayload}
          onSlotClick={handleCircuitSlotClick}
          onGateSelect={handleGateSelect}
          onCircuitGateDragStart={handleCircuitGateDragStart}
          onDragEnd={handleGateDragEnd}
          onSlotDrop={handleCircuitSlotDrop}
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
        <SimulationSummary summary={response.summary} />
        <MetricTimeline timeline={response.timeline} />
      </div>

      <div className="simulate-page__drawer-stack">
        <ModelInfoPanel
          simulationModelId={response.diagnostics.simulation_model}
          evolutionModeId={response.diagnostics.evolution_mode}
        />
        <CircuitConfigPreview
          circuit={circuitState}
          onImportCircuitConfig={handleImportCircuitConfig}
        />
        {hasAlerts ? (
          <ResultDrawer
            eyebrow="Alerts"
            title="Warnings and issues"
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
        <OutputProbabilities outputProbabilities={response.output_probabilities} />
        <DiagnosticsCard diagnostics={response.diagnostics} />
      </div>
    </main>
  )
}
