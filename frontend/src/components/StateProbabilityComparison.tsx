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
  /* 保持した実行のノイズありスナップショット。比較表示が切れていれば空。 */
  heldSnapshots?: StateSnapshot[]
}

type ProbabilityPoint = { time: number; value: number }

export function StateProbabilityComparison({
  qubitCount,
  idealSnapshots,
  noisySnapshots,
  finalProbabilities,
  cursorSimulationTimeUs = null,
  heldSnapshots = [],
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
  /*
   * ページ側が「環境だけが違う実行」しか渡してこないので、回路も量子ビット数も
   * 必ず一致する。対応しなくなった保持は、その時点で捨てられている。
   */
  const heldSeries = heldSnapshots.length > 0
    ? probabilitySeries(heldSnapshots, qubitCount, selectedState)
    : []
  /*
   * 2本がほぼ重なると、線が1本しか無いように見えて「比較が出ていない」と
   * 誤解される。差が目で見える太さに届いていないことを、言葉で伝える。
   * しきい値は線幅（2px）が縦軸で表す確率におおよそ対応する値。
   */
  const maximumHeldGap = heldSeries.length === 0
    ? 0
    : heldSeries.reduce((maximum, point, index) => {
        const current = noisySeries[index]
        return current === undefined
          ? maximum
          : Math.max(maximum, Math.abs(point.value - current.value))
      }, 0)
  const heldOverlaps = heldSeries.length > 0 && maximumHeldGap < 0.005
  const chartWidth = 760
  const chartHeight = 250
  const padding = 34
  const allTimes = [...noisySeries, ...idealSeries, ...heldSeries].map((point) => point.time)
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
  /* 保持側はスナップショットの数が違うので、共有インデックスではなく時刻から引く。 */
  const heldCursorValue = heldSnapshots.length > 0
    ? probabilityAtNearestSnapshot(heldSnapshots, qubitCount, selectedState, boundedCursorTimeUs)
    : null

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
        {heldSeries.length > 0 ? (
          <span>
            <i className="state-probability-comparison__swatch state-probability-comparison__swatch--held" />
            保持した実行
          </span>
        ) : null}
        <strong>|{selectedState}⟩</strong>
      </div>
      {heldOverlaps ? (
        <p className="state-probability-comparison__held-note">
          保持した実行との差は最大 {formatProbability(maximumHeldGap)} で、2本はほぼ重なっています。
          環境パラメタを大きく変えて実行すると差が見えます。
        </p>
      ) : null}
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
            {heldSeries.length > 0 ? <path d={seriesPath(heldSeries, maxTime, chartWidth, chartHeight, padding)} className="state-probability-comparison__line state-probability-comparison__line--held" /> : null}
            {cursorX === null ? null : (
              <g className="state-probability-comparison__cursor">
                <line x1={cursorX} x2={cursorX} y1={padding} y2={chartHeight - padding} />
                {noisyCursorValue === null ? null : <circle cx={cursorX} cy={probabilityY(noisyCursorValue, chartHeight, padding)} r="5" data-series="noisy" />}
                {idealCursorValue === null ? null : <circle cx={cursorX} cy={probabilityY(idealCursorValue, chartHeight, padding)} r="5" data-series="ideal" />}
                {heldCursorValue === null ? null : <circle cx={cursorX} cy={probabilityY(heldCursorValue, chartHeight, padding)} r="5" data-series="held" />}
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
        {heldCursorValue === null ? null : <span>保持 {formatProbability(heldCursorValue)}</span>}
        {noisyCursorValue !== null && heldCursorValue !== null ? (
          <span>保持との差 {formatProbability(Math.abs(heldCursorValue - noisyCursorValue))}</span>
        ) : null}
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
