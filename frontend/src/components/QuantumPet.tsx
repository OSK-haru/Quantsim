import { useEffect, useRef, useState } from 'react'
import './QuantumPet.css'
import { useAnimationSettings } from '../context/useAnimationSettings'
import { usePetSettings } from '../context/usePetSettings'
import {
  gateAwareRunningStages,
  simulateTips,
  type QuantumPetStage,
} from '../utils/quantumPetTips'

export type QuantumPetPhase = 'idle' | 'running' | 'done'

type QuantumPetProps = {
  phase: QuantumPetPhase
  message?: string | null
  /* ページごとに、ペットが順番に喋るヒントを差し替える。 */
  tips?: string[]
  /* 実行中に経過時間へ応じて出す文言も、ページごとに差し替える。 */
  stages?: QuantumPetStage[]
}

const phaseLabels: Record<QuantumPetPhase, string> = {
  idle: '待機中',
  running: '計算中',
  done: '完了',
}

const TICK_MS = 100
const IDLE_TIP_INTERVAL_MS = 9000
const POKE_DURATION_MS = 620
const EYE_TRACK_RADIUS_PX = 3.6
const EYE_TRACK_FALLOFF_PX = 260

/*
 * 設定で非表示にしているあいだは中身ごと外し、
 * タイマーやポインタ監視も残さない。
 */
export function QuantumPet(props: QuantumPetProps) {
  const { petVisible } = usePetSettings()
  if (!petVisible) {
    return null
  }

  return <QuantumPetBody {...props} />
}

