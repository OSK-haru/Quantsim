import { useState } from 'react'
import './BlochSphereExplorer.css'
import type { StateSnapshot } from '../types/simulation'
import {
  blochStatesFromSnapshot,
  type BlochQubitState,
} from '../utils/blochSphere'
import {
  formatDensityValue,
  formatSnapshotProgress,
  formatSnapshotTimeUs,
  snapshotKindLabel,
} from '../utils/densityMatrix'

type BlochSphereExplorerProps = {
  snapshots: StateSnapshot[]
  snapshotIndex: number
}

type ProjectedPoint = {
  x: number
  y: number
}

const SPHERE_CENTER = 74
const SPHERE_RADIUS = 54

export function BlochSphereExplorer({
  snapshots,
  snapshotIndex,
}: BlochSphereExplorerProps) {
  const [selectedQubitIndex, setSelectedQubitIndex] = useState(0)
  const activeSnapshotIndex = clamp(snapshotIndex, 0, Math.max(0, snapshots.length - 1))
  const activeSnapshot = snapshots[activeSnapshotIndex]
  const result = blochStatesFromSnapshot(activeSnapshot)

  if (snapshots.length === 0) {
    return <p className="bloch-sphere-explorer__empty">Bloch球を表示できるスナップショットがありません。</p>
  }

  if (!result.valid) {
    return <p className="bloch-sphere-explorer__empty">{result.message}</p>
  }

  const activeQubitIndex = clamp(selectedQubitIndex, 0, result.states.length - 1)
  const activeState = result.states[activeQubitIndex]

  return (
    <section className="bloch-sphere-explorer" aria-labelledby="bloch-sphere-title">
      <div className="bloch-sphere-explorer__heading">
        <div>
          <span className="bloch-sphere-explorer__eyebrow">Local quantum states</span>
          <h2 id="bloch-sphere-title">Bloch球</h2>
        </div>
        <p>
          完全な密度行列を量子ビットごとに縮約した局所状態です。矢印が短いほど、局所状態は混合しています。
        </p>
      </div>

      <div className="bloch-sphere-explorer__snapshot-meta" aria-label="表示中の時点">
        <span>{snapshotKindLabel(activeSnapshot)}</span>
        <span>{formatSnapshotTimeUs(activeSnapshot.time_us)}</span>
        <span>{formatSnapshotProgress(activeSnapshot.progress)}</span>
        {activeSnapshot.column_index == null ? null : (
          <span>列 {activeSnapshot.column_index + 1}</span>
        )}
      </div>

      <div className="bloch-sphere-explorer__sphere-grid" aria-label="量子ビットの選択">
        {result.states.map((state) => (
          <button
            className="bloch-sphere-explorer__sphere-button"
            data-selected={state.qubitIndex === activeQubitIndex}
            type="button"
            aria-pressed={state.qubitIndex === activeQubitIndex}
            key={state.qubitIndex}
            onClick={() => setSelectedQubitIndex(state.qubitIndex)}
          >
            <span className="bloch-sphere-explorer__qubit-label">q{state.qubitIndex}</span>
            <BlochSphere state={state} />
            <span className="bloch-sphere-explorer__radius-label">
              |r| = {formatCompact(state.radius)}
            </span>
          </button>
        ))}
      </div>

      <section className="bloch-sphere-explorer__details" aria-live="polite">
        <div className="bloch-sphere-explorer__details-heading">
          <div>
            <span className="bloch-sphere-explorer__eyebrow">Selected qubit</span>
            <h3>q{activeState.qubitIndex} の局所状態</h3>
          </div>
          <span className="bloch-sphere-explorer__vector">
            ({formatSigned(activeState.x)}, {formatSigned(activeState.y)}, {formatSigned(activeState.z)})
          </span>
        </div>

        <dl className="bloch-sphere-explorer__metrics">
          <Metric label="位相 φ" value={formatAngle(activeState.phaseRadians)} />
          <Metric label="極角 θ" value={formatAngle(activeState.polarRadians)} />
          <Metric label="ベクトル長 |r|" value={formatDensityValue(activeState.radius)} />
          <Metric label="局所純度" value={formatDensityValue(activeState.localPurity)} />
          <Metric label="|0〉確率" value={formatPercent(activeState.populationZero)} />
          <Metric label="|1〉確率" value={formatPercent(activeState.populationOne)} />
          <Metric
            label="コヒーレンス ρ01"
            value={`${formatSigned(activeState.coherenceReal)} ${formatImaginary(activeState.coherenceImag)}i`}
          />
        </dl>

        {activeState.phaseRadians === null ? (
          <p className="bloch-sphere-explorer__phase-note">
            X–Y平面の成分が0に近いため、この状態の相対位相は定義できません。
          </p>
        ) : null}
      </section>
    </section>
  )
}

