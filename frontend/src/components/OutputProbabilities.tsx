import './OutputProbabilities.css'
import { ResultDrawer } from './ResultDrawer'
import type { OutputProbabilities } from '../types/simulation'
import {
  buildOutputProbabilityRows,
  basisLabels,
} from '../utils/outputProbabilities'

type OutputProbabilitiesProps = {
  outputProbabilities: OutputProbabilities
  qubitCount?: number | null
}

function formatProbability(value: number) {
  return value.toFixed(4)
}

export function OutputProbabilities({
  outputProbabilities,
  qubitCount,
}: OutputProbabilitiesProps) {
  const { qubitCount: resolvedQubitCount, rows } = buildOutputProbabilityRows(
    outputProbabilities,
    qubitCount,
  )
  const basisStateCount = basisLabels(resolvedQubitCount).length

  return (
    <ResultDrawer
      eyebrow="Results"
      title="Output probabilities"
      icon="bars"
      description={`Computational basis probabilities: ${basisStateCount} states for ${resolvedQubitCount} qubits.`}
      defaultOpen={false}
    >
      {rows.length === 0 ? (
        <p className="output-probabilities__empty">No output probabilities available.</p>
      ) : (
        <>
          <p className="output-probabilities__summary" aria-live="polite">
            {basisStateCount} basis states / {resolvedQubitCount} qubits
          </p>
          <div className="output-probabilities" role="table" aria-label="Output probabilities">
            {rows.map(({ state, probability, isExpected }) => (
              <div
                className="output-probabilities__row"
                data-expected={isExpected}
                role="row"
                key={state}
              >
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
                  {formatProbability(probability)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </ResultDrawer>
  )
}
