import { useState } from 'react'
import './PulseStateProbabilityComparison.css'
import {
  formatPulseProbability,
  nearestPulsePointIndex,
  type PulseExplorerView,
} from '../utils/pulseStateExplorer'

type PulseStateProbabilityComparisonProps = {
  view: PulseExplorerView
  cursorTimeUs: number | null
  /* 保持した実行の同じ基底の軌道。比較表示が切れていれば null。 */
  heldView?: PulseExplorerView | null
}

const chartWidth = 760
const chartHeight = 250
const padding = 34

/*
 * Gate-aware の「確率遷移：理想 vs ノイズあり」に対応する図。
 * Pulse では理想側にあたるのが散逸を切った閉じた系で、これを返すのは
 * 2準位モデルだけ。qutrit と結合モデルでは開いた系の1本だけを描く。
 */
export function PulseStateProbabilityComparison({
  view,
  cursorTimeUs,
  heldView = null,
}: PulseStateProbabilityComparisonProps) {
  const finalPoint = view.points.at(-1) ?? null
  const defaultLabel = finalPoint
    ? Object.entries(finalPoint.populations)
        .sort(([, left], [, right]) => right - left)[0]?.[0] ?? view.basisLabels[0]
    : view.basisLabels[0]
  const [selectedLabel, setSelectedLabel] = useState(defaultLabel)
  /* モデルを変えて再実行すると基底そのものが変わるので、選べない基底は先頭へ落とす。 */
  const activeLabel = view.basisLabels.includes(selectedLabel)
    ? selectedLabel
    : view.basisLabels[0] ?? ''

  const startTimeUs = view.points[0]?.timeUs ?? 0
  /* 保持した実行のほうが長いこともあるので、軸は両方が収まる幅にする。 */
  const maximumTimeUs = Math.max(
    view.totalTimeUs,
    heldView?.totalTimeUs ?? 0,
    startTimeUs + 1e-12,
  )
  const openSeries = view.points.map((point) => ({
    timeUs: point.timeUs,
    value: point.populations[activeLabel] ?? 0,
  }))
  const hasIdeal = view.points.some((point) => point.idealPopulations !== null)
  const idealSeries = hasIdeal
    ? view.points.map((point) => ({
        timeUs: point.timeUs,
        value: point.idealPopulations?.[activeLabel] ?? 0,
      }))
    : []
  /*
   * ページ側が「環境だけが違う実行」しか渡してこないので、基底は必ず対応する。
   * 対応しなくなった保持は、その時点で捨てられている。
   */
  const heldSeries = heldView === null
    ? []
    : heldView.points.map((point) => ({
        timeUs: point.timeUs,
        value: point.populations[activeLabel] ?? 0,
      }))
  const boundedCursorTimeUs = cursorTimeUs === null
    ? null
    : Math.min(maximumTimeUs, Math.max(startTimeUs, cursorTimeUs))
  const cursorIndex = boundedCursorTimeUs === null
    ? -1
    : nearestPulsePointIndex(view.points, boundedCursorTimeUs)
  const cursorPoint = cursorIndex >= 0 ? view.points[cursorIndex] : null
  const openCursorValue = cursorPoint ? cursorPoint.populations[activeLabel] ?? 0 : null
  /* 保持側は点の並びが違うので、共有インデックスではなく時刻から引き直す。 */
  const heldCursorIndex = heldView !== null && boundedCursorTimeUs !== null
    ? nearestPulsePointIndex(heldView.points, boundedCursorTimeUs)
    : -1
  const heldCursorValue = heldCursorIndex >= 0 && heldView !== null
    ? heldView.points[heldCursorIndex]?.populations[activeLabel] ?? 0
    : null
  const idealCursorValue = cursorPoint?.idealPopulations
    ? cursorPoint.idealPopulations[activeLabel] ?? 0
    : null
  const x = (timeUs: number) => (
    padding + ((timeUs - startTimeUs) / (maximumTimeUs - startTimeUs)) * (chartWidth - padding * 2)
  )
  const y = (value: number) => (
    chartHeight - padding - Math.max(0, Math.min(1, value)) * (chartHeight - padding * 2)
  )
  const cursorX = boundedCursorTimeUs === null ? null : x(boundedCursorTimeUs)

  return (
    <section className="pulse-probability" aria-labelledby="pulse-probability-title">
      <header className="pulse-probability__heading">
        <div>
          <span className="pulse-probability__eyebrow">Basis population transition</span>
          <h2 id="pulse-probability-title">
            {hasIdeal ? '確率遷移：閉じた系 vs 開いた系' : '確率遷移：計算基底ごとの占有'}
          </h2>
        </div>
        <label className="pulse-probability__selector">
          表示状態
          <select value={activeLabel} onChange={(event) => setSelectedLabel(event.target.value)}>
            {view.basisLabels.map((label) => (
              <option key={label} value={label}>|{label}⟩</option>
            ))}
          </select>
        </label>
      </header>

      <p className="pulse-probability__description">
        選択した基底状態の占有確率を時間の関数で表示します。カーソルはパルス列・指標・密度行列と同じ物理時刻です。
        {hasIdeal
          ? ' 散逸を切った閉じた系の軌道を重ねているので、2本の差がそのまま環境の寄与です。'
          : ' このモデルには対応する閉じた系の軌道が無いため、開いた系の1本だけを描いています。'}
      </p>

      <div className="pulse-probability__legend">
        <span>
          <i className="pulse-probability__swatch pulse-probability__swatch--open" />
          開いた系（散逸あり）
        </span>
        {hasIdeal ? (
          <span>
            <i className="pulse-probability__swatch pulse-probability__swatch--ideal" />
            {view.idealLabel ?? '閉じた系'}
          </span>
        ) : null}
        {heldSeries.length > 0 ? (
          <span>
            <i className="pulse-probability__swatch pulse-probability__swatch--held" />
            保持した実行
          </span>
        ) : null}
        <strong>|{activeLabel}⟩</strong>
      </div>

      {openSeries.length === 0 ? (
        <p className="pulse-probability__empty">確率遷移データがありません。</p>
      ) : (
        <div className="pulse-probability__chart-wrap">
          <svg
            className="pulse-probability__chart"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label={`状態 ${activeLabel} の占有確率の時間変化`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
              <line
                key={tick}
                className="pulse-probability__grid"
                x1={padding}
                x2={chartWidth - padding}
                y1={y(tick)}
                y2={y(tick)}
              />
            ))}
            <line
              className="pulse-probability__axis"
              x1={padding}
              x2={chartWidth - padding}
              y1={chartHeight - padding}
              y2={chartHeight - padding}
            />
            <path
              className="pulse-probability__line pulse-probability__line--open"
              d={seriesPath(openSeries, x, y)}
            />
            {idealSeries.length > 0 ? (
              <path
                className="pulse-probability__line pulse-probability__line--ideal"
                d={seriesPath(idealSeries, x, y)}
              />
            ) : null}
            {heldSeries.length > 0 ? (
              <path
                className="pulse-probability__line pulse-probability__line--held"
                d={seriesPath(heldSeries, x, y)}
              />
            ) : null}
            {cursorX === null ? null : (
              <g className="pulse-probability__cursor">
                <line x1={cursorX} x2={cursorX} y1={padding} y2={chartHeight - padding} />
                {openCursorValue === null ? null : (
                  <circle cx={cursorX} cy={y(openCursorValue)} r="5" data-series="open" />
                )}
                {idealCursorValue === null ? null : (
                  <circle cx={cursorX} cy={y(idealCursorValue)} r="5" data-series="ideal" />
                )}
                {heldCursorValue === null ? null : (
                  <circle cx={cursorX} cy={y(heldCursorValue)} r="5" data-series="held" />
                )}
              </g>
            )}
            <text className="pulse-probability__axis-label" x={padding} y={18}>100%</text>
            <text className="pulse-probability__axis-label" x={padding} y={chartHeight - padding + 18}>0%</text>
            <text
              className="pulse-probability__axis-label"
              x={chartWidth - padding}
              y={chartHeight - 8}
              textAnchor="end"
            >
              {maximumTimeUs.toPrecision(4)} μs
            </text>
          </svg>
        </div>
      )}

      <div className="pulse-probability__footer">
        {boundedCursorTimeUs === null ? null : <span>現在 {boundedCursorTimeUs.toFixed(4)} μs</span>}
        {openCursorValue === null ? null : (
          <span>開いた系 {formatPulseProbability(openCursorValue)}</span>
        )}
        {idealCursorValue === null ? null : (
          <span>閉じた系 {formatPulseProbability(idealCursorValue)}</span>
        )}
        {openCursorValue !== null && idealCursorValue !== null ? (
          <span>差 {formatPulseProbability(Math.abs(idealCursorValue - openCursorValue))}</span>
        ) : null}
        {heldCursorValue === null ? null : (
          <span>保持 {formatPulseProbability(heldCursorValue)}</span>
        )}
        {openCursorValue !== null && heldCursorValue !== null ? (
          <span>保持との差 {formatPulseProbability(Math.abs(heldCursorValue - openCursorValue))}</span>
        ) : null}
      </div>
    </section>
  )
}

function seriesPath(
  series: { timeUs: number; value: number }[],
  x: (timeUs: number) => number,
  y: (value: number) => number,
) {
  return series
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.timeUs).toFixed(2)} ${y(point.value).toFixed(2)}`)
    .join(' ')
}
