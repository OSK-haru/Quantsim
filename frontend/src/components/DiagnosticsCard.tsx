import './DiagnosticsCard.css'
import type { SimulationDiagnostics } from '../types/simulation'

export type { SimulationDiagnostics } from '../types/simulation'

type DiagnosticsCardProps = {
  diagnostics: SimulationDiagnostics
}

export function DiagnosticsCard({ diagnostics }: DiagnosticsCardProps) {
  return (
    <section className="diagnostics-card" aria-label="Diagnostics">
      <div className="diagnostics-card__header">
        <div>
          <div className="diagnostics-card__eyebrow">Diagnostics</div>
          <h2 className="diagnostics-card__title">Runtime snapshot</h2>
        </div>
      </div>

      <div className="diagnostics-grid">
        <div className="diagnostics-item">
          <span className="diagnostics-label">Simulation model</span>
          <strong className="diagnostics-value">{diagnostics.simulation_model}</strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Evolution mode</span>
          <strong className="diagnostics-value">{diagnostics.evolution_mode}</strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Simulation backend</span>
          <strong className="diagnostics-value">
            {diagnostics.simulation_backend}
          </strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Backend name</span>
          <strong className="diagnostics-value">{diagnostics.backend_name}</strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Rust kernel mode</span>
          <strong className="diagnostics-value">{diagnostics.rust_kernel_mode}</strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Rust call count</span>
          <strong className="diagnostics-value">
            {diagnostics.rust_kernel_call_count}
          </strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Sampled batches</span>
          <strong className="diagnostics-value">
            {diagnostics.rust_kernel_sampled_batch_count}
          </strong>
        </div>
      </div>

      <div className="diagnostics-badges">
        <span className={`diagnostics-badge ${diagnostics.backend_fallback_used ? 'is-warn' : 'is-ok'}`}>
          {diagnostics.backend_fallback_used ? 'Backend fallback' : 'No fallback'}
        </span>
        <span className={`diagnostics-badge ${diagnostics.rust_kernel_fallback_used ? 'is-warn' : 'is-ok'}`}>
          {diagnostics.rust_kernel_fallback_used ? 'Rust fallback' : 'Rust active'}
        </span>
      </div>
    </section>
  )
}
