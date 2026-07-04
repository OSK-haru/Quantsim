export type CircuitGate = {
  label: string
  type: string
  qubits: number[]
  kind: 'single' | 'control' | 'target' | 'measure' | 'idle'
}

export type CircuitColumn = {
  id: string
  step: number
  gates: CircuitGate[]
  duration_us: number | null
}

export type CircuitPreviewData = {
  qubit_count: number
  columns: CircuitColumn[]
}
