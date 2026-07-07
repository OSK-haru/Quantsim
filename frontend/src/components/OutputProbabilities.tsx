import './OutputProbabilities.css'
import { ResultDrawer } from './ResultDrawer'
import type { OutputProbabilities } from '../types/simulation'

type OutputProbabilitiesProps = {
  outputProbabilities: OutputProbabilities
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

export function OutputProbabilities({ outputProbabilities }: OutputProbabilitiesProps) {
  const entries = Object.entries(outputProbabilities)

  return (
    <ResultDrawer
      eyebrow="Results"
      title="Output probabilities"
      description="End-of-run state weights for the current snapshot."
      defaultOpen={false}
    >
      {entries.length === 0 ? (
        <p className="output-probabilities__empty">No output probabilities available.</p>
      ) : (
        <div className="output-probabilities" role="table" aria-label="Output probabilities">
          {entries.map(([state, probability]) => (
            <div className="output-probabilities__row" role="row" key={state}>
              <span className="output-probabilities__state" role="cell">
                {state}
              </span>
              <div className="output-probabilities__bar-track" aria-hidden="true">
                <div
                  className="output-probabilities__bar-fill"
                  style={{ width: `${Math.max(0, Math.min(probability, 1)) * 100}%` }}
                />
              </div>
              <span className="output-probabilities__probability" role="cell">
                {formatPercent(probability)}
              </span>
            </div>
          ))}
        </div>
      )}
    </ResultDrawer>
  )
}
