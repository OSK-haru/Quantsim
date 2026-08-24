import { useMemo } from 'react'
import './PulseMetricTimeline.css'
import { SectionHeader } from './SectionHeader'
import {
  pulseStateChangeSeries,
  type PulseExplorerPoint,
  type PulseExplorerView,
} from '../utils/pulseStateExplorer'

type PulseMetricTimelineProps = {
  view: PulseExplorerView
  cursorTimeUs: number | null
}

const width = 640
const height = 240
const padding = 28
const denseTimelineThreshold = 80
const maxDenseMarkers = 12

/*
 * Gate-aware の指標タイムラインと同じ読み方をPulseへ移した図。
 * 純度と参照値（忠実度または目標との重なり）を主線に、
 * Pulse固有のリーケージと、区間ごとの密度行列の動きを重ねる。
 */
export function PulseMetricTimeline({ view, cursorTimeUs }: PulseMetricTimelineProps) {
  const points = view.points
  const stateChanges = useMemo(() => pulseStateChangeSeries(points), [points])
  const minimumTimeUs = points[0]?.timeUs ?? 0
  const maximumTimeUs = Math.max(points.at(-1)?.timeUs ?? 1, minimumTimeUs + 1e-12)
  const x = (timeUs: number) => (
    padding + ((timeUs - minimumTimeUs) * (width - padding * 2)) / (maximumTimeUs - minimumTimeUs)
  )
  const y = (value: number) => (
    padding + (1 - Math.max(0, Math.min(1, value))) * (height - padding * 2)
  )
  const hasReference = view.referenceLabel !== null
    && points.some((point) => point.reference !== null)
  const hasLeakage = view.leakageLabel !== null
    && points.some((point) => point.leakage !== null)
  const purityPath = metricPath(points, (point) => point.purity, x, y)
  const referencePath = metricPath(points, (point) => point.reference, x, y)
  const leakagePath = metricPath(points, (point) => point.leakage, x, y)
  const stateChangePath = stateChanges
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.timeUs)} ${y(point.value)}`)
    .join(' ')
  const finalPoint = points.at(-1) ?? null
  const pulseEndPoint = nearestPoint(points, view.pulseEndTimeUs)
  const maximumLeakage = points.reduce(
    (maximum, point) => Math.max(maximum, point.leakage ?? 0),
    0,
  )
  const maximumStateChange = stateChanges.reduce(
    (maximum, point) => Math.max(maximum, point.value),
    0,
  )
  const isDense = points.length > denseTimelineThreshold
  const pulseEndX = view.pulseEndTimeUs > minimumTimeUs && view.pulseEndTimeUs < maximumTimeUs
    ? x(view.pulseEndTimeUs)
    : null
  const cursorX = cursorTimeUs === null
    ? null
    : x(Math.min(maximumTimeUs, Math.max(minimumTimeUs, cursorTimeUs)))
  const cursorPoint = cursorTimeUs === null ? null : nearestPoint(points, cursorTimeUs)

  return (
    <section className="pulse-metric-timeline" aria-label="Pulseの指標タイムライン">
      <div className="pulse-metric-timeline__header">
        <SectionHeader icon="chart" eyebrow="タイムライン" title="指標のタイムライン" />
        <div className="pulse-metric-timeline__legend">
          <span className="pulse-metric-timeline__legend-item">
            <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--purity" />
            純度
          </span>
          {hasReference ? (
            <span className="pulse-metric-timeline__legend-item">
              <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--reference" />
              {view.referenceLabel}
            </span>
          ) : null}
          {hasLeakage ? (
            <span className="pulse-metric-timeline__legend-item pulse-metric-timeline__legend-item--leakage">
              <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--leakage" />
              {view.leakageLabel}
            </span>
          ) : null}
          {stateChanges.length > 0 ? (
            <span className="pulse-metric-timeline__legend-item">
              <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--state-change" />
              区間状態変化
            </span>
          ) : null}
        </div>
      </div>

      {points.length === 0 ? (
        <p className="pulse-metric-timeline__empty">この実行では軌跡データが返されませんでした。</p>
      ) : (
        <>
          <svg
            className="pulse-metric-timeline__chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="時間経過による純度、参照値、リーケージ、区間状態変化"
          >
            {[0, 0.5, 1].map((tick) => (
              <g key={tick}>
                <line
                  className="pulse-metric-timeline__grid"
                  x1={padding}
                  x2={width - padding}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text
                  className="pulse-metric-timeline__tick"
                  x={padding - 6}
                  y={y(tick) + 4}
                  textAnchor="end"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}
            <line
              className="pulse-metric-timeline__axis"
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
            />
            <line
              className="pulse-metric-timeline__axis"
              x1={padding}
              y1={padding}
              x2={padding}
              y2={height - padding}
            />

            {pulseEndX === null ? null : (
              <g className="pulse-metric-timeline__pulse-end">
                <title>{`Pulse終了 ${view.pulseEndTimeUs.toFixed(4)} μs`}</title>
                <line x1={pulseEndX} y1={padding} x2={pulseEndX} y2={height - padding} />
                <text x={pulseEndX + 5} y={padding + 11}>PULSE END</text>
              </g>
            )}

            <path d={purityPath} className="pulse-metric-timeline__line pulse-metric-timeline__line--purity" />
            {hasReference ? (
              <path d={referencePath} className="pulse-metric-timeline__line pulse-metric-timeline__line--reference" />
            ) : null}
            {hasLeakage ? (
              <path d={leakagePath} className="pulse-metric-timeline__line pulse-metric-timeline__line--leakage" />
            ) : null}
            {stateChanges.length > 0 ? (
              <path d={stateChangePath} className="pulse-metric-timeline__line pulse-metric-timeline__line--state-change" />
            ) : null}

            {points.map((point, index) => {
              if (isDense && !shouldShowSample(index, points.length)) {
                return null
              }
              return (
                <circle
                  key={`purity-${index}`}
                  cx={x(point.timeUs)}
                  cy={y(point.purity)}
                  r={isDense ? 2.5 : 3.5}
                  className="pulse-metric-timeline__dot pulse-metric-timeline__dot--purity"
                />
              )
            })}

            {cursorX === null ? null : (
              <g
                className="pulse-metric-timeline__cursor"
                aria-label={`現在 ${cursorTimeUs?.toFixed(4)} マイクロ秒`}
              >
                <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} />
                <circle cx={cursorX} cy={padding} r="4" />
              </g>
            )}

            <text className="pulse-metric-timeline__tick" x={padding} y={height - 8}>
              {minimumTimeUs.toPrecision(3)} μs
            </text>
            <text
              className="pulse-metric-timeline__tick"
              x={width - padding}
              y={height - 8}
              textAnchor="end"
            >
              {maximumTimeUs.toPrecision(3)} μs
            </text>
          </svg>

          <p className="pulse-metric-timeline__interpretation">
            純度は状態がどれだけ混ざったかを表し、環境との結合がなければ1のままです。
            {hasLeakage
              ? ' リーケージは計算部分空間の外へ出た確率で、正規化によって隠されることはありません。'
              : ''}
            {stateChanges.length > 0
              ? ' 破線は隣り合うサンプル間の密度行列の距離で、Pulseが状態を動かしている区間ほど大きくなります。'
              : ''}
          </p>

          <div className="pulse-metric-timeline__summary">
            <article className="pulse-metric-timeline__value-card">
              <span className="pulse-metric-timeline__label">Pulse終了時の純度</span>
              <strong className="pulse-metric-timeline__value">
                {pulseEndPoint ? pulseEndPoint.purity.toFixed(6) : '利用できません'}
              </strong>
            </article>
            <article className="pulse-metric-timeline__value-card">
              <span className="pulse-metric-timeline__label">最終純度</span>
              <strong className="pulse-metric-timeline__value">
                {finalPoint ? finalPoint.purity.toFixed(6) : '利用できません'}
              </strong>
            </article>
            {hasReference ? (
              <article className="pulse-metric-timeline__value-card">
                <span className="pulse-metric-timeline__label">最終{view.referenceLabel}</span>
                <strong className="pulse-metric-timeline__value">
                  {finalPoint?.reference === null || finalPoint === null
                    ? 'N/A'
                    : finalPoint.reference.toFixed(6)}
                </strong>
              </article>
            ) : null}
            {hasLeakage ? (
              <article className="pulse-metric-timeline__value-card pulse-metric-timeline__value-card--leakage">
                <span className="pulse-metric-timeline__label">最大{view.leakageLabel}</span>
                <strong className="pulse-metric-timeline__value">{maximumLeakage.toFixed(6)}</strong>
                <small>観測区間で記録された最大値</small>
              </article>
            ) : null}
            {stateChanges.length > 0 ? (
              <article className="pulse-metric-timeline__value-card">
                <span className="pulse-metric-timeline__label">最大区間状態変化</span>
                <strong className="pulse-metric-timeline__value">{maximumStateChange.toFixed(6)}</strong>
              </article>
            ) : null}
            {cursorPoint === null ? null : (
              <article className="pulse-metric-timeline__value-card pulse-metric-timeline__value-card--cursor">
                <span className="pulse-metric-timeline__label">カーソル時刻の純度</span>
                <strong className="pulse-metric-timeline__value">{cursorPoint.purity.toFixed(6)}</strong>
                <small>{cursorPoint.timeUs.toFixed(4)} μs</small>
              </article>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function metricPath(
  points: PulseExplorerPoint[],
  selector: (point: PulseExplorerPoint) => number | null,
  x: (timeUs: number) => number,
  y: (value: number) => number,
) {
  let started = false
  return points
    .map((point) => {
      const value = selector(point)
      if (value === null || !Number.isFinite(value)) {
        started = false
        return ''
      }
      const command = started ? 'L' : 'M'
      started = true
      return `${command} ${x(point.timeUs)} ${y(value)}`
    })
    .filter((segment) => segment !== '')
    .join(' ')
}

function nearestPoint(points: PulseExplorerPoint[], timeUs: number): PulseExplorerPoint | null {
  if (points.length === 0) {
    return null
  }
  return points.reduce((best, point) => (
    Math.abs(point.timeUs - timeUs) < Math.abs(best.timeUs - timeUs) ? point : best
  ), points[0])
}

function shouldShowSample(index: number, count: number) {
  if (count <= denseTimelineThreshold) {
    return true
  }
  const interval = Math.max(1, Math.ceil(count / maxDenseMarkers))
  return index === count - 1 || index % interval === 0
}
