import { useMemo, useState } from 'react'
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
  /* 保持した実行。比較表示が切れていれば null。 */
  heldView?: PulseExplorerView | null
}

/* 保持した実行から重ねられる指標。 */
type HeldMetricKey = 'purity' | 'reference' | 'leakage' | 'stateChange'

/*
 * 赤いカーソル線の上で読む指標。再生アニメーションと同じ時刻の値を1つだけ
 * 数字で出す。既定は忠実度にあたる参照値（無ければ純度）。
 */
type CursorMetricKey = 'reference' | 'purity' | 'leakage' | 'stateChange'

/*
 * カーソル時刻の値は、前後のサンプルを線形に結んで読む。最近傍に丸めると
 * 再生中の数字が飛び飛びに見えて、線の上の点と合わなくなる。
 */
function interpolateSeries(
  series: { timeUs: number; value: number }[],
  timeUs: number,
): number | null {
  if (series.length === 0) {
    return null
  }
  if (series.length === 1 || timeUs <= series[0].timeUs) {
    return series[0].value
  }
  const last = series[series.length - 1]
  if (timeUs >= last.timeUs) {
    return last.value
  }
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1]
    const current = series[index]
    if (timeUs <= current.timeUs) {
      const span = current.timeUs - previous.timeUs
      if (span <= 0) {
        return current.value
      }
      const ratio = (timeUs - previous.timeUs) / span
      return previous.value + (current.value - previous.value) * ratio
    }
  }
  return last.value
}

