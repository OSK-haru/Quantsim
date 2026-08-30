import { useEffect, useMemo, useRef, useState } from 'react'
import './PhysicalTimelinePlayback.css'
import { CircuitPreview } from './CircuitPreview'
import { useAnimationSettings } from '../context/useAnimationSettings'
import type { CircuitEditorState } from '../types/circuit'
import type { GateDurationDefaults, MeasurementResult, PhysicalTimeline, StateSnapshot } from '../types/simulation'
import { activePhysicalTimelineEvent, clampSimulationTime, nearestSnapshotIndex } from '../utils/physicalTimeline'

type PhysicalTimelinePlaybackProps = {
  circuit: CircuitEditorState
  gateDurationDefaults: GateDurationDefaults
  physicalTimeline?: PhysicalTimeline
  measurement?: MeasurementResult
  simulationTimeUs: number
  onSimulationTimeChange: (simulationTimeUs: number) => void
  noisySnapshots?: StateSnapshot[]
  idealSnapshots?: StateSnapshot[]
  /*
   * 'controls' は再生操作だけの細いバー、'circuit' は回路図だけの表示。
   * 時刻カーソルは Bloch球・密度行列など下のパネルと共有するので、操作系は
   * どのパネルを開いていても届くようページ上部に常に出し、回路図だけを
   * 折りたたみパネルに残す。再生ループを持つのは 'controls' の側だけ。
   */
  variant?: 'full' | 'controls' | 'circuit'
}

const playbackWallDurationMs = 8000

