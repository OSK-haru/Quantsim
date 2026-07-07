import './SimulationSummary.css'
import type { SimulationSummaryData } from '../types/simulation'

type SimulationSummaryProps = {
  summary: SimulationSummaryData
}

function formatMetric(value: number) {
  return value.toFixed(12)
}

function formatOptionalMetric(value: number | null) {
  if (value === null) {
    return 'not available'
  }
  return formatMetric(value)
}

function formatTime(value: number | null) {
  if (value === null) {
    return 'not available'
  }

  return `${value.toFixed(3)} us`
}

export function SimulationSummary({ summary }: SimulationSummaryProps) {
  return (
    <section className="simulation-summary" aria-label="Simulation result summary">
      <div className="simulation-summary__header">
        <div>
          <div className="simulation-summary__eyebrow">Result summary</div>
          <h2 className="simulation-summary__title">Static simulation snapshot</h2>
        </div>
      </div>

      <div className="simulation-summary__metrics">
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">Final fidelity</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.final_fidelity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">Final purity</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.final_purity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">Completion fidelity</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.completion_fidelity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">Completion purity</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.completion_purity)}</strong>
        </article>
        <article className="simulation-summary__metric simulation-summary__metric--full">
          <span className="simulation-summary__label">Effective time</span>
          <strong className="simulation-summary__value">{formatTime(summary.effective_time_us)}</strong>
        </article>
      </div>
    </section>
  )
}