function BlochSphere({ state }: { state: BlochQubitState }) {
  const visualScale = state.radius > 1 ? 1 / state.radius : 1
  const endpoint = projectPoint(
    state.x * visualScale,
    state.y * visualScale,
    state.z * visualScale,
  )
  const xNegative = projectPoint(-1, 0, 0)
  const xPositive = projectPoint(1, 0, 0)
  const yNegative = projectPoint(0, -1, 0)
  const yPositive = projectPoint(0, 1, 0)
  const zNegative = projectPoint(0, 0, -1)
  const zPositive = projectPoint(0, 0, 1)
  const description = `q${state.qubitIndex}: Blochベクトル x ${formatCompact(state.x)}, y ${formatCompact(state.y)}, z ${formatCompact(state.z)}`

  return (
    <svg
      className="bloch-sphere-explorer__sphere"
      viewBox="0 0 148 148"
      role="img"
      aria-label={description}
    >
      <circle className="bloch-sphere-explorer__sphere-fill" cx={SPHERE_CENTER} cy={SPHERE_CENTER} r={SPHERE_RADIUS} />
      <ellipse className="bloch-sphere-explorer__great-circle" cx={SPHERE_CENTER} cy={SPHERE_CENTER} rx={SPHERE_RADIUS} ry="18" />
      <ellipse className="bloch-sphere-explorer__great-circle" cx={SPHERE_CENTER} cy={SPHERE_CENTER} rx={SPHERE_RADIUS} ry="18" transform={`rotate(60 ${SPHERE_CENTER} ${SPHERE_CENTER})`} />
      <ellipse className="bloch-sphere-explorer__great-circle" cx={SPHERE_CENTER} cy={SPHERE_CENTER} rx={SPHERE_RADIUS} ry="18" transform={`rotate(-60 ${SPHERE_CENTER} ${SPHERE_CENTER})`} />
      <AxisLine start={xNegative} end={xPositive} />
      <AxisLine start={yNegative} end={yPositive} />
      <AxisLine start={zNegative} end={zPositive} />
      <text className="bloch-sphere-explorer__axis-label" x={xPositive.x + 4} y={xPositive.y + 2}>X</text>
      <text className="bloch-sphere-explorer__axis-label" x={yPositive.x - 10} y={yPositive.y + 2}>Y</text>
      <text className="bloch-sphere-explorer__axis-label" x={zPositive.x + 4} y={zPositive.y + 3}>Z</text>
      <line
        className="bloch-sphere-explorer__state-vector"
        x1={SPHERE_CENTER}
        y1={SPHERE_CENTER}
        x2={endpoint.x}
        y2={endpoint.y}
      />
      <circle className="bloch-sphere-explorer__state-point" cx={endpoint.x} cy={endpoint.y} r="5" />
      <circle className="bloch-sphere-explorer__sphere-outline" cx={SPHERE_CENTER} cy={SPHERE_CENTER} r={SPHERE_RADIUS} />
    </svg>
  )
}

function AxisLine({ start, end }: { start: ProjectedPoint; end: ProjectedPoint }) {
  return (
    <line
      className="bloch-sphere-explorer__axis"
      x1={start.x}
      y1={start.y}
      x2={end.x}
      y2={end.y}
    />
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function projectPoint(x: number, y: number, z: number): ProjectedPoint {
  const screenX = 0.7071 * x - 0.7071 * y
  const screenY = 0.2418 * x + 0.2418 * y - 0.9397 * z
  return {
    x: SPHERE_CENTER + screenX * SPHERE_RADIUS,
    y: SPHERE_CENTER + screenY * SPHERE_RADIUS,
  }
}

function formatAngle(radians: number | null): string {
  if (radians === null) {
    return '定義なし'
  }
  const degrees = radians * 180 / Math.PI
  return `${formatSigned(degrees, 1)}° (${formatSigned(radians, 3)} rad)`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCompact(value: number): string {
  return Math.abs(value) < 0.0005 ? '0.000' : value.toFixed(3)
}

function formatSigned(value: number, digits = 3): string {
  const normalized = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value
  return `${normalized >= 0 ? '+' : '−'}${Math.abs(normalized).toFixed(digits)}`
}

function formatImaginary(value: number): string {
  return `${value >= 0 ? '+' : '−'} ${Math.abs(value).toFixed(3)}`
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
