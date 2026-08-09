import { useEffect, useState } from 'react'
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
  onSnapshotIndexChange?: (snapshotIndex: number) => void
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
  onSnapshotIndexChange,
}: OutputProbabilitiesProps) {
  const [isPlaying, setIsPlaying] = useState(false)
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
  const canNavigateSnapshots = snapshots.length > 0 && onSnapshotIndexChange !== undefined

  useEffect(() => {
    if (!isPlaying || !canNavigateSnapshots || activeSnapshotIndex >= snapshots.length - 1) {
      return
    }

    const timer = window.setTimeout(() => {
      const nextIndex = activeSnapshotIndex + 1
      onSnapshotIndexChange(nextIndex)
      if (nextIndex >= snapshots.length - 1) {
        setIsPlaying(false)
      }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [activeSnapshotIndex, canNavigateSnapshots, isPlaying, onSnapshotIndexChange, snapshots.length])

  function selectSnapshot(nextIndex: number) {
    if (!onSnapshotIndexChange) return
    setIsPlaying(false)
    onSnapshotIndexChange(clamp(nextIndex, 0, snapshots.length - 1))
  }

  function togglePlayback() {
    if (!onSnapshotIndexChange || snapshots.length < 2) return
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    if (activeSnapshotIndex >= snapshots.length - 1) {
      onSnapshotIndexChange(0)
    }
    setIsPlaying(true)
  }

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
              <div className="output-probabilities__snapshot-controls" aria-label="出力確率のスナップショット操作">
                <button
                  type="button"
                  onClick={() => selectSnapshot(activeSnapshotIndex - 1)}
                  disabled={activeSnapshotIndex === 0}
                >
                  前へ
                </button>
                <button
                  type="button"
                  className="output-probabilities__play-button"
                  aria-pressed={isPlaying}
                  onClick={togglePlayback}
                  disabled={snapshots.length < 2}
                >
                  {isPlaying ? '停止' : activeSnapshotIndex === snapshots.length - 1 ? '最初から再生' : '再生'}
                </button>
                <button
                  type="button"
                  onClick={() => selectSnapshot(activeSnapshotIndex + 1)}
                  disabled={activeSnapshotIndex === snapshots.length - 1}
                >
                  次へ
                </button>
                <span aria-live="polite">
                  {activeSnapshotIndex + 1} / {snapshots.length}
                </span>
              </div>
              <label className="output-probabilities__snapshot-slider">
                <span>スナップショット</span>
                <input
                  type="range"
                  min="0"
                  max={Math.max(snapshots.length - 1, 0)}
                  step="1"
                  value={activeSnapshotIndex}
                  onChange={(event) => selectSnapshot(Number(event.currentTarget.value))}
                />
              </label>
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
