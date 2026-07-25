import { useState } from 'react'
import './StateExplorerPage.css'
import { BlochSphereExplorer } from '../components/BlochSphereExplorer'
import { DensityMatrixViewer } from '../components/DensityMatrixViewer'
import type { SimulationResponse } from '../types/simulation'

type StateExplorerPageProps = {
  response: SimulationResponse | null
  onOpenSimulation: () => void
  onOpenCircuitStudio: () => void
}

export function StateExplorerPage({
  response,
  onOpenSimulation,
  onOpenCircuitStudio,
}: StateExplorerPageProps) {
  const [snapshotIndex, setSnapshotIndex] = useState(0)
  const snapshots = response && Array.isArray(response.state_snapshots)
    ? response.state_snapshots
    : []
  const activeSnapshotIndex = Math.min(snapshotIndex, Math.max(snapshots.length - 1, 0))
  const qubitCount = response && response.circuit && Number.isInteger(response.circuit.qubit_count)
    ? response.circuit.qubit_count
    : null
  const matrixDimension = qubitCount === null ? null : 2 ** qubitCount

  return (
    <main className="state-explorer-page">
      <header className="state-explorer-page__header">
        <div>
          <span className="state-explorer-page__eyebrow">QuantaScope / Gate-aware results</span>
          <h1>Gate-aware 状態エクスプローラー</h1>
          <p className="state-explorer-page__scope">
            `/api/simulate` の回路スナップショット専用です。Pulse Labの結果は
            Pulse Lab内で表示され、ここには読み込まれません。
          </p>
        </div>
        <nav className="state-explorer-page__actions" aria-label="状態エクスプローラーのナビゲーション">
          <button type="button" onClick={onOpenSimulation}>Gate-aware シミュレーション</button>
          <button type="button" onClick={onOpenCircuitStudio}>Gate-aware 回路スタジオ</button>
        </nav>
      </header>

      {response === null ? (
        <section className="state-explorer-page__empty" aria-labelledby="state-explorer-empty-title">
          <span className="state-explorer-page__eyebrow">結果なし</span>
          <h2 id="state-explorer-empty-title">Gate-aware シミュレーション結果がありません。</h2>
          <p>先にGate-awareシミュレーションを実行してください。</p>
          <button type="button" onClick={onOpenSimulation}>Gate-aware シミュレーションを開く</button>
        </section>
      ) : (
        <>
          <section className="state-explorer-page__summary" aria-label="シミュレーション結果の概要">
            <span>{qubitCount === null ? '量子ビット数不明' : `量子ビット ${qubitCount}`}</span>
            {matrixDimension === null ? null : <span>{matrixDimension} x {matrixDimension}</span>}
            <span>スナップショット {snapshots.length} 個</span>
          </section>
          <section className="state-explorer-page__workspace" aria-label="密度行列ワークスペース">
            {snapshots.length === 0 ? (
              <div className="state-explorer-page__unavailable">
                この結果には密度行列スナップショットがありません。
              </div>
            ) : (
              <div className="state-explorer-page__explorers">
                <BlochSphereExplorer
                  snapshots={snapshots}
                  snapshotIndex={activeSnapshotIndex}
                  onSnapshotIndexChange={setSnapshotIndex}
                />
                <section
                  className="state-explorer-page__density-section"
                  aria-labelledby="density-matrix-title"
                >
                  <div className="state-explorer-page__section-heading">
                    <div>
                      <span className="state-explorer-page__eyebrow">Full quantum state</span>
                      <h2 id="density-matrix-title">密度行列</h2>
                    </div>
                    <p>Bloch球と同じスナップショットの完全な多量子ビット状態を表示します。</p>
                  </div>
                  <DensityMatrixViewer
                    snapshots={snapshots}
                    snapshotIndex={activeSnapshotIndex}
                    onSnapshotIndexChange={setSnapshotIndex}
                  />
                </section>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
