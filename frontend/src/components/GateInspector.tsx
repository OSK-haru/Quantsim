import './GateInspector.css'
import type { CircuitEditorState, CircuitGate } from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'

type GateInspectorProps = {
  circuit: CircuitEditorState
  selectedGateId: string | null
  gateDurationDefaults: GateDurationDefaults
  onDeleteSelected: () => void
  onReveal: () => void
}

type GateLocation = {
  gate: CircuitGate
  columnIndex: number
} | null

function findGateLocation(circuit: CircuitEditorState, selectedGateId: string | null): GateLocation {
  if (!selectedGateId) {
    return null
  }

  for (const [columnIndex, column] of circuit.columns.entries()) {
    const gate = column.gates.find((candidate) => candidate.id === selectedGateId)
    if (gate) {
      return { gate, columnIndex }
    }
  }

  return null
}

function formatQubits(qubits: number[] | undefined) {
  if (!qubits || qubits.length === 0) {
    return 'None'
  }

  return qubits.map((qubit) => `q${qubit}`).join(', ')
}

function getGateDuration(gate: CircuitGate, gateDurationDefaults: GateDurationDefaults) {
  return gate.params?.duration_us ?? gateDurationDefaults[gate.type]
}

export function GateInspector({
  circuit,
  selectedGateId,
  gateDurationDefaults,
  onDeleteSelected,
  onReveal,
}: GateInspectorProps) {
  const location = findGateLocation(circuit, selectedGateId)

  if (!location) {
    return null
  }

  return (
    <aside className="gate-inspector" aria-label="Selected gate inspector">
      <div className="gate-inspector__header">
        <span className="gate-inspector__eyebrow">Inspector</span>
        <h2>{location.gate.type}</h2>
      </div>

      <dl className="gate-inspector__details">
        <div>
          <dt>Column</dt>
          <dd>{location.columnIndex + 1}</dd>
        </div>
        <div>
          <dt>Targets</dt>
          <dd>{formatQubits(location.gate.targets)}</dd>
        </div>
        <div>
          <dt>Controls</dt>
          <dd>{formatQubits(location.gate.controls)}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{getGateDuration(location.gate, gateDurationDefaults).toFixed(3)} us</dd>
        </div>
        <div className="gate-inspector__debug">
          <dt>Editor id</dt>
          <dd>{location.gate.id}</dd>
        </div>
      </dl>

      <div className="gate-inspector__actions">
        <button className="gate-inspector__reveal" type="button" onClick={onReveal}>
          Reveal
        </button>
        <button className="gate-inspector__delete" type="button" onClick={onDeleteSelected}>
          Delete gate
        </button>
      </div>
    </aside>
  )
}
