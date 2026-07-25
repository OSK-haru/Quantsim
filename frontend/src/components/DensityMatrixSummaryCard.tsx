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
        <span className="density-matrix-summary-card__eyebrow">状態分析</span>
        <h2 id="density-matrix-summary-title">密度行列のスナップショット</h2>
        <p>
          スナップショット {snapshots.length} 個 / {dimension === null ? '行列サイズ不明' : `${dimension} x ${dimension}`}
        </p>
      </div>
      <button type="button" onClick={onOpenStateExplorer}>
        状態エクスプローラーで開く
      </button>
    </section>
  )
}
