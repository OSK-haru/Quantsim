import type { CircuitEditorState } from '../types/circuit'
import { DEFAULT_EDITOR_COLUMN_COUNT, ensureCircuitColumnCount } from './circuitEditing'

export function createDefaultBellCircuit(): CircuitEditorState {
  return ensureCircuitColumnCount({
    logical_qubits: 2,
    initial_states: [0, 0],
    columns: [
      {
        step: 0,
        gates: [
          {
            id: 'bell-h-q0-step-0',
            type: 'H',
            targets: [0],
            params: {},
          },
        ],
      },
      {
        step: 1,
        gates: [
          {
            id: 'bell-cnot-q0-q1-step-1',
            type: 'CNOT',
            controls: [0],
            targets: [1],
            params: {},
          },
        ],
      },
    ],
  }, DEFAULT_EDITOR_COLUMN_COUNT)
}
