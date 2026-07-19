import './StateExplorerPage.css'
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
  const snapshots = response && Array.isArray(response.state_snapshots)
    ? response.state_snapshots
    : []
  const qubitCount = response && response.circuit && Number.isInteger(response.circuit.qubit_count)
    ? response.circuit.qubit_count
    : null
  const matrixDimension = qubitCount === null ? null : 2 ** qubitCount

  return (
    <main className="state-explorer-page">
      <header className="state-explorer-page__header">
        <div>
          <span className="state-explorer-page__eyebrow">QuantaScope</span>
          <h1>State Explorer</h1>
        </div>
        <nav className="state-explorer-page__actions" aria-label="State Explorer navigation">
          <button type="button" onClick={onOpenSimulation}>Simulation Lab</button>
          <button type="button" onClick={onOpenCircuitStudio}>Circuit Studio</button>
        </nav>
      </header>

      {response === null ? (
        <section className="state-explorer-page__empty" aria-labelledby="state-explorer-empty-title">
          <span className="state-explorer-page__eyebrow">No result</span>
          <h2 id="state-explorer-empty-title">No simulation result is available.</h2>
          <p>Run a simulation in Simulation Lab first.</p>
          <button type="button" onClick={onOpenSimulation}>Open Simulation Lab</button>
        </section>
      ) : (
        <>
          <section className="state-explorer-page__summary" aria-label="Simulation result summary">
            <span>{qubitCount === null ? 'Qubit count unavailable' : `${qubitCount} qubits`}</span>
            {matrixDimension === null ? null : <span>{matrixDimension} x {matrixDimension}</span>}
            <span>{snapshots.length} snapshots</span>
          </section>
          <section className="state-explorer-page__workspace" aria-label="Density matrix workspace">
            {snapshots.length === 0 ? (
              <div className="state-explorer-page__unavailable">
                No density matrix snapshots are available for this result.
              </div>
            ) : (
              <DensityMatrixViewer snapshots={snapshots} />
            )}
          </section>
        </>
      )}
    </main>
  )
}
