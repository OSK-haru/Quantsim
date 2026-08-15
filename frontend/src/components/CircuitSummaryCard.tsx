import './CircuitSummaryCard.css'
import type { CircuitEditorState } from '../types/circuit'
import { isMultiQubitGateType } from '../utils/circuitEditing'

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
        if (isMultiQubitGateType(gate.type)) {
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
    return '空の回路'
  }

  return occupiedColumns
    .map((column) => `${column.index + 1}: ${column.labels.join(', ')}`)
    .join(' / ')
}

export function CircuitSummaryCard({
  circuit,
  title = 'シミュレーション対象の回路',
  actionLabel,
  onAction,
}: CircuitSummaryCardProps) {
  const gateCounts = getGateCounts(circuit)

  return (
    <section className="circuit-summary-card" aria-label="回路の概要" data-tutorial-anchor="circuit-summary">
      <div className="circuit-summary-card__header">
        <div>
          <div className="circuit-summary-card__eyebrow">回路</div>
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
        <span>量子ビット {circuit.logical_qubits}</span>
        <span>列 {circuit.columns.length}</span>
        <span>ゲート {gateCounts.total}</span>
        <span>2量子ビットゲート {gateCounts.cnot}</span>
      </div>
    </section>
  )
}
