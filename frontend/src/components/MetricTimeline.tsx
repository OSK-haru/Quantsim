import { useState } from 'react'
import './MetricTimeline.css'
import { SectionHeader } from './SectionHeader'
import type {
  MetricPoint,
  SerializableComplexMatrix,
  StateSnapshot,
} from '../types/simulation'

type MetricTimelineProps = {
  timeline: MetricPoint[]
  stateSnapshots?: StateSnapshot[]
  cursorSimulationTimeUs?: number | null
  fidelityThreshold?: number | null
  effectiveTimeUs?: number | null
  /* 保持した実行の指標。比較表示が切れていれば空。 */
  heldTimeline?: MetricPoint[]
  /* 保持した実行のスナップショット。区間状態変化を出すのに使う。 */
  heldSnapshots?: StateSnapshot[]
}

type StateChangePoint = {
  time_us: number
  value: number
}

const width = 640
const height = 240
const padding = 28
const denseTimelineThreshold = 80
const maxDenseMarkers = 12
/* 保持した実行から重ねられる指標。 */
type HeldMetricKey = 'fidelity' | 'purity' | 'stateChange'
/*
 * 赤いカーソル線の上で読む指標。再生アニメーションと同じ時刻の値を1つだけ
 * 数字で出す。既定はこのページの主指標である忠実度。
 */
type CursorMetricKey = 'fidelity' | 'purity' | 'stateChange'

const cursorMetricLabels: Record<CursorMetricKey, string> = {
  fidelity: '忠実度',
  purity: '純度',
  stateChange: '区間状態変化',
}

/*
 * カーソル時刻の値は、前後のサンプルを線形に結んで読む。点に丸めると
 * 再生中の数字が飛び飛びに見えて、線の上の点と合わなくなる。
 */
function interpolateSeries(
  series: { time_us: number; value: number }[],
  timeUs: number,
): number | null {
  if (series.length === 0) {
    return null
  }
  if (series.length === 1 || timeUs <= series[0].time_us) {
    return series[0].value
  }
  const last = series[series.length - 1]
  if (timeUs >= last.time_us) {
    return last.value
  }
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1]
    const current = series[index]
    if (timeUs <= current.time_us) {
      const span = current.time_us - previous.time_us
      if (span <= 0) {
        return current.value
      }
      const ratio = (timeUs - previous.time_us) / span
      return previous.value + (current.value - previous.value) * ratio
    }
  }
  return last.value
}

function scaleX(timeUs: number, minimumTimeUs: number, maximumTimeUs: number) {
  if (maximumTimeUs <= minimumTimeUs) {
    return padding
  }

  return padding + ((timeUs - minimumTimeUs) * (width - padding * 2))
    / (maximumTimeUs - minimumTimeUs)
}

function scaleY(value: number) {
  const bounded = Math.max(0, Math.min(value, 1))
  return padding + (1 - bounded) * (height - padding * 2)
}

function safeMetric(value: number | null) {
  return value ?? 0
}

