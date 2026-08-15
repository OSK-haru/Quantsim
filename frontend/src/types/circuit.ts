export type CircuitPreviewGate = {
  label: string
  type: string
  qubits: number[]
  kind: 'single' | 'control' | 'target' | 'measure' | 'idle'
  /** Position in an ordered register (QFT), 0 being the most significant bit. */
  register_position?: number
  /** Bit weight k held by this qubit in a QFT register (it carries 2**k). */
  register_bit_weight?: number
  classical_targets?: number[]
  condition?: { bit: number; value: 0 | 1 } | null
  conditions?: Array<{ bit: number; value: 0 | 1 }>
}

export type CircuitPreviewColumn = {
  id: string
  step: number
  gates: CircuitPreviewGate[]
  duration_us: number | null
}

export type CircuitPreviewData = {
  qubit_count: number
  classical_bit_count?: number
  columns: CircuitPreviewColumn[]
}

export type GateType = 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'RX' | 'RY' | 'RZ' | 'CNOT' | 'CZ' | 'CP' | 'CCX' | 'SWAP' | 'QFT' | 'ORACLE' | 'MEASURE' | 'MESSAGE' | 'RECEIVED'
export type AnnotationGateType = Extract<GateType, 'MESSAGE' | 'RECEIVED'>

export type ControlledGateType = Extract<GateType, 'CNOT' | 'CZ' | 'CP'>
export type PairGateType = Extract<GateType, 'SWAP'>
export type MultiControlledGateType = Extract<GateType, 'CCX'>
/** Gates whose operands are an ordered register of arbitrary width. */
export type RegisterGateType = Extract<GateType, 'QFT' | 'ORACLE'>
export type TwoQubitGateType = ControlledGateType | PairGateType
export type MultiQubitGateType = TwoQubitGateType | MultiControlledGateType | RegisterGateType
export type SingleQubitGateType = Exclude<GateType, MultiQubitGateType>

export type InitialQubitState = 0 | 1 | '+' | '-'

export type CircuitGateParams = {
  duration_us?: number
  /** 0 draws and executes an open control; omitted/1 is a closed control. */
  control_value?: 0 | 1
  /** Bit pattern required by a multi-control X, in controls-array order. */
  control_state?: number
  [key: string]: number | undefined
}

export type CircuitGate = {
  id: string
  type: GateType
  targets: number[]
  controls?: number[]
  params?: CircuitGateParams
  classical_targets?: number[]
  condition?: { bit: number; value: 0 | 1 } | null
  conditions?: Array<{ bit: number; value: 0 | 1 }>
  source_id?: string | null
}

export type CircuitColumn = {
  step: number
  gates: CircuitGate[]
}

export type CircuitEditorState = {
  logical_qubits: number
  classical_bits?: number
  initial_states: InitialQubitState[]
  columns: CircuitColumn[]
}

export type DragGatePayload =
  | {
      source: 'palette'
      gateType: GateType
      /** Palette-only ● / ○ marker; it becomes part of CNOT after placement. */
      controlValue?: 0 | 1
    }
  | {
      source: 'circuit'
      gateId: string
      gateType: GateType
      fromColumn: number
      fromQubit: number
    }
