import { useEffect, useRef, useState } from 'react'
import './SimulationProgressIndicator.css'

type SimulationProgressIndicatorProps = {
  isPending: boolean
  timeoutMs: number | null
}

type Stage = { label: string; afterMs: number }

const stages: Stage[] = [
  { label: '回路を物理パラメータへコンパイル中…', afterMs: 0 },
  { label: 'Lindblad方程式で時間発展を計算中…', afterMs: 600 },
  { label: '密度行列とスナップショットを収集中…', afterMs: 2500 },
  { label: '測定統計とダイアグノスティクスを計算中…', afterMs: 6000 },
  { label: 'バックエンドの応答を待っています（時間がかかっています）…', afterMs: 12000 },
]

const TICK_MS = 100

export function SimulationProgressIndicator({ isPending, timeoutMs }: SimulationProgressIndicatorProps) {
  const [trackedIsPending, setTrackedIsPending] = useState(isPending)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startRef = useRef<number | null>(null)

  if (isPending !== trackedIsPending) {
    setTrackedIsPending(isPending)
    setElapsedMs(0)
  }

  useEffect(() => {
    if (!isPending) {
      startRef.current = null
      return
    }

    startRef.current = window.performance.now()
    const intervalId = window.setInterval(() => {
      if (startRef.current === null) {
        return
      }
      setElapsedMs(window.performance.now() - startRef.current)
    }, TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [isPending])

  if (!isPending) {
    return null
  }

  const currentStage = [...stages].reverse().find((stage) => elapsedMs >= stage.afterMs) ?? stages[0]
  const isRunningLong = timeoutMs !== null && elapsedMs >= timeoutMs * 0.7

  return (
    <div className="simulation-progress" role="status" aria-live="polite">
      <div className="simulation-progress__track">
        <div className="simulation-progress__sweep" />
      </div>
      <div className="simulation-progress__meta">
        <span className="simulation-progress__stage">{currentStage.label}</span>
        <span className="simulation-progress__elapsed">
          {(elapsedMs / 1000).toFixed(1)} 秒経過
          {isRunningLong ? '（想定より時間がかかっています）' : ''}
        </span>
      </div>
    </div>
  )
}
