import type { CircuitEditorState } from '../types/circuit'

export function circuitEditorStateToConfig(circuit: CircuitEditorState) {
  return {
    logical_qubits: circuit.logical_qubits,
    initial_states: [...circuit.initial_states],
    columns: circuit.columns
      .filter((column) => column.gates.length > 0)
      .map((column) => ({
        step: column.step,
        gates: column.gates.map((gate) => ({
          type: gate.type,
          targets: [...gate.targets],
          controls: [...(gate.controls ?? [])],
          ...(gate.params === undefined ? {} : { params: { ...gate.params } }),
        })),
      })),
  }
}