function heldMetricValue(point: PulseExplorerPoint, metric: HeldMetricKey): number {
  if (metric === 'reference') {
    return point.reference ?? 0
  }
  if (metric === 'leakage') {
    return point.leakage ?? 0
  }
  return point.purity
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
export function PulseMetricTimeline({
  view,
  cursorTimeUs,
  heldView = null,
}: PulseMetricTimelineProps) {
  const points = view.points
  const stateChanges = useMemo(() => pulseStateChangeSeries(points), [points])
  const [selectedHeldMetric, setSelectedHeldMetric] = useState<HeldMetricKey>('purity')
  const [selectedCursorMetric, setSelectedCursorMetric] = useState<CursorMetricKey>('reference')
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
  /*
   * 保持した実行から重ねる線は、常に1本だけにする。この図はすでに純度・参照値・
   * リーケージ・区間状態変化が走っていて、保持側を全部足すと線が倍になって
   * どちらの実行のものか読めなくなる。
   * どの指標を見比べるかは利用者が選ぶ。既定は純度（どのモデルでも必ず返り、
   * 環境の効き方がいちばん素直に出る量）。
   */
  /* ?? [] を直に書くと毎描画で別の配列になり、下の useMemo が効かなくなる。 */
  const heldPoints = useMemo(() => heldView?.points ?? [], [heldView])
  const heldStateChanges = useMemo(() => pulseStateChangeSeries(heldPoints), [heldPoints])
  /* 保持側で実際に選べる指標だけを出す。中身の無い選択肢は並べない。 */
  const heldMetricOptions = useMemo(() => {
    if (heldPoints.length === 0) {
      return [] as { key: HeldMetricKey; label: string }[]
    }
    const options: { key: HeldMetricKey; label: string }[] = [
      { key: 'purity', label: '純度' },
    ]
    if (hasReference && heldPoints.some((point) => point.reference !== null)) {
      options.push({ key: 'reference', label: view.referenceLabel ?? '参照値' })
    }
    if (hasLeakage && heldPoints.some((point) => point.leakage !== null)) {
      options.push({ key: 'leakage', label: view.leakageLabel ?? 'リーケージ' })
    }
    if (heldStateChanges.length > 0) {
      options.push({ key: 'stateChange', label: '区間状態変化' })
    }
    return options
  }, [heldPoints, hasReference, hasLeakage, view.referenceLabel, view.leakageLabel, heldStateChanges])
  /* 選んでいた指標がモデル変更で消えたら、先頭（純度）へ落とす。 */
  const activeHeldMetric = heldMetricOptions.some((option) => option.key === selectedHeldMetric)
    ? selectedHeldMetric
    : heldMetricOptions[0]?.key ?? 'purity'
  const activeHeldMetricLabel = heldMetricOptions
    .find((option) => option.key === activeHeldMetric)?.label ?? '純度'
  const heldPath = heldPoints.length === 0
    ? ''
    : activeHeldMetric === 'stateChange'
      ? heldStateChanges
          .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.timeUs)} ${y(point.value)}`)
          .join(' ')
      : metricPath(heldPoints, (point) => heldMetricValue(point, activeHeldMetric), x, y)
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
  const clampedCursorTimeUs = cursorTimeUs === null
    ? null
    : Math.min(maximumTimeUs, Math.max(minimumTimeUs, cursorTimeUs))
  const cursorX = clampedCursorTimeUs === null ? null : x(clampedCursorTimeUs)
  const cursorPoint = cursorTimeUs === null ? null : nearestPoint(points, cursorTimeUs)
  /* カーソルで読める指標だけを並べる。中身の無い選択肢は出さない。 */
  const cursorMetricOptions: { key: CursorMetricKey; label: string }[] = []
  if (hasReference) {
    cursorMetricOptions.push({ key: 'reference', label: view.referenceLabel ?? '参照値' })
  }
  cursorMetricOptions.push({ key: 'purity', label: '純度' })
  if (hasLeakage) {
    cursorMetricOptions.push({ key: 'leakage', label: view.leakageLabel ?? 'リーケージ' })
  }
  if (stateChanges.length > 0) {
    cursorMetricOptions.push({ key: 'stateChange', label: '区間状態変化' })
  }
  /* 選んでいた指標がモデル変更で消えたら、先頭（参照値、無ければ純度）へ落とす。 */
  const activeCursorMetric = cursorMetricOptions.some((option) => (
    option.key === selectedCursorMetric
  ))
    ? selectedCursorMetric
    : cursorMetricOptions[0]?.key ?? 'purity'
  const activeCursorMetricLabel = cursorMetricOptions
    .find((option) => option.key === activeCursorMetric)?.label ?? '純度'
  const cursorSeries = activeCursorMetric === 'stateChange'
    ? stateChanges.map((point) => ({ timeUs: point.timeUs, value: point.value }))
    : points
        .map((point) => ({
          timeUs: point.timeUs,
          value: activeCursorMetric === 'reference'
            ? point.reference
            : activeCursorMetric === 'leakage'
              ? point.leakage
              : point.purity,
        }))
        .filter((entry): entry is { timeUs: number; value: number } => (
          entry.value !== null && Number.isFinite(entry.value)
        ))
  const cursorValue = clampedCursorTimeUs === null
    ? null
    : interpolateSeries(cursorSeries, clampedCursorTimeUs)
  const cursorValueY = cursorValue === null ? null : y(cursorValue)
  /* 保持側は点の並びが違うので、時刻から引き直す。 */
  const heldCursorPoint = cursorTimeUs === null || heldPoints.length === 0
    ? null
    : nearestPoint(heldPoints, cursorTimeUs)
  /*
   * 読み比べは同じ指標どうしで行う。区間状態変化は点ごとの量ではなく
   * 隣り合う密度行列の距離なので、カーソル値の比較には出さない。
   */
  const comparableAtCursor = activeHeldMetric !== 'stateChange'
    && cursorPoint !== null
    && heldCursorPoint !== null
  const currentMetricValue = comparableAtCursor && cursorPoint !== null
    ? heldMetricValue(cursorPoint, activeHeldMetric)
    : null
  const heldMetricValueAtCursor = comparableAtCursor && heldCursorPoint !== null
    ? heldMetricValue(heldCursorPoint, activeHeldMetric)
    : null

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
          <label className="pulse-metric-timeline__legend-item pulse-metric-timeline__cursor-selector">
            <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--cursor" />
            赤線で読む
            <select
              value={activeCursorMetric}
              onChange={(event) => setSelectedCursorMetric(event.target.value as CursorMetricKey)}
              aria-label="赤いカーソル線で読む指標"
            >
              {cursorMetricOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          {heldMetricOptions.length > 0 ? (
            <label className="pulse-metric-timeline__legend-item pulse-metric-timeline__held-selector">
              <span className="pulse-metric-timeline__swatch pulse-metric-timeline__swatch--held" />
              保持した実行の
              <select
                value={activeHeldMetric}
                onChange={(event) => setSelectedHeldMetric(event.target.value as HeldMetricKey)}
                aria-label="保持した実行から重ねる指標"
              >
                {heldMetricOptions.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
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

            {heldPath === '' ? null : (
              <path
                d={heldPath}
                className="pulse-metric-timeline__line pulse-metric-timeline__line--held"
              />
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
                aria-label={cursorValue === null
                  ? `現在 ${cursorTimeUs?.toFixed(4)} マイクロ秒`
                  : `現在 ${cursorTimeUs?.toFixed(4)} マイクロ秒、`
                    + `${activeCursorMetricLabel} ${cursorValue.toFixed(4)}`}
              >
                <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} />
                <circle cx={cursorX} cy={padding} r="4" />
                {cursorValueY === null || cursorValue === null ? null : (
                  <>
                    <circle
                      cx={cursorX}
                      cy={cursorValueY}
                      r="5"
                      className="pulse-metric-timeline__cursor-marker"
                    />
                    <text
                      x={cursorX + (cursorX > width / 2 ? -8 : 8)}
                      y={Math.max(padding + 12, Math.min(height - padding - 6, cursorValueY - 9))}
                      textAnchor={cursorX > width / 2 ? 'end' : 'start'}
                      className="pulse-metric-timeline__cursor-readout"
                    >
                      {`${activeCursorMetricLabel} ${cursorValue.toFixed(4)}`}
                    </text>
                  </>
                )}
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
            {cursorPoint === null || clampedCursorTimeUs === null ? null : (
              <article className="pulse-metric-timeline__value-card pulse-metric-timeline__value-card--cursor">
                <span className="pulse-metric-timeline__label">
                  カーソル時刻の{activeCursorMetricLabel}
                </span>
                <strong className="pulse-metric-timeline__value">
                  {cursorValue === null ? '利用できません' : cursorValue.toFixed(6)}
                </strong>
                <small>{clampedCursorTimeUs.toFixed(4)} μs</small>
                {currentMetricValue === null || heldMetricValueAtCursor === null ? null : (
                  <small>
                    {activeHeldMetricLabel}：現在 {currentMetricValue.toFixed(6)} ／
                    保持 {heldMetricValueAtCursor.toFixed(6)}
                    （差 {Math.abs(heldMetricValueAtCursor - currentMetricValue).toFixed(6)}）
                  </small>
                )}
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
