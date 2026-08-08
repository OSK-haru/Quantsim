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
  defaultOpen?: boolean
}

function formatProbability(value: number) {
  return value.toFixed(4)
}

export function OutputProbabilities({
  outputProbabilities,
  qubitCount,
  defaultOpen = false,
}: OutputProbabilitiesProps) {
  const { qubitCount: resolvedQubitCount, rows } = buildOutputProbabilityRows(
    outputProbabilities,
    qubitCount,
  )
  const basisStateCount = basisLabels(resolvedQubitCount).length

  return (
    <ResultDrawer
      eyebrow="結果"
      title="出力確率"
      icon="bars"
      description={`計算基底の確率: 量子ビット ${resolvedQubitCount} 個、状態数 ${basisStateCount}。`}
      defaultOpen={defaultOpen}
    >
      {rows.length === 0 ? (
        <p className="output-probabilities__empty">出力確率を利用できません。</p>
      ) : (
        <>
          <p className="output-probabilities__summary" aria-live="polite">
            基底状態 {basisStateCount} 個 / 量子ビット {resolvedQubitCount} 個
          </p>
          <div className="output-probabilities" role="table" aria-label="出力確率">
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
