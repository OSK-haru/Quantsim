import './MetricTimeline.css'
import { SectionHeader } from './SectionHeader'
import type {
  MetricPoint,
  SerializableComplexMatrix,
  StateSnapshot,
} from '../types/simulation'

type MetricTimelineProps = {
  timeline: MetricPoint[]
  idealTimeline?: MetricPoint[]
  stateSnapshots?: StateSnapshot[]
  cursorSimulationTimeUs?: number | null
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
const unchangedTolerance = 1e-6

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
  idealTimeline = [],
  stateSnapshots = [],
  cursorSimulationTimeUs = null,
}: MetricTimelineProps) {
  const hasTimeline = timeline.length > 0
  const stateChanges = stateChangeSeries(stateSnapshots)
  const combinedTimes = [
    ...timeline.map((point) => point.time_us),
    ...idealTimeline.map((point) => point.time_us),
    ...stateChanges.map((point) => point.time_us),
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
  const idealPath = buildMetricPath(
    idealTimeline,
    (point) => safeMetric(point.fidelity),
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
  const isDense = timeline.length > denseTimelineThreshold
  const cursorX = cursorSimulationTimeUs === null
    ? null
    : scaleX(
        Math.min(maximumTimeUs, Math.max(minimumTimeUs, cursorSimulationTimeUs)),
        minimumTimeUs,
        maximumTimeUs,
      )

  return (
    <section className="metric-timeline" aria-label="指標のタイムライン">
      <div className="metric-timeline__header">
        <SectionHeader icon="chart" eyebrow="タイムライン" title="指標のタイムライン" />
        <div className="metric-timeline__legend">
          <span className="metric-timeline__legend-item">
            <span className="metric-timeline__swatch metric-timeline__swatch--fidelity" />
            理想状態への忠実度
          </span>
          {idealTimeline.length > 0 ? (
            <span className="metric-timeline__legend-item metric-timeline__legend-item--ideal">
              <span className="metric-timeline__swatch metric-timeline__swatch--ideal" />
              ノイズなし
            </span>
          ) : null}
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
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#93c5fd" />
              </linearGradient>
              <linearGradient id="purityGradient" x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#6ee7b7" />
              </linearGradient>
            </defs>

            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="metric-timeline__axis" />
            <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="metric-timeline__axis" />

            <path d={fidelityPath} className="metric-timeline__line metric-timeline__line--fidelity" />
            <path d={purityPath} className="metric-timeline__line metric-timeline__line--purity" />
            {idealTimeline.length > 0 ? (
              <path d={idealPath} className="metric-timeline__ideal-line" />
            ) : null}
            {stateChanges.length > 0 ? (
              <path d={stateChangePath} className="metric-timeline__line metric-timeline__line--state-change" />
            ) : null}
            {cursorX === null ? null : (
              <g className="metric-timeline__cursor" aria-label={`現在 ${cursorSimulationTimeUs?.toFixed(4)} マイクロ秒`}>
                <line x1={cursorX} y1={padding} x2={cursorX} y2={height - padding} />
                <circle cx={cursorX} cy={padding} r="4" />
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

          {stateChanges.length > 0 ? (
            <p className="metric-timeline__interpretation">
              忠実度と純度はノイズによる劣化を見る指標なので、ゲートが状態を正しく変えても1付近を保ちます。
              オレンジ線は隣り合う保存スナップショットの密度行列差です。
              {maximumStateChange <= unchangedTolerance
                ? ' 今回は観測可能な状態変化がありません。RZは|0⟩/|1⟩だけには確率変化を起こさず、CCXは両方の制御が|1⟩の成分だけを反転します。'
                : ''}
            </p>
          ) : null}

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
            {stateChanges.length > 0 ? (
              <article className="metric-timeline__value-card">
                <span className="metric-timeline__label">最大区間状態変化</span>
                <strong className="metric-timeline__value">{maximumStateChange.toFixed(4)}</strong>
              </article>
            ) : null}
          </div>
        </>
      ) : (
        <p className="metric-timeline__empty">この実行ではタイムラインデータが返されませんでした。</p>
      )}
    </section>
  )
}
