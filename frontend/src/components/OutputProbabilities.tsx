import './OutputProbabilities.css'
import { ResultDrawer } from './ResultDrawer'
import type { OutputProbabilities as OutputProbabilityMap, StateSnapshot } from '../types/simulation'
import {
  buildOutputProbabilityRows,
  basisLabels,
  probabilitiesFromSnapshot,
} from '../utils/outputProbabilities'
import {
  formatSnapshotProgress,
  formatSnapshotTimeUs,
  snapshotKindLabel,
} from '../utils/densityMatrix'

type OutputProbabilitiesProps = {
  outputProbabilities: OutputProbabilityMap
  qubitCount?: number | null
  defaultOpen?: boolean
  snapshots?: StateSnapshot[]
  snapshotIndex?: number
}

function formatProbability(value: number) {
  return value.toFixed(4)
}

export function OutputProbabilities({
  outputProbabilities,
  qubitCount,
  defaultOpen = false,
  snapshots = [],
  snapshotIndex = 0,
}: OutputProbabilitiesProps) {
  const activeSnapshotIndex = clamp(snapshotIndex, 0, Math.max(snapshots.length - 1, 0))
  const activeSnapshot = snapshots[activeSnapshotIndex]
  const snapshotProbabilities = qubitCount === null || qubitCount === undefined
    ? null
    : probabilitiesFromSnapshot(activeSnapshot, qubitCount)
  const displayedProbabilities = snapshotProbabilities ?? outputProbabilities
  const { qubitCount: resolvedQubitCount, rows } = buildOutputProbabilityRows(
    displayedProbabilities,
    qubitCount,
  )
  const basisStateCount = basisLabels(resolvedQubitCount).length
  const canNavigateSnapshots = snapshots.length > 0

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
          {canNavigateSnapshots ? (
            <div className="output-probabilities__snapshot-explorer">
              <div className="output-probabilities__snapshot-meta" aria-label="表示中のスナップショット">
                <strong>{snapshotKindLabel(activeSnapshot)}</strong>
                <span>{formatSnapshotTimeUs(activeSnapshot?.time_us)}</span>
                <span>{formatSnapshotProgress(activeSnapshot?.progress)}</span>
                {activeSnapshot?.column_index == null ? null : (
                  <span>列 {activeSnapshot.column_index + 1}</span>
                )}
              </div>
            </div>
          ) : null}
          <p className="output-probabilities__summary" aria-live="polite">
            基底状態 {basisStateCount} 個 / 量子ビット {resolvedQubitCount} 個
            {snapshotProbabilities === null ? ' / 最終出力' : ' / 表示中のスナップショット'}
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
