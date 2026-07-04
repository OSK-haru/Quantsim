import './SimulationSummary.css'
import type { OutputProbabilities, SimulationSummaryData } from '../types/simulation'

type SimulationSummaryProps = {
  summary: SimulationSummaryData
  outputProbabilities: OutputProbabilities
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
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

export function SimulationSummary({ summary, outputProbabilities }: SimulationSummaryProps) {
  const entries = Object.entries(outputProbabilities)

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

      <div className="simulation-summary__probabilities">
        <div className="simulation-summary__section-heading">Output probabilities</div>
        <div className="simulation-summary__table" role="table" aria-label="Output probabilities">
          {entries.map(([state, probability]) => (
            <div className="simulation-summary__row" role="row" key={state}>
              <span className="simulation-summary__state" role="cell">
                {state}
              </span>
              <div className="simulation-summary__bar-track" aria-hidden="true">
                <div
                  className="simulation-summary__bar-fill"
                  style={{ width: `${Math.max(0, Math.min(probability, 1)) * 100}%` }}
                />
              </div>
              <span className="simulation-summary__probability" role="cell">
                {formatPercent(probability)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
