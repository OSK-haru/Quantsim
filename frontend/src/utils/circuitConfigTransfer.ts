import type {
  CircuitColumn,
  CircuitEditorState,
  CircuitGate,
  GateType,
  InitialQubitState,
} from '../types/circuit'
import { circuitEditorStateToConfig } from './circuitConfig'

export type CircuitConfigGate = {
  type: GateType
  targets: number[]
  controls?: number[]
  params?: Record<string, number | undefined>
}

export type CircuitConfigColumn = {
  step: number
  gates: CircuitConfigGate[]
}

export type CircuitConfig = {
  logical_qubits: number
  initial_states: number[]
  columns: CircuitConfigColumn[]
}

export type CircuitConfigBundle = {
  version: 1
  kind: 'quantscope_circuit_config'
  circuit_config: CircuitConfig
}

const MAX_SUPPORTED_QUBITS = 2
const WRAPPER_KIND = 'quantscope_circuit_config'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function validateGateParams(params: unknown, gateLabel: string) {
  if (params === undefined) {
    return
  }
  if (!isRecord(params)) {
    throw new Error(`Import failed: ${gateLabel} params must be an object.`)
  }

  if ('duration_us' in params && !isFiniteNonNegativeNumber(params.duration_us)) {
    throw new Error(
      `Import failed: ${gateLabel} params.duration_us must be a finite number greater than or equal to 0.`,
    )
  }
}

function validateGateShape(gate: Record<string, unknown>, logicalQubits: number, step: number, index: number) {
  const gateType = gate.type
  if (
    gateType !== 'H' &&
    gateType !== 'X' &&
    gateType !== 'Z' &&
    gateType !== 'CNOT' &&
    gateType !== 'MEASURE'
  ) {
    throw new Error(`Import failed: unsupported gate type at step ${step}.`)
  }

  if (!Array.isArray(gate.targets)) {
    throw new Error(`Import failed: gate targets must be an array at step ${step}.`)
  }

  if (gateType === 'CNOT') {
    if (!Array.isArray(gate.controls)) {
      throw new Error(`Import failed: CNOT controls must be an array at step ${step}.`)
    }
    if (gate.controls.length !== 1) {
      throw new Error('Import failed: CNOT requires exactly one control qubit.')
    }
    if (gate.targets.length !== 1) {
      throw new Error('Import failed: CNOT requires exactly one target qubit.')
    }
  } else {
    if (gate.targets.length !== 1) {
      throw new Error(`Import failed: ${gateType} requires exactly one target qubit.`)
    }
    if (gate.controls !== undefined && (!Array.isArray(gate.controls) || gate.controls.length > 0)) {
      throw new Error(`Import failed: ${gateType} does not accept control qubits.`)
    }
  }

  const targets = gate.targets
  const controls = Array.isArray(gate.controls) ? gate.controls : []

  for (const target of targets) {
    if (!isFiniteInteger(target) || target < 0 || target >= logicalQubits) {
      throw new Error('Import failed: gate target is outside the logical qubit range.')
    }
  }

  for (const control of controls) {
    if (!isFiniteInteger(control) || control < 0 || control >= logicalQubits) {
      throw new Error('Import failed: gate control is outside the logical qubit range.')
    }
  }

  if (gateType === 'CNOT' && controls[0] === targets[0]) {
    throw new Error('Import failed: CNOT control and target must differ.')
  }

  validateGateParams(gate.params, `gate at step ${step}, index ${index}`)
}

