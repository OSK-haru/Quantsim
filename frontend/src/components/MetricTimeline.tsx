import './MetricTimeline.css'
import type { MetricPoint } from '../types/simulation'

type MetricTimelineProps = {
  timeline: MetricPoint[]
}

const width = 640
const height = 240
const padding = 28

function scaleX(index: number, count: number) {
  if (count <= 1) {
    return padding
  }

  return padding + (index * (width - padding * 2)) / (count - 1)
}

function scaleY(value: number) {
  const bounded = Math.max(0, Math.min(value, 1))
  return padding + (1 - bounded) * (height - padding * 2)
}

function safeMetric(value: number | null) {
  return value ?? 0
}

function buildPath(points: MetricPoint[], selector: (point: MetricPoint) => number) {
  return points
    .map((point, index) => {
      const x = scaleX(index, points.length)
      const y = scaleY(selector(point))
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

export function MetricTimeline({ timeline }: MetricTimelineProps) {
  const fidelityPath = buildPath(timeline, (point) => safeMetric(point.fidelity))
  const purityPath = buildPath(timeline, (point) => safeMetric(point.purity))
  const finalPoint = timeline[timeline.length - 1]

  return (
    <section className="metric-timeline" aria-label="Metric timeline">
      <div className="metric-timeline__header">
        <div>
          <div className="metric-timeline__eyebrow">Timeline</div>
          <h2 className="metric-timeline__title">Metric timeline</h2>
        </div>
        <div className="metric-timeline__legend">
          <span className="metric-timeline__legend-item">
            <span className="metric-timeline__swatch metric-timeline__swatch--fidelity" />
            Fidelity
          </span>
          <span className="metric-timeline__legend-item">
            <span className="metric-timeline__swatch metric-timeline__swatch--purity" />
            Purity
          </span>
        </div>
      </div>

      <svg
        className="metric-timeline__chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Line chart showing fidelity and purity over time"
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

        {timeline.map((point, index) => {
          const x = scaleX(index, timeline.length)
          const fidelityY = scaleY(safeMetric(point.fidelity))
          const purityY = scaleY(safeMetric(point.purity))

          return (
            <g key={point.time_us}>
              <circle cx={x} cy={fidelityY} r={4} className="metric-timeline__dot metric-timeline__dot--fidelity" />
              <circle cx={x} cy={purityY} r={4} className="metric-timeline__dot metric-timeline__dot--purity" />
              <text x={x} y={height - 8} textAnchor="middle" className="metric-timeline__time-label">
                {point.time_us}us
              </text>
            </g>
          )
        })}
      </svg>

      <div className="metric-timeline__summary">
        <article className="metric-timeline__value-card">
          <span className="metric-timeline__label">Final fidelity</span>
          <strong className="metric-timeline__value">{safeMetric(finalPoint.fidelity).toFixed(4)}</strong>
        </article>
        <article className="metric-timeline__value-card">
          <span className="metric-timeline__label">Final purity</span>
          <strong className="metric-timeline__value">{safeMetric(finalPoint.purity).toFixed(4)}</strong>
        </article>
      </div>
    </section>
  )
}
