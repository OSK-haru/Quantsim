import { useEffect, useMemo, useRef, useState } from 'react'
import './PulseTimelinePlayback.css'
import { useAnimationSettings } from '../context/useAnimationSettings'
import {
  nearestPulsePointIndex,
  type PulseExplorerPoint,
  type PulseExplorerSegment,
  type PulseExplorerView,
} from '../utils/pulseStateExplorer'

type PulseTimelinePlaybackProps = {
  view: PulseExplorerView
  simulationTimeUs: number
  onSimulationTimeChange: (simulationTimeUs: number) => void
}

const playbackWallDurationMs = 8000

const segmentLabels: Record<PulseExplorerSegment, string> = {
  pulse: '駆動中',
  idle: 'アイドル',
  virtual_z: '仮想Z（瞬時）',
}

type SegmentSpan = {
  segment: PulseExplorerSegment
  stepLabel: string | null
  startUs: number
  endUs: number
}

/*
 * Gate-aware の「物理時間」を、パルス列の時間軸へ移したもの。
 * あちらが回路の列を実時間に並べるのに対し、こちらは駆動区間・アイドル区間・
 * 仮想Zの瞬間を並べる。再生位置は他のパネルと共有する。
 */
export function PulseTimelinePlayback({
  view,
  simulationTimeUs,
  onSimulationTimeChange,
}: PulseTimelinePlaybackProps) {
  const { animationsEnabled } = useAnimationSettings()
  const [playing, setPlaying] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const playbackStartWallTimeRef = useRef(0)
  const playbackStartSimulationTimeRef = useRef(0)
  const points = view.points
  const startTimeUs = points[0]?.timeUs ?? 0
  const totalTimeUs = Math.max(view.totalTimeUs, startTimeUs)
  const boundedTimeUs = Math.min(totalTimeUs, Math.max(startTimeUs, simulationTimeUs))
  const spans = useMemo(() => segmentSpans(points, totalTimeUs), [points, totalTimeUs])
  const activeIndex = nearestPulsePointIndex(points, boundedTimeUs)
  const activePoint = activeIndex >= 0 ? points[activeIndex] : null
  const activeSpan = spans.find(
    (span) => boundedTimeUs >= span.startUs && boundedTimeUs <= span.endUs,
  ) ?? spans.at(-1) ?? null
  const spanWidth = (span: SegmentSpan) => {
    const total = totalTimeUs - startTimeUs
    if (total <= 0) {
      return 100 / Math.max(1, spans.length)
    }
    return ((span.endUs - span.startUs) / total) * 100
  }
  const cursorPercent = totalTimeUs - startTimeUs <= 0
    ? 0
    : ((boundedTimeUs - startTimeUs) / (totalTimeUs - startTimeUs)) * 100

  useEffect(() => {
    if (!playing || totalTimeUs <= startTimeUs) {
      return
    }

    const advance = (wallTimeMs: number) => {
      const elapsedWallTimeMs = wallTimeMs - playbackStartWallTimeRef.current
      const deltaUs = (elapsedWallTimeMs / playbackWallDurationMs) * (totalTimeUs - startTimeUs)
      const nextTimeUs = Math.min(
        totalTimeUs,
        playbackStartSimulationTimeRef.current + deltaUs,
      )
      onSimulationTimeChange(nextTimeUs)
      if (nextTimeUs >= totalTimeUs) {
        setPlaying(false)
        animationFrameRef.current = null
        return
      }
      animationFrameRef.current = window.requestAnimationFrame(advance)
    }

    animationFrameRef.current = window.requestAnimationFrame(advance)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [onSimulationTimeChange, playing, startTimeUs, totalTimeUs])

  function handlePlay() {
    const startFromUs = boundedTimeUs >= totalTimeUs ? startTimeUs : boundedTimeUs
    if (startFromUs !== boundedTimeUs) {
      onSimulationTimeChange(startFromUs)
    }
    playbackStartWallTimeRef.current = window.performance.now()
    playbackStartSimulationTimeRef.current = startFromUs
    setPlaying(true)
  }

  function stepBy(offset: number) {
    setPlaying(false)
    const nextIndex = Math.min(points.length - 1, Math.max(0, activeIndex + offset))
    const nextPoint = points[nextIndex]
    if (nextPoint) {
      onSimulationTimeChange(nextPoint.timeUs)
    }
  }

  return (
    <section className="pulse-playback" aria-labelledby="pulse-playback-title">
      <div className="pulse-playback__heading">
        <div>
          <span>PULSE TIMELINE</span>
          <h2 id="pulse-playback-title">パルス列と物理時間の同期再生</h2>
        </div>
        <strong>{boundedTimeUs.toFixed(4)} / {totalTimeUs.toFixed(4)} μs</strong>
      </div>

      <div className="pulse-playback__band" aria-label="駆動区間とアイドル区間">
        {spans.map((span, index) => (
          <div
            className="pulse-playback__span"
            key={`${span.segment}-${span.startUs}-${index}`}
            data-segment={span.segment}
            data-active={span === activeSpan}
            style={{ width: `${spanWidth(span)}%` }}
            title={`${segmentLabels[span.segment]}${span.stepLabel ? ` / ${span.stepLabel}` : ''}（${span.startUs.toFixed(4)} - ${span.endUs.toFixed(4)} μs）`}
          >
            <span>{span.stepLabel ?? segmentLabels[span.segment]}</span>
          </div>
        ))}
        <div className="pulse-playback__cursor" style={{ left: `${cursorPercent}%` }} aria-hidden="true" />
      </div>

      <div className="pulse-playback__controls">
        {/* 動きを抑える設定のときは自動再生を出さず、スライダーで送ってもらう。 */}
        <button
          type="button"
          disabled={!animationsEnabled}
          onClick={playing ? () => setPlaying(false) : handlePlay}
        >
          {playing ? '一時停止' : '再生'}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            onSimulationTimeChange(startTimeUs)
          }}
        >
          先頭へ
        </button>
        <button type="button" onClick={() => stepBy(-1)} aria-label="1サンプル戻る">◀</button>
        <button type="button" onClick={() => stepBy(1)} aria-label="1サンプル進む">▶</button>
        <label>
          <span>simulation time</span>
          <input
            type="range"
            min={startTimeUs}
            max={totalTimeUs}
            step={Math.max((totalTimeUs - startTimeUs) / 1000, 1e-9)}
            value={boundedTimeUs}
            onChange={(event) => {
              setPlaying(false)
              onSimulationTimeChange(Number(event.currentTarget.value))
            }}
          />
        </label>
      </div>

      <dl className="pulse-playback__readout">
        <div>
          <dt>現在の区間</dt>
          <dd>
            {activeSpan === null
              ? '—'
              : `${segmentLabels[activeSpan.segment]}${activeSpan.stepLabel ? ` / ${activeSpan.stepLabel}` : ''}`}
          </dd>
        </div>
        <div>
          <dt>サンプル</dt>
          <dd>{points.length === 0 ? '—' : `${activeIndex + 1} / ${points.length}`}</dd>
        </div>
        <div>
          <dt>Pulse終了時刻</dt>
          <dd>{view.pulseEndTimeUs.toFixed(4)} μs</dd>
        </div>
        <div>
          <dt>純度</dt>
          <dd>{activePoint ? activePoint.purity.toFixed(6) : '—'}</dd>
        </div>
      </dl>

      <p className="pulse-playback__status">
        {!animationsEnabled
          ? 'アニメーションを切っているため自動再生は無効です。スライダーと ◀ ▶ で時刻を動かせます。'
          : boundedTimeUs > view.pulseEndTimeUs
            ? 'Pulse終了後のアイドル時間：駆動を切ったあと、環境との結合だけで発展しています。'
            : '駆動中：波形が状態を回している区間です。'}
      </p>
    </section>
  )
}

function segmentSpans(points: PulseExplorerPoint[], totalTimeUs: number): SegmentSpan[] {
  const spans: SegmentSpan[] = []
  points.forEach((point, index) => {
    const previous = spans.at(-1)
    const endUs = points[index + 1]?.timeUs ?? totalTimeUs
    if (
      previous !== undefined
      && previous.segment === point.segment
      && previous.stepLabel === point.stepLabel
    ) {
      previous.endUs = endUs
      return
    }
    spans.push({
      segment: point.segment,
      stepLabel: point.stepLabel,
      startUs: point.timeUs,
      endUs,
    })
  })
  return spans
}