function buildMetricPath(
  points: MetricPoint[],
  selector: (point: MetricPoint) => number,
  minimumTimeUs: number,
  maximumTimeUs: number,
) {
  return points
    .map((point, index) => {
      const x = scaleX(point.time_us, minimumTimeUs, maximumTimeUs)
      const y = scaleY(selector(point))
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function buildStateChangePath(
  points: StateChangePoint[],
  minimumTimeUs: number,
  maximumTimeUs: number,
) {
  return points
    .map((point, index) => {
      const x = scaleX(point.time_us, minimumTimeUs, maximumTimeUs)
      const y = scaleY(point.value)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function shouldShowSample(index: number, count: number) {
  if (count <= denseTimelineThreshold) {
    return true
  }

  const interval = Math.max(1, Math.ceil(count / maxDenseMarkers))
  return index === count - 1 || index % interval === 0
}

function stateChangeSeries(snapshots: StateSnapshot[]): StateChangePoint[] {
  if (snapshots.length === 0) {
    return []
  }

  const points: StateChangePoint[] = []
  let previousMatrix: SerializableComplexMatrix | null = null

  snapshots.forEach((snapshot, index) => {
    const matrix = snapshot.density_matrix
    const timeUs = typeof snapshot.time_us === 'number' && Number.isFinite(snapshot.time_us)
      ? snapshot.time_us
      : index
    const distance = previousMatrix === null
      ? 0
      : densityMatrixHilbertSchmidtDistance(previousMatrix, matrix)

    if (distance !== null) {
      points.push({ time_us: timeUs, value: distance })
    }
    previousMatrix = matrix
  })

  return points
}

function densityMatrixHilbertSchmidtDistance(
  left: SerializableComplexMatrix,
  right: SerializableComplexMatrix,
): number | null {
  const dimension = left.real.length
  if (
    dimension === 0
    || right.real.length !== dimension
    || left.imag.length !== dimension
    || right.imag.length !== dimension
  ) {
    return null
  }

  let squaredNorm = 0
  for (let row = 0; row < dimension; row += 1) {
    if (
      left.real[row]?.length !== dimension
      || left.imag[row]?.length !== dimension
      || right.real[row]?.length !== dimension
      || right.imag[row]?.length !== dimension
    ) {
      return null
    }
    for (let column = 0; column < dimension; column += 1) {
      const realDifference = left.real[row][column] - right.real[row][column]
      const imaginaryDifference = left.imag[row][column] - right.imag[row][column]
      if (!Number.isFinite(realDifference) || !Number.isFinite(imaginaryDifference)) {
        return null
      }
      squaredNorm += realDifference ** 2 + imaginaryDifference ** 2
    }
  }

  // Density matrices have a maximum Hilbert-Schmidt distance of sqrt(2).
  return Math.max(0, Math.min(1, Math.sqrt(squaredNorm / 2)))
}

export function MetricTimeline({
  timeline,
  stateSnapshots = [],
  cursorSimulationTimeUs = null,
  fidelityThreshold = null,
  effectiveTimeUs = null,
  heldTimeline = [],
  heldSnapshots = [],
}: MetricTimelineProps) {
  const [selectedHeldMetric, setSelectedHeldMetric] = useState<HeldMetricKey>('fidelity')
  const [selectedCursorMetric, setSelectedCursorMetric] = useState<CursorMetricKey>('fidelity')
  const hasTimeline = timeline.length > 0
  const stateChanges = stateChangeSeries(stateSnapshots)
  const combinedTimes = [
    ...timeline.map((point) => point.time_us),
    ...stateChanges.map((point) => point.time_us),
    ...heldTimeline.map((point) => point.time_us),
    ...stateChangeSeries(heldSnapshots).map((point) => point.time_us),
  ].filter(Number.isFinite)
  const minimumTimeUs = combinedTimes.length > 0 ? Math.min(...combinedTimes) : 0
  const maximumTimeUs = combinedTimes.length > 0 ? Math.max(...combinedTimes) : 1
  const fidelityPath = buildMetricPath(
    timeline,
    (point) => safeMetric(point.fidelity),
    minimumTimeUs,
    maximumTimeUs,
  )
  const purityPath = buildMetricPath(
    timeline,
    (point) => safeMetric(point.purity),
    minimumTimeUs,
    maximumTimeUs,
  )
  /*
   * 保持した実行から重ねる線は、常に1本だけにする。この図はすでに忠実度・純度・
   * 区間状態変化が走っていて、保持側を全部足すと線が倍になって
   * どちらの実行のものか読めなくなる。
   * どの指標を見比べるかは利用者が選ぶ。既定はこのページの主指標である忠実度。
   */
  const heldStateChanges = stateChangeSeries(heldSnapshots)
  /* 保持側で実際に選べる指標だけを出す。中身の無い選択肢は並べない。 */
  const heldMetricOptions: { key: HeldMetricKey; label: string }[] = []
  if (heldTimeline.length > 0) {
    if (heldTimeline.some((point) => point.fidelity !== null)) {
      heldMetricOptions.push({ key: 'fidelity', label: '忠実度' })
    }
    if (heldTimeline.some((point) => point.purity !== null)) {
      heldMetricOptions.push({ key: 'purity', label: '純度' })
    }
  }
  if (heldStateChanges.length > 0) {
    heldMetricOptions.push({ key: 'stateChange', label: '区間状態変化' })
  }
  /* 選んでいた指標が消えたら先頭へ落とす。 */
  const activeHeldMetric = heldMetricOptions.some((option) => option.key === selectedHeldMetric)
    ? selectedHeldMetric
    : heldMetricOptions[0]?.key ?? 'fidelity'
  const activeHeldMetricLabel = heldMetricOptions
    .find((option) => option.key === activeHeldMetric)?.label ?? '忠実度'
  const heldPath = heldMetricOptions.length === 0
    ? ''
    : activeHeldMetric === 'stateChange'
      ? buildStateChangePath(heldStateChanges, minimumTimeUs, maximumTimeUs)
      : buildMetricPath(
          heldTimeline,
          (point) => safeMetric(
            activeHeldMetric === 'purity' ? point.purity : point.fidelity,
          ),
          minimumTimeUs,
          maximumTimeUs,
        )
  const stateChangePath = buildStateChangePath(
    stateChanges,
    minimumTimeUs,
    maximumTimeUs,
  )
  const finalPoint = hasTimeline ? timeline[timeline.length - 1] : null
  const maximumStateChange = stateChanges.reduce(
    (maximum, point) => Math.max(maximum, point.value),
    0,
  )
  /*
   * 読み比べは同じ指標どうしで行う。区間状態変化は最終値ではなく最大値で
   * 読む量なので、そちらを突き合わせる。
   */
  const currentFinalValue = heldMetricOptions.length === 0
    ? null
    : activeHeldMetric === 'stateChange'
      ? maximumStateChange
      : finalPoint === null
        ? null
        : safeMetric(activeHeldMetric === 'purity' ? finalPoint.purity : finalPoint.fidelity)
  const heldFinalPoint = heldTimeline.length > 0 ? heldTimeline[heldTimeline.length - 1] : null
  const heldFinalValue = heldMetricOptions.length === 0
    ? null
    : activeHeldMetric === 'stateChange'
      ? heldStateChanges.reduce((maximum, point) => Math.max(maximum, point.value), 0)
      : heldFinalPoint === null
        ? null
        : safeMetric(activeHeldMetric === 'purity' ? heldFinalPoint.purity : heldFinalPoint.fidelity)
  const isDense = timeline.length > denseTimelineThreshold
  const resolvedFidelityThreshold = typeof fidelityThreshold === 'number'
    && Number.isFinite(fidelityThreshold)
    && fidelityThreshold >= 0
    && fidelityThreshold <= 1
    ? fidelityThreshold
    : null
  const thresholdY = resolvedFidelityThreshold === null
    ? null
    : scaleY(resolvedFidelityThreshold)
  const firstThresholdCrossing = resolvedFidelityThreshold === null
    ? undefined
    : timeline.find((point) => (
        point.fidelity !== null && point.fidelity < resolvedFidelityThreshold
      ))
  const reportedEffectiveTimeUs = typeof effectiveTimeUs === 'number'
    && Number.isFinite(effectiveTimeUs)
    ? effectiveTimeUs
    : null
  const displayedEffectiveTimeUs = firstThresholdCrossing
    ? reportedEffectiveTimeUs ?? firstThresholdCrossing.time_us
    : null
  const clampedCursorTimeUs = cursorSimulationTimeUs === null
    ? null
    : Math.min(maximumTimeUs, Math.max(minimumTimeUs, cursorSimulationTimeUs))
  const cursorX = clampedCursorTimeUs === null
    ? null
    : scaleX(clampedCursorTimeUs, minimumTimeUs, maximumTimeUs)
  /* カーソルで読める指標だけを並べる。中身の無い選択肢は出さない。 */
  const cursorMetricOptions: CursorMetricKey[] = []
  if (timeline.some((point) => point.fidelity !== null)) {
    cursorMetricOptions.push('fidelity')
  }
  if (timeline.some((point) => point.purity !== null)) {
    cursorMetricOptions.push('purity')
  }
  if (stateChanges.length > 0) {
    cursorMetricOptions.push('stateChange')
  }
  /* 選んでいた指標が消えたら、忠実度（既定）か先頭へ落とす。 */
  const activeCursorMetric = cursorMetricOptions.includes(selectedCursorMetric)
    ? selectedCursorMetric
    : cursorMetricOptions[0] ?? 'fidelity'
  const cursorSeries = activeCursorMetric === 'stateChange'
    ? stateChanges
    : timeline.map((point) => ({
        time_us: point.time_us,
        value: safeMetric(activeCursorMetric === 'purity' ? point.purity : point.fidelity),
      }))
  const cursorValue = clampedCursorTimeUs === null
    ? null
    : interpolateSeries(cursorSeries, clampedCursorTimeUs)
  const cursorValueY = cursorValue === null ? null : scaleY(cursorValue)

  return (
    <section
      className="metric-timeline"
      aria-label="指標のタイムライン"
      data-tutorial-anchor="metric-timeline"
    >
      <div className="metric-timeline__header">
        <SectionHeader icon="chart" eyebrow="タイムライン" title="指標のタイムライン" />
        <div className="metric-timeline__legend">
          <span className="metric-timeline__legend-item">
            <span className="metric-timeline__swatch metric-timeline__swatch--fidelity" />
            理想状態への忠実度
          </span>
          <span className="metric-timeline__legend-item">
            <span className="metric-timeline__swatch metric-timeline__swatch--purity" />
            純度
          </span>
          {stateChanges.length > 0 ? (
            <span className="metric-timeline__legend-item metric-timeline__legend-item--state-change">
              <span className="metric-timeline__swatch metric-timeline__swatch--state-change" />
              区間状態変化
            </span>
          ) : null}
          {cursorMetricOptions.length > 0 ? (
            <label className="metric-timeline__legend-item metric-timeline__cursor-selector">
              <span className="metric-timeline__swatch metric-timeline__swatch--cursor" />
              赤線で読む
              <select
                value={activeCursorMetric}
                onChange={(event) => (
                  setSelectedCursorMetric(event.target.value as CursorMetricKey)
                )}
                aria-label="赤いカーソル線で読む指標"
              >
                {cursorMetricOptions.map((key) => (
                  <option key={key} value={key}>{cursorMetricLabels[key]}</option>
                ))}
              </select>
            </label>
          ) : null}
          {heldMetricOptions.length > 0 ? (
            <label className="metric-timeline__legend-item metric-timeline__held-selector">
              <span className="metric-timeline__swatch metric-timeline__swatch--held" />
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

      {hasTimeline ? (
        <>
          <svg
            className="metric-timeline__chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="時間経過による忠実度、純度、スナップショット間の状態変化"
          >
            <defs>
              <linearGradient id="fidelityGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="var(--metric-fidelity-start)" />
                <stop offset="100%" stopColor="var(--metric-fidelity-end)" />
              </linearGradient>
              <linearGradient id="purityGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="var(--metric-purity-start)" />
                <stop offset="100%" stopColor="var(--metric-purity-end)" />
              </linearGradient>
            </defs>

            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="metric-timeline__axis" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="metric-timeline__axis" />

            {thresholdY === null || resolvedFidelityThreshold === null ? null : (
              <g className="metric-timeline__threshold">
                <title>{`忠実度のしきい値 ${resolvedFidelityThreshold.toFixed(3)}`}</title>
                <line x1={padding} y1={thresholdY} x2={width - padding} y2={thresholdY} />
                <text
                  x={padding + 8}
                  y={Math.min(height - padding - 4, thresholdY + 14)}
                  textAnchor="start"
                >
                  {`しきい値 ${resolvedFidelityThreshold.toFixed(3)}`}
                </text>
              </g>
            )}

            {heldPath === '' ? null : (
              <path d={heldPath} className="metric-timeline__line metric-timeline__line--held" />
            )}
            <path d={fidelityPath} className="metric-timeline__line metric-timeline__line--fidelity" />
            <path d={purityPath} className="metric-timeline__line metric-timeline__line--purity" />
            {stateChanges.length > 0 ? (
              <path d={stateChangePath} className="metric-timeline__line metric-timeline__line--state-change" />
            ) : null}
            {cursorX === null ? null : (
              <g
                className="metric-timeline__cursor"
                aria-label={cursorValue === null
                  ? `現在 ${cursorSimulationTimeUs?.toFixed(4)} マイクロ秒`
                  : `現在 ${cursorSimulationTimeUs?.toFixed(4)} マイクロ秒、`
                    + `${cursorMetricLabels[activeCursorMetric]} ${cursorValue.toFixed(4)}`}
              >
                <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} />
                <circle cx={cursorX} cy={padding} r="4" />
                {cursorValueY === null || cursorValue === null ? null : (
                  <>
                    <circle
                      cx={cursorX}
                      cy={cursorValueY}
                      r="5"
                      className="metric-timeline__cursor-marker"
                    />
                    <text
                      x={cursorX + (cursorX > width / 2 ? -8 : 8)}
                      y={Math.max(padding + 12, Math.min(height - padding - 6, cursorValueY - 9))}
                      textAnchor={cursorX > width / 2 ? 'end' : 'start'}
                      className="metric-timeline__cursor-readout"
                    >
                      {`${cursorMetricLabels[activeCursorMetric]} ${cursorValue.toFixed(4)}`}
                    </text>
                  </>
                )}
              </g>
            )}

            {timeline.map((point, index) => {
              if (isDense && !shouldShowSample(index, timeline.length)) {
                return null
              }

              const x = scaleX(point.time_us, minimumTimeUs, maximumTimeUs)
              const fidelityY = scaleY(safeMetric(point.fidelity))
              const purityY = scaleY(safeMetric(point.purity))

              return (
                <g key={`${point.time_us}-${index}`}>
                  <circle cx={x} cy={fidelityY} r={isDense ? 3 : 4} className="metric-timeline__dot metric-timeline__dot--fidelity" />
                  <circle cx={x} cy={purityY} r={isDense ? 3 : 4} className="metric-timeline__dot metric-timeline__dot--purity" />
                  {!isDense ? (
                    <text x={x} y={height - 8} textAnchor="middle" className="metric-timeline__time-label">
                      {point.time_us}us
                    </text>
                  ) : null}
                </g>
              )
            })}
            {stateChanges.map((point, index) => (
              <circle
                key={`state-change-${point.time_us}-${index}`}
                cx={scaleX(point.time_us, minimumTimeUs, maximumTimeUs)}
                cy={scaleY(point.value)}
                r="3.5"
                className="metric-timeline__dot metric-timeline__dot--state-change"
              />
            ))}
          </svg>

          <div className="metric-timeline__summary">
            <article className="metric-timeline__value-card">
              <span className="metric-timeline__label">最終忠実度</span>
              <strong className="metric-timeline__value">
                {finalPoint ? safeMetric(finalPoint.fidelity).toFixed(4) : '利用できません'}
              </strong>
            </article>
            <article className="metric-timeline__value-card">
              <span className="metric-timeline__label">最終純度</span>
              <strong className="metric-timeline__value">
                {finalPoint ? safeMetric(finalPoint.purity).toFixed(4) : '利用できません'}
              </strong>
            </article>
            {resolvedFidelityThreshold !== null ? (
              <article className="metric-timeline__value-card metric-timeline__value-card--effective-time">
                <span className="metric-timeline__label">有効操作時間</span>
                <strong className="metric-timeline__value">
                  {displayedEffectiveTimeUs === null
                    ? '観測区間では未到達'
                    : `${displayedEffectiveTimeUs.toFixed(4)} μs`}
                </strong>
                <small>忠実度が {resolvedFidelityThreshold.toFixed(3)} を下回る時刻</small>
              </article>
            ) : null}
            {stateChanges.length > 0 ? (
              <article className="metric-timeline__value-card">
                <span className="metric-timeline__label">最大区間状態変化</span>
                <strong className="metric-timeline__value">{maximumStateChange.toFixed(4)}</strong>
              </article>
            ) : null}
            {cursorValue === null || clampedCursorTimeUs === null ? null : (
              <article className="metric-timeline__value-card metric-timeline__value-card--cursor">
                <span className="metric-timeline__label">
                  カーソル時刻の{cursorMetricLabels[activeCursorMetric]}
                </span>
                <strong className="metric-timeline__value">{cursorValue.toFixed(4)}</strong>
                <small>{clampedCursorTimeUs.toFixed(4)} μs</small>
              </article>
            )}
            {heldFinalValue === null || currentFinalValue === null ? null : (
              <article className="metric-timeline__value-card metric-timeline__value-card--held">
                <span className="metric-timeline__label">保持した実行の{activeHeldMetricLabel}</span>
                <strong className="metric-timeline__value">{heldFinalValue.toFixed(4)}</strong>
                <small>
                  現在 {currentFinalValue.toFixed(4)}
                  （差 {Math.abs(heldFinalValue - currentFinalValue).toFixed(4)}）
                </small>
              </article>
            )}
          </div>
        </>
      ) : (
        <p className="metric-timeline__empty">この実行ではタイムラインデータが返されませんでした。</p>
      )}
    </section>
  )
}
