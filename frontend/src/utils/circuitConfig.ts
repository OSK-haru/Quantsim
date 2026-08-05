import type { CircuitEditorState } from '../types/circuit'
import { isAnnotationGateType } from './circuitEditing'

export type CircuitConfig = ReturnType<typeof circuitEditorStateToConfig>

export function circuitConfigSignature(circuit: CircuitConfig): string {
  return JSON.stringify({
    logical_qubits: circuit.logical_qubits,
    classical_bits: circuit.classical_bits ?? 0,
    initial_states: [...circuit.initial_states],
    columns: circuit.columns.map((column) => ({
      step: column.step,
      gates: column.gates.map((gate) => ({
        type: gate.type,
        targets: [...gate.targets],
        controls: [...gate.controls],
        params: Object.fromEntries(
          Object.entries(gate.params ?? {}).sort(([left], [right]) => left.localeCompare(right)),
        ),
        conditions: [...(gate.conditions ?? [])],
      })),
    })),
  })
}

export function circuitEditorStateToConfig(circuit: CircuitEditorState) {
  const rawAnnotations = circuit.columns.flatMap((column) => column.gates
    .filter((gate) => isAnnotationGateType(gate.type))
    .map((gate) => ({
      kind: gate.type as 'MESSAGE' | 'RECEIVED',
      id: gate.id,
      column_index: column.step,
      qubits: [...gate.targets],
      ...(gate.source_id === undefined ? {} : { source_id: gate.source_id }),
    })))
  const annotations = rawAnnotations.map((annotation) => {
    if (annotation.kind !== 'RECEIVED' || annotation.source_id) return annotation
    const source = rawAnnotations
      .filter((candidate) => candidate.kind === 'MESSAGE'
        && candidate.column_index <= annotation.column_index
        && candidate.qubits.some((qubit) => annotation.qubits.includes(qubit)))
      .at(-1)
    return source ? { ...annotation, source_id: source.id } : annotation
  })
  return {
    logical_qubits: circuit.logical_qubits,
    classical_bits: circuit.classical_bits ?? 0,
    initial_states: [...circuit.initial_states],
    annotations,
    columns: circuit.columns
      .map((column) => ({
        step: column.step,
        gates: column.gates.filter((gate) => !isAnnotationGateType(gate.type)).map((gate) => ({
          type: gate.type,
          targets: [...gate.targets],
          controls: [...(gate.controls ?? [])],
          ...(gate.params === undefined ? {} : { params: { ...gate.params } }),
          ...(gate.classical_targets === undefined ? {} : { classical_targets: [...gate.classical_targets] }),
          ...(gate.condition === undefined ? {} : { condition: gate.condition }),
          ...(gate.conditions === undefined ? {} : { conditions: [...gate.conditions] }),
        })),
      })),
  }
}
