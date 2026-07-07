import './DiagnosticsCard.css'
import { ResultDrawer } from './ResultDrawer'
import { getModelLabel } from '../utils/modelLabels'
import type { SimulationDiagnostics } from '../types/simulation'

export type { SimulationDiagnostics } from '../types/simulation'

type DiagnosticsCardProps = {
  diagnostics: SimulationDiagnostics
}

function ModelValue({ id }: { id: string }) {
  const info = getModelLabel(id)

  return (
    <strong className="diagnostics-value">
      <span>{info.label}</span>
      <span className="diagnostics-value__id">{info.id}</span>
    </strong>
  )
}

export function DiagnosticsCard({ diagnostics }: DiagnosticsCardProps) {
  return (
    <ResultDrawer
      eyebrow="Diagnostics"
      title="Runtime snapshot"
      description="Backend and runtime details for the latest response."
      defaultOpen={false}
    >
      <div className="diagnostics-grid">
        <div className="diagnostics-item">
          <span className="diagnostics-label">Simulation model</span>
          <ModelValue id={diagnostics.simulation_model} />
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Evolution mode</span>
          <ModelValue id={diagnostics.evolution_mode} />
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Simulation backend</span>
          <ModelValue id={diagnostics.simulation_backend} />
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Backend name</span>
          <ModelValue id={diagnostics.backend_name} />
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Rust kernel mode</span>
          <strong className="diagnostics-value">{diagnostics.rust_kernel_mode}</strong>
        </div>
        <div className="diagnostics-item">
          <span className="diagnostics-label">Rust call count</span>
          <strong className="diagnostics-value">{diagnostics.rust_kernel_call_count}</strong>
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
    </ResultDrawer>
  )
}