export function PhysicalTimelinePlayback({
  circuit,
  gateDurationDefaults,
  physicalTimeline,
  measurement,
  simulationTimeUs,
  onSimulationTimeChange,
  noisySnapshots = [],
  idealSnapshots = [],
  variant = 'full',
}: PhysicalTimelinePlaybackProps) {
  const showCircuit = variant !== 'controls'
  const showControls = variant !== 'circuit'
  const { animationsEnabled } = useAnimationSettings()
  /* 再生ループは操作バー側だけが持つ。両方が回すと同じカーソルを取り合う。 */
  const [playing, setPlaying] = useState(animationsEnabled && showControls)
  const animationFrameRef = useRef<number | null>(null)
  const playbackStartWallTimeRef = useRef(window.performance.now())
  const playbackStartSimulationTimeRef = useRef(simulationTimeUs)
  const totalDurationUs = physicalTimeline?.total_duration_us ?? 0
  const boundedSimulationTimeUs = clampSimulationTime(simulationTimeUs, totalDurationUs)
  const activeEvent = useMemo(
    () => physicalTimeline
      ? activePhysicalTimelineEvent(physicalTimeline, boundedSimulationTimeUs)
      : null,
    [boundedSimulationTimeUs, physicalTimeline],
  )
  const highlightedColumnIndex = activeEvent?.source_circuit_columns[0] ?? null
  const firstMeasurementTimeUs = physicalTimeline?.events.find((event) => (
    event.operations.some((operation) => operation.gate === 'MEASURE')
  ))?.start_us ?? null
  const showMeasurementBranches = variant === 'full'
    && firstMeasurementTimeUs !== null
    && boundedSimulationTimeUs >= firstMeasurementTimeUs
    && (measurement?.classical_branches.length ?? 0) > 0
  const eventProgress = activeEvent && activeEvent.duration_us > 0
    ? Math.max(0, Math.min(1, (boundedSimulationTimeUs - activeEvent.start_us) / activeEvent.duration_us))
    : 1
  const eventNumber = activeEvent
    ? physicalTimeline?.events.indexOf(activeEvent) ?? -1
    : -1
  const highlightedGateSignatures = activeEvent?.operations.map((operation) => (
    `${operation.gate}:${[...(operation.controls ?? []), ...operation.targets].sort((left, right) => left - right).join(',')}`
  )) ?? []
  const noisySnapshot = noisySnapshots[nearestSnapshotIndex(noisySnapshots, boundedSimulationTimeUs)]
  const idealSnapshot = idealSnapshots[nearestSnapshotIndex(idealSnapshots, boundedSimulationTimeUs)]
  const stateDifference = noisySnapshot && idealSnapshot
    ? densityMatrixDistance(noisySnapshot, idealSnapshot)
    : null

  useEffect(() => {
    if (!playing || !showControls || totalDurationUs <= 0) return

    const advancePlaybackTime = (wallTimeMs: number) => {
      const elapsedWallTimeMs = wallTimeMs - playbackStartWallTimeRef.current
      const simulationDeltaUs = (elapsedWallTimeMs / playbackWallDurationMs) * totalDurationUs
      const nextSimulationTimeUs = Math.min(
        totalDurationUs,
        playbackStartSimulationTimeRef.current + simulationDeltaUs,
      )
      onSimulationTimeChange(nextSimulationTimeUs)
      if (nextSimulationTimeUs >= totalDurationUs) {
        setPlaying(false)
        animationFrameRef.current = null
        return
      }
      animationFrameRef.current = window.requestAnimationFrame(advancePlaybackTime)
    }

    animationFrameRef.current = window.requestAnimationFrame(advancePlaybackTime)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [onSimulationTimeChange, playing, showControls, totalDurationUs])

  if (!physicalTimeline) {
    /* 同じ注意書きを操作バーと回路パネルで二重に出さない。 */
    if (variant === 'circuit') return null
    return (
      <section className="physical-playback physical-playback--unavailable">
        この結果には物理タイムラインがありません。再実行すると再生できます。
      </section>
    )
  }

  const handlePlay = () => {
    const startSimulationTimeUs = boundedSimulationTimeUs >= totalDurationUs
      ? 0
      : boundedSimulationTimeUs
    if (startSimulationTimeUs !== boundedSimulationTimeUs) onSimulationTimeChange(0)
    playbackStartWallTimeRef.current = window.performance.now()
    playbackStartSimulationTimeRef.current = startSimulationTimeUs
    setPlaying(true)
  }
  const handleRestart = () => {
    setPlaying(false)
    onSimulationTimeChange(0)
  }

  return (
    <section
      className={`physical-playback${showCircuit ? '' : ' physical-playback--compact'}`}
      aria-labelledby="physical-playback-title"
    >
      <div className="physical-playback__heading">
        <div>
          <span>PHYSICAL TIMELINE</span>
          <h2 id="physical-playback-title">
            {variant === 'controls' ? '物理時間の再生' : variant === 'circuit' ? '回路アニメーション' : '回路と物理時間の同期再生'}
          </h2>
        </div>
        <strong>{boundedSimulationTimeUs.toFixed(4)} / {totalDurationUs.toFixed(4)} μs</strong>
      </div>
      {showCircuit ? (
        <>
          <CircuitPreview
            circuit={circuit}
            gateDurationDefaults={gateDurationDefaults}
            highlightedColumnIndex={highlightedColumnIndex}
            highlightedGateSignatures={highlightedGateSignatures}
          />
          <div className="physical-playback__circuit-progress" aria-label="回路アニメーション進行">
            <div className="physical-playback__circuit-progress-label">
              <span>回路アニメーション</span>
              <span>{eventNumber >= 0 ? `${eventNumber + 1} / ${physicalTimeline.events.length}` : '待機'}</span>
            </div>
            <div className="physical-playback__circuit-progress-track">
              <div className="physical-playback__circuit-progress-bar" style={{ width: `${eventProgress * 100}%` }} />
            </div>
          </div>
        </>
      ) : null}
      {stateDifference === null ? null : (
        <div className="physical-playback__noise-readout" aria-label="理想状態とノイズ状態の差">
          <span>現在時刻のノイズ差分 Δρ</span>
          <strong>{stateDifference.toFixed(5)}</strong>
          <small>理想軌道とノイズ軌道の密度行列のFrobenius距離</small>
        </div>
      )}
      {showControls ? (
        <div className="physical-playback__controls">
          <button type="button" onClick={playing ? () => setPlaying(false) : handlePlay}>{playing ? '一時停止' : '再生'}</button>
          <button type="button" onClick={handleRestart}>先頭へ</button>
          <label>
            <span>simulation time</span>
            <input
              type="range"
              min={0}
              max={totalDurationUs}
              step={Math.max(totalDurationUs / 1000, 1e-9)}
              value={boundedSimulationTimeUs}
              onChange={(event) => {
                setPlaying(false)
                onSimulationTimeChange(Number(event.currentTarget.value))
              }}
            />
          </label>
        </div>
      ) : null}
      <p className="physical-playback__status">
        {activeEvent?.kind === 'idle'
          ? '回路完了後のアイドル時間：環境ノイズによる時間発展'
          : activeEvent
            ? `実行列 ${highlightedColumnIndex === null ? '—' : highlightedColumnIndex + 1}：${activeEvent.operations.map((operation) => operation.gate).join(' + ')}`
            : '現在時刻に対応する実行イベントはありません'}
      </p>
      {showMeasurementBranches ? (
        <div className="physical-playback__branches" aria-label="測定後の古典分岐アンサンブル">
          <span className="physical-playback__branches-label">測定後の分岐（アンサンブル）</span>
          {measurement?.classical_branches.slice(0, 8).map((branch, index) => (
            <span className="physical-playback__branch" key={`${branch.classical_bits.join('')}-${index}`}>
              c={branch.classical_bits.join('') || '—'} {formatBranchProbability(branch.probability)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function formatBranchProbability(probability: number) {
  return `${(Math.max(0, Math.min(1, probability)) * 100).toFixed(2)}%`
}

function densityMatrixDistance(left: StateSnapshot, right: StateSnapshot) {
  const leftReal = left.density_matrix.real
  const leftImag = left.density_matrix.imag
  const rightReal = right.density_matrix.real
  const rightImag = right.density_matrix.imag
  let sum = 0
  for (let row = 0; row < Math.min(leftReal.length, rightReal.length); row += 1) {
    for (let column = 0; column < Math.min(leftReal[row].length, rightReal[row].length); column += 1) {
      const real = leftReal[row][column] - rightReal[row][column]
      const imag = leftImag[row][column] - rightImag[row][column]
      sum += real * real + imag * imag
    }
  }
  return Math.sqrt(sum)
}
