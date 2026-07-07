export type CircuitPreviewGate = {
  label: string
  type: string
  qubits: number[]
  kind: 'single' | 'control' | 'target' | 'measure' | 'idle'
}

export type CircuitPreviewColumn = {
  id: string
  step: number
  gates: CircuitPreviewGate[]
  duration_us: number | null
}

export type CircuitPreviewData = {
  qubit_count: number
  columns: CircuitPreviewColumn[]
}

export type GateType = 'H' | 'X' | 'Z' | 'CNOT' | 'MEASURE'

export type SingleQubitGateType = Exclude<GateType, 'CNOT'>

export type InitialQubitState = 0 | 1

export type CircuitGateParams = {
  duration_us?: number
  [key: string]: number | undefined
}

export type CircuitGate = {
  id: string
  type: GateType
  targets: number[]
  controls?: number[]
  params?: CircuitGateParams
}

export type CircuitColumn = {
  step: number
  gates: CircuitGate[]
}

export type CircuitEditorState = {
  logical_qubits: number
  initial_states: InitialQubitState[]
  columns: CircuitColumn[]
}

export type DragGatePayload =
  | {
      source: 'palette'
      gateType: GateType
    }
  | {
      source: 'circuit'
      gateId: string
      gateType: GateType
      fromColumn: number
      fromQubit: number
    }