function QuantumPetBody({
  phase,
  message = null,
  tips = simulateTips,
  stages = gateAwareRunningStages,
}: QuantumPetProps) {
  const { animationsEnabled } = useAnimationSettings()
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [trackedPhase, setTrackedPhase] = useState<QuantumPetPhase>(phase)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [bubbleOpen, setBubbleOpen] = useState(true)
  const [poked, setPoked] = useState(false)
  const stageRef = useRef<HTMLButtonElement | null>(null)
  const eyesRef = useRef<HTMLSpanElement | null>(null)

  const motionEnabled = animationsEnabled && !reducedMotion

  /*
   * 状態が変わったら経過時間をリセットし、
   * 閉じられていても一度は話しかける。
   */
  if (phase !== trackedPhase) {
    setTrackedPhase(phase)
    setElapsedMs(0)
    setBubbleOpen(true)
  }

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')

    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches)
    }

    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (phase !== 'running') {
      return
    }

    const startedAtMs = window.performance.now()
    const intervalId = window.setInterval(() => {
      setElapsedMs(window.performance.now() - startedAtMs)
    }, TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [phase])

  useEffect(() => {
    if (phase === 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      setTipIndex((current) => current + 1)
    }, IDLE_TIP_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [phase])

  useEffect(() => {
    if (!poked) {
      return
    }

    const timeoutId = window.setTimeout(() => setPoked(false), POKE_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [poked])

  /*
   * 黒目でポインタを追う。再描画を避けるため、
   * CSS変数を直接書き換える。
   */
  useEffect(() => {
    const eyes = eyesRef.current
    if (eyes === null) {
      return
    }

    if (!motionEnabled) {
      eyes.style.removeProperty('--pet-eye-x')
      eyes.style.removeProperty('--pet-eye-y')
      return
    }

    let frameId = 0
    let pointerX = 0
    let pointerY = 0

    function applyGaze() {
      frameId = 0

      const stage = stageRef.current
      const target = eyesRef.current
      if (stage === null || target === null) {
        return
      }

      const bounds = stage.getBoundingClientRect()
      const deltaX = pointerX - (bounds.left + bounds.width / 2)
      const deltaY = pointerY - (bounds.top + bounds.height / 2)
      const distance = Math.hypot(deltaX, deltaY)
      if (distance < 1) {
        return
      }

      const reach = Math.min(1, distance / EYE_TRACK_FALLOFF_PX)
      const offset = EYE_TRACK_RADIUS_PX * reach
      target.style.setProperty('--pet-eye-x', `${((deltaX / distance) * offset).toFixed(2)}px`)
      target.style.setProperty('--pet-eye-y', `${((deltaY / distance) * offset).toFixed(2)}px`)
    }

    function handlePointerMove(event: PointerEvent) {
      pointerX = event.clientX
      pointerY = event.clientY

      if (frameId === 0) {
        frameId = window.requestAnimationFrame(applyGaze)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [motionEnabled])

  const activeStages = stages.length > 0 ? stages : gateAwareRunningStages
  const currentStage =
    [...activeStages].reverse().find((stage) => elapsedMs >= stage.afterMs) ?? activeStages[0]

  const activeTips = tips.length > 0 ? tips : simulateTips
  const defaultText =
    phase === 'running' ? currentStage.label : activeTips[tipIndex % activeTips.length]

  const guideText = message ?? defaultText

  const className = [
    'quantum-pet',
    `quantum-pet--${phase}`,
    bubbleOpen ? 'quantum-pet--open' : '',
    poked ? 'quantum-pet--poked' : '',
  ]
    .filter((token) => token !== '')
    .join(' ')

  return (
    <>
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{
          position: 'absolute',
          pointerEvents: 'none',
        }}
      >
        <filter
          id="quantum-pet-wobble"
          x="-35%"
          y="-35%"
          width="170%"
          height="170%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.016 0.022"
            numOctaves="2"
            seed="3"
            result="petNoise"
          >
            {motionEnabled ? (
              <>
                <animate
                  attributeName="baseFrequency"
                  dur="9s"
                  values="
                    0.016 0.022;
                    0.025 0.013;
                    0.011 0.029;
                    0.019 0.018;
                    0.016 0.022
                  "
                  repeatCount="indefinite"
                />

                <animate
                  attributeName="seed"
                  dur="14s"
                  values="3;9;16;22;3"
                  repeatCount="indefinite"
                />
              </>
            ) : null}
          </feTurbulence>

          <feDisplacementMap
            in="SourceGraphic"
            in2="petNoise"
            scale="9"
            xChannelSelector="R"
            yChannelSelector="G"
          >
            {motionEnabled ? (
              <animate
                attributeName="scale"
                dur="6.5s"
                values="6;13;7;15;6"
                repeatCount="indefinite"
              />
            ) : null}
          </feDisplacementMap>
        </filter>
      </svg>

      <div className={className}>
        <div
          id="quantum-pet-bubble"
          className="quantum-pet__bubble"
          role="status"
          aria-live="polite"
        >
          <span className="quantum-pet__bubble-eyebrow">{phaseLabels[phase]}</span>

          <span className="quantum-pet__bubble-text">{guideText}</span>

          {phase === 'running' ? (
            /* 0.1秒ごとに変わるので、読み上げ対象からは外す。 */
            <span className="quantum-pet__bubble-meta" aria-hidden="true">
              {(elapsedMs / 1000).toFixed(1)} 秒経過
            </span>
          ) : null}
        </div>

        <button
          type="button"
          ref={stageRef}
          className="quantum-pet__stage"
          aria-label={`シミュレーションガイド（${phaseLabels[phase]}）`}
          aria-expanded={bubbleOpen}
          aria-controls="quantum-pet-bubble"
          onClick={() => {
            setBubbleOpen((current) => !current)
            setPoked(true)
          }}
        >
          <span className="quantum-pet__aura" aria-hidden="true" />

          <span className="quantum-pet__body" aria-hidden="true" />

          <span className="quantum-pet__face" aria-hidden="true">
            <span className="quantum-pet__eyes" ref={eyesRef}>
              <span className="quantum-pet__eye" />
              <span className="quantum-pet__eye" />
            </span>
          </span>
        </button>
      </div>
    </>
  )
}