function normalizeCircuitConfigShape(value: unknown): CircuitConfig {
  if (!isRecord(value)) {
    throw new Error('Import failed: invalid JSON file.')
  }

  const candidate = value.version !== undefined || value.kind !== undefined || value.circuit_config !== undefined
    ? value.circuit_config
    : value

  if (!isRecord(candidate)) {
    throw new Error('Import failed: invalid circuit_config payload.')
  }

  if (value.circuit_config !== undefined) {
    if (value.version !== 1) {
      throw new Error('Import failed: unsupported circuit file version.')
    }
    if (value.kind !== WRAPPER_KIND) {
      throw new Error('Import failed: unsupported circuit file kind.')
    }
  }

  const logicalQubits = candidate.logical_qubits
  if (!isFiniteInteger(logicalQubits) || logicalQubits < 1 || logicalQubits > 4) {
    throw new Error('Import failed: logical_qubits must be an integer from 1 to 4.')
  }
  if (logicalQubits !== MAX_SUPPORTED_QUBITS) {
    throw new Error('Import failed: current editor supports 2 qubits only.')
  }

  const initialStates = candidate.initial_states
  if (!Array.isArray(initialStates)) {
    throw new Error('Import failed: initial_states must be an array.')
  }
  if (initialStates.length !== logicalQubits) {
    throw new Error('Import failed: initial_states must match logical_qubits.')
  }

  initialStates.forEach((state, index) => {
    if (!isFiniteInteger(state) || (state !== 0 && state !== 1)) {
      throw new Error(
        `Import failed: initial_states[${index}] must be either 0 or 1.`,
      )
    }
  })

  const columns = candidate.columns
  if (!Array.isArray(columns)) {
    throw new Error('Import failed: columns must be an array.')
  }

  const normalizedColumns: CircuitConfigColumn[] = columns.map((column, columnIndex) => {
    if (!isRecord(column)) {
      throw new Error(`Import failed: column ${columnIndex} must be an object.`)
    }
    if (!isFiniteInteger(column.step) || column.step < 0) {
      throw new Error(`Import failed: column ${columnIndex} step must be a non-negative integer.`)
    }
    if (!Array.isArray(column.gates)) {
      throw new Error(`Import failed: column ${columnIndex} gates must be an array.`)
    }

    const step = column.step as number
    const normalizedGates = column.gates.map((gate, gateIndex) => {
      if (!isRecord(gate)) {
        throw new Error(
          `Import failed: gate ${gateIndex} in column ${columnIndex} must be an object.`,
        )
      }

      const gateRecord = gate as Record<string, unknown>
      validateGateShape(gateRecord, logicalQubits, step, gateIndex)

      const targets = gateRecord.targets as number[]
      const controls = Array.isArray(gateRecord.controls)
        ? (gateRecord.controls as number[])
        : []
      const params =
        gateRecord.params === undefined
          ? undefined
          : (gateRecord.params as Record<string, number | undefined>)

      return {
        type: gateRecord.type as GateType,
        targets: [...targets],
        ...(Array.isArray(gateRecord.controls) ? { controls: [...controls] } : {}),
        ...(params === undefined ? {} : { params: { ...params } }),
      }
    })

    return {
      step,
      gates: normalizedGates,
    }
  })

  return {
    logical_qubits: logicalQubits,
    initial_states: initialStates as InitialQubitState[],
    columns: normalizedColumns,
  }
}

function createImportedGateId(
  gateType: GateType,
  step: number,
  gateIndex: number,
  targets: number[],
  controls: number[],
) {
  const targetPart = targets.length > 0 ? targets.join('-') : 'none'
  const controlPart = controls.length > 0 ? controls.join('-') : 'none'
  return `imported-${gateType.toLowerCase()}-s${step}-g${gateIndex}-t${targetPart}-c${controlPart}`
}

export function circuitConfigToEditorState(config: CircuitConfig): CircuitEditorState {
  return {
    logical_qubits: config.logical_qubits,
    initial_states: [...config.initial_states] as InitialQubitState[],
    columns: config.columns.map((column): CircuitColumn => ({
      step: column.step,
      gates: column.gates.map((gate, gateIndex): CircuitGate => ({
        id: createImportedGateId(
          gate.type,
          column.step,
          gateIndex,
          gate.targets,
          gate.controls ?? [],
        ),
        type: gate.type,
        targets: [...gate.targets],
        ...(gate.controls === undefined ? {} : { controls: [...gate.controls] }),
        ...(gate.params === undefined ? {} : { params: { ...gate.params } }),
      })),
    })),
  }
}

export function parseCircuitConfigJson(text: string): CircuitEditorState {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Import failed: invalid JSON file.')
  }

  const config = normalizeCircuitConfigShape(parsed)
  return circuitConfigToEditorState(config)
}

export function exportCircuitConfigBundleJson(circuit: CircuitEditorState) {
  const bundle: CircuitConfigBundle = {
    version: 1,
    kind: WRAPPER_KIND,
    circuit_config: circuitEditorStateToConfig(circuit),
  }

  return JSON.stringify(bundle, null, 2)
}
