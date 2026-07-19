import './CircuitSummaryCard.css'
import type { CircuitEditorState } from '../types/circuit'

type CircuitSummaryCardProps = {
  circuit: CircuitEditorState
  title?: string
  actionLabel?: string
  onAction?: () => void
}

function getGateCounts(circuit: CircuitEditorState) {
  return circuit.columns.reduce(
    (summary, column) => {
      for (const gate of column.gates) {
        summary.total += 1
        if (gate.type === 'CNOT') {
          summary.cnot += 1
        }
      }
      return summary
    },
    { total: 0, cnot: 0 },
  )
}

function formatColumnPreview(circuit: CircuitEditorState) {
  const occupiedColumns = circuit.columns
    .map((column, index) => ({
      index,
      labels: column.gates.map((gate) => gate.type),
    }))
    .filter((column) => column.labels.length > 0)
    .slice(0, 4)

  if (occupiedColumns.length === 0) {
    return 'Empty circuit'
  }

  return occupiedColumns
    .map((column) => `${column.index + 1}: ${column.labels.join(', ')}`)
    .join(' / ')
}

export function CircuitSummaryCard({
  circuit,
  title = 'Circuit selected for simulation',
  actionLabel,
  onAction,
}: CircuitSummaryCardProps) {
  const gateCounts = getGateCounts(circuit)

  return (
    <section className="circuit-summary-card" aria-label="Circuit summary">
      <div className="circuit-summary-card__header">
        <div>
          <div className="circuit-summary-card__eyebrow">Circuit</div>
          <h2>{title}</h2>
          <p className="circuit-summary-card__preview">{formatColumnPreview(circuit)}</p>
        </div>
        {actionLabel && onAction ? (
          <button className="circuit-summary-card__action" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="circuit-summary-card__stats">
        <span>{circuit.logical_qubits} qubits</span>
        <span>{circuit.columns.length} columns</span>
        <span>{gateCounts.total} gates</span>
        <span>{gateCounts.cnot} CNOTs</span>
      </div>
    </section>
  )
}
