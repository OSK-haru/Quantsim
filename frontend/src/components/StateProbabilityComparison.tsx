import { useMemo, useState } from 'react'
import './StateProbabilityComparison.css'
import type { OutputProbabilities, StateSnapshot } from '../types/simulation'
import { basisLabels, probabilitiesFromSnapshot } from '../utils/outputProbabilities'
import { nearestSnapshotIndex } from '../utils/physicalTimeline'

type Props = {
  qubitCount: number
  idealSnapshots: StateSnapshot[]
  noisySnapshots: StateSnapshot[]
  finalProbabilities: OutputProbabilities
  cursorSimulationTimeUs?: number | null
}

type ProbabilityPoint = { time: number; value: number }

export function StateProbabilityComparison({
  qubitCount,
  idealSnapshots,
  noisySnapshots,
  finalProbabilities,
  cursorSimulationTimeUs = null,
}: Props) {
  const labels = useMemo(() => basisLabels(qubitCount), [qubitCount])
  const defaultState = useMemo(() => {
    const final = Object.entries(finalProbabilities)
      .sort(([, left], [, right]) => right - left)[0]?.[0]
    return final ?? labels[0]
  }, [finalProbabilities, labels])
  const [selectedState, setSelectedState] = useState(defaultState)
  const noisySeries = probabilitySeries(noisySnapshots, qubitCount, selectedState)
  const idealSeries = probabilitySeries(idealSnapshots, qubitCount, selectedState)
  const chartWidth = 760
  const chartHeight = 250
  const padding = 34
  const allTimes = [...noisySeries, ...idealSeries].map((point) => point.time)
  const maxTime = Math.max(...allTimes, 1)
  const boundedCursorTimeUs = cursorSimulationTimeUs === null
    ? null
    : Math.min(maxTime, Math.max(0, cursorSimulationTimeUs))
  const cursorX = boundedCursorTimeUs === null
    ? null
    : padding + (boundedCursorTimeUs / maxTime) * (chartWidth - padding * 2)
  const noisyCursorValue = probabilityAtNearestSnapshot(
    noisySnapshots,
    qubitCount,
    selectedState,
    boundedCursorTimeUs,
  )
  const idealCursorValue = probabilityAtNearestSnapshot(
    idealSnapshots,
    qubitCount,
    selectedState,
    boundedCursorTimeUs,
  )

  return (
    <section className="state-probability-comparison" aria-labelledby="state-probability-title">
      <header className="state-probability-comparison__heading">
        <div>
          <span className="state-probability-comparison__eyebrow">Ideal vs noisy transition</span>
          <h2 id="state-probability-title">確率遷移：理想 vs ノイズあり</h2>
        </div>
        <label className="state-probability-comparison__selector">
          表示状態
          <select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>
            {labels.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </label>
      </header>
      <p className="state-probability-comparison__description">
        選択した計算基底状態の確率を比較します。緑色のカーソルは回路、指標、Bloch球、密度行列と同じ物理時刻です。
      </p>
      <div className="state-probability-comparison__legend">
        <span><i className="state-probability-comparison__swatch state-probability-comparison__swatch--ideal" />理想</span>
        <span><i className="state-probability-comparison__swatch state-probability-comparison__swatch--noisy" />ノイズあり</span>
        <strong>|{selectedState}⟩</strong>
      </div>
      {noisySeries.length === 0 ? (
        <p className="state-probability-comparison__empty">確率遷移データがありません。</p>
      ) : (
        <div className="state-probability-comparison__chart-wrap">
          <svg className="state-probability-comparison__chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`状態 ${selectedState} の理想値とノイズあり確率の遷移`}>
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const y = probabilityY(tick, chartHeight, padding)
              return <line key={tick} x1={padding} x2={chartWidth - padding} y1={y} y2={y} className="state-probability-comparison__grid" />
            })}
            <line x1={padding} x2={chartWidth - padding} y1={chartHeight - padding} y2={chartHeight - padding} className="state-probability-comparison__axis" />
            <path d={seriesPath(noisySeries, maxTime, chartWidth, chartHeight, padding)} className="state-probability-comparison__line state-probability-comparison__line--noisy" />
            {idealSeries.length > 0 ? <path d={seriesPath(idealSeries, maxTime, chartWidth, chartHeight, padding)} className="state-probability-comparison__line state-probability-comparison__line--ideal" /> : null}
            {cursorX === null ? null : (
              <g className="state-probability-comparison__cursor">
                <line x1={cursorX} x2={cursorX} y1={padding} y2={chartHeight - padding} />
                {noisyCursorValue === null ? null : <circle cx={cursorX} cy={probabilityY(noisyCursorValue, chartHeight, padding)} r="5" data-series="noisy" />}
                {idealCursorValue === null ? null : <circle cx={cursorX} cy={probabilityY(idealCursorValue, chartHeight, padding)} r="5" data-series="ideal" />}
              </g>
            )}
            <text x={padding} y={18} className="state-probability-comparison__axis-label">100%</text>
            <text x={padding} y={chartHeight - padding + 18} className="state-probability-comparison__axis-label">0%</text>
            <text x={chartWidth - padding} y={chartHeight - 8} textAnchor="end" className="state-probability-comparison__axis-label">{maxTime.toFixed(3)} μs</text>
          </svg>
        </div>
      )}
      <div className="state-probability-comparison__footer">
        {boundedCursorTimeUs === null ? null : <span>現在 {boundedCursorTimeUs.toFixed(4)} μs</span>}
        {noisyCursorValue === null ? null : <span>ノイズあり {formatProbability(noisyCursorValue)}</span>}
        {idealCursorValue === null ? null : <span>理想 {formatProbability(idealCursorValue)}</span>}
      </div>
    </section>
  )
}

function probabilitySeries(snapshots: StateSnapshot[], qubitCount: number, state: string): ProbabilityPoint[] {
  return snapshots.map((snapshot) => ({
    time: snapshot.time_us ?? 0,
    value: probabilitiesFromSnapshot(snapshot, qubitCount)?.[state] ?? 0,
  }))
}

function probabilityAtNearestSnapshot(
  snapshots: StateSnapshot[],
  qubitCount: number,
  state: string,
  simulationTimeUs: number | null,
) {
  if (simulationTimeUs === null) return null
  const index = nearestSnapshotIndex(snapshots, simulationTimeUs)
  if (index < 0) return null
  return probabilitiesFromSnapshot(snapshots[index], qubitCount)?.[state] ?? null
}

function probabilityY(value: number, height: number, padding: number) {
  return height - padding - Math.max(0, Math.min(1, value)) * (height - padding * 2)
}

function seriesPath(series: ProbabilityPoint[], maxTime: number, width: number, height: number, padding: number) {
  return series.map((point, index) => {
    const x = padding + (point.time / maxTime) * (width - padding * 2)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${probabilityY(point.value, height, padding).toFixed(2)}`
  }).join(' ')
}

function formatProbability(value: number) {
  return `${(Math.max(0, Math.min(1, value)) * 100).toFixed(2)}%`
}
