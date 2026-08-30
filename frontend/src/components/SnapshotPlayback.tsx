import { useEffect, useRef } from 'react'
import './SnapshotPlayback.css'
import { useAnimationSettings } from '../context/useAnimationSettings'

type SnapshotPlaybackProps = {
  snapshotCount: number
  snapshotIndex: number
  onSnapshotIndexChange: (snapshotIndex: number) => void
  playing: boolean
  onPlayingChange: (playing: boolean) => void
  label?: string
}

/* 1 スナップショットあたりの滞在時間。全体ではなく1コマ基準にして、
 * スナップショットが増えても1コマの見え方が変わらないようにする。 */
const STEP_INTERVAL_MS = 900

export function SnapshotPlayback({
  snapshotCount,
  snapshotIndex,
  onSnapshotIndexChange,
  playing,
  onPlayingChange,
  label = 'スナップショットの再生',
}: SnapshotPlaybackProps) {
  const { animationsEnabled } = useAnimationSettings()
  const lastIndex = Math.max(snapshotCount - 1, 0)
  /*
   * setInterval のコールバックが古い値を掴まないよう、進行に必要な値は ref 経由で読む。
   * これをしないと再生中に index が固まる。
   */
  const snapshotIndexRef = useRef(snapshotIndex)
  const onChangeRef = useRef(onSnapshotIndexChange)
  const onPlayingChangeRef = useRef(onPlayingChange)

  useEffect(() => {
    snapshotIndexRef.current = snapshotIndex
    onChangeRef.current = onSnapshotIndexChange
    onPlayingChangeRef.current = onPlayingChange
  })

  /* アニメーションを切っている利用者には自動再生させない。 */
  useEffect(() => {
    if (!animationsEnabled && playing) {
      onPlayingChangeRef.current(false)
    }
  }, [animationsEnabled, playing])

  useEffect(() => {
    if (!playing || lastIndex <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      const next = snapshotIndexRef.current + 1
      if (next > lastIndex) {
        onPlayingChangeRef.current(false)
        return
      }
      onChangeRef.current(next)
    }, STEP_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [playing, lastIndex])

  if (lastIndex <= 0) {
    return null
  }

  const atEnd = snapshotIndex >= lastIndex

  function togglePlay() {
    /* 終端で押したときは、止めるのではなく頭から流し直す。 */
    if (!playing && atEnd) {
      onSnapshotIndexChange(0)
    }
    onPlayingChange(!playing)
  }

  return (
    <div className="snapshot-playback" aria-label={label}>
      <button
        type="button"
        className="snapshot-playback__button"
        onClick={togglePlay}
        aria-pressed={playing}
      >
        {playing ? '一時停止' : atEnd ? '最初から再生' : '再生'}
      </button>
      <input
        className="snapshot-playback__slider"
        type="range"
        min="0"
        max={lastIndex}
        step="1"
        value={Math.min(snapshotIndex, lastIndex)}
        aria-label="スナップショット位置"
        onChange={(event) => {
          onPlayingChange(false)
          onSnapshotIndexChange(Number(event.currentTarget.value))
        }}
      />
      <span className="snapshot-playback__position" aria-live="polite">
        {Math.min(snapshotIndex, lastIndex) + 1} / {snapshotCount}
      </span>
    </div>
  )
}
