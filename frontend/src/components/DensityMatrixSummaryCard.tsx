import './DensityMatrixSummaryCard.css'
import type { SimulationResponse } from '../types/simulation'

type DensityMatrixSummaryCardProps = {
  response: SimulationResponse
  onOpenStateExplorer: () => void
}

export function DensityMatrixSummaryCard({
  response,
  onOpenStateExplorer,
}: DensityMatrixSummaryCardProps) {
  const snapshots = Array.isArray(response.state_snapshots) ? response.state_snapshots : []
  const qubitCount = Number.isInteger(response.circuit?.qubit_count)
    ? response.circuit.qubit_count
    : null
  const dimension = qubitCount === null ? null : 2 ** qubitCount

  return (
    <section className="density-matrix-summary-card" aria-labelledby="density-matrix-summary-title">
      <div>
        <span className="density-matrix-summary-card__eyebrow">State analysis</span>
        <h2 id="density-matrix-summary-title">Density matrix snapshots</h2>
        <p>
          {snapshots.length} snapshots / {dimension === null ? 'matrix size unavailable' : `${dimension} x ${dimension}`}
        </p>
      </div>
      <button type="button" onClick={onOpenStateExplorer}>
        Open in State Explorer
      </button>
    </section>
  )
}
