import { useEffect, useRef, useState, type ReactNode } from 'react'
import './QuantumPet.css'
import { useAnimationSettings } from '../context/useAnimationSettings'
import { usePetSettings } from '../context/usePetSettings'
import { usePetSpeechSettings } from '../context/usePetSpeechSettings'
import { useOptionalTutorial } from '../context/useTutorial'
import type { PetMood } from '../context/TutorialContextCore'
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
  /* 表情と動きの指定。チュートリアルの語り口に合わせて切り替える。 */
  mood?: PetMood
  /* 吹き出しの見出し。既定は状態ラベル。 */
  eyebrow?: string
  /* 吹き出しの下に置くボタン列。 */
  actions?: ReactNode
  /*
   * チュートリアル用のインスタンス。吹き出しを閉じさせず、
   * 表示設定にも左右されない。案内中はこの1体だけを残す。
   */
  role?: 'guide' | 'tutorial'
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
/* 1文字あたりの表示間隔。会話らしく見せるための速さ。 */
const TYPE_INTERVAL_MS = 22
/* つついたときの反応が続く長さ。 */
const REACTION_DURATION_MS = 1400
/* つつくたびに順番に出す反応。毎回同じ動きにはしない。 */
const reactionMoods: PetMood[] = ['nod', 'cheer', 'wonder', 'greet', 'think']

/*
 * 設定で非表示にしているあいだは中身ごと外し、
 * タイマーやポインタ監視も残さない。
 */
export function QuantumPet(props: QuantumPetProps) {
  const { petVisible } = usePetSettings()
  const tutorial = useOptionalTutorial()
  const isTutorialPet = props.role === 'tutorial'

  /* 案内中は、各ページの常駐ペットを引っ込めて案内役へ一本化する。 */
  if (tutorial?.isActive === true && !isTutorialPet) {
    return null
  }

  if (!petVisible && !isTutorialPet) {
    return null
  }

  return <QuantumPetBody {...props} />
}

function QuantumPetBody({
  phase,
  message = null,
  tips = simulateTips,
  stages = gateAwareRunningStages,
  mood,
  eyebrow,
  actions,
  role = 'guide',
}: QuantumPetProps) {
  const { animationsEnabled } = useAnimationSettings()
  const { speechMode } = usePetSpeechSettings()
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [trackedPhase, setTrackedPhase] = useState<QuantumPetPhase>(phase)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)
  const [bubbleOpen, setBubbleOpen] = useState(true)
  const [poked, setPoked] = useState(false)
  const [reaction, setReaction] = useState<PetMood | null>(null)
  const [typedText, setTypedText] = useState<{ text: string; count: number }>({
    text: '',
    count: 0,
  })
  const stageRef = useRef<HTMLButtonElement | null>(null)
  const eyesRef = useRef<HTMLSpanElement | null>(null)
  const reactionCountRef = useRef(0)

  const motionEnabled = animationsEnabled && !reducedMotion
  const isTutorialPet = role === 'tutorial'

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

  /* つつかれた反応は、しばらくしたら本来の表情へ戻す。 */
  useEffect(() => {
    if (reaction === null) {
      return
    }

    const timeoutId = window.setTimeout(() => setReaction(null), REACTION_DURATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [reaction])

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

  /*
   * チュートリアルの台詞は1文字ずつ出す。会話らしく見えるだけでなく、
   * 長い説明を一度に浴びせないための間にもなる。
   * 出し方はアニメーション設定とは切り離し、設定の「セリフの表示」で決める。
   * 読み上げ環境の指定（prefers-reduced-motion）だけは尊重して即時表示にする。
   */
  const typewriterEnabled = isTutorialPet && speechMode === 'typewriter' && !reducedMotion
  useEffect(() => {
    if (!typewriterEnabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      setTypedText((current) => {
        /* 台詞が変わった直後は、新しい文の1文字目から数え直す。 */
        if (current.text !== guideText) {
          return { text: guideText, count: 1 }
        }
        if (current.count >= guideText.length) {
          window.clearInterval(intervalId)
          return current
        }
        return { text: guideText, count: current.count + 1 }
      })
    }, TYPE_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [guideText, typewriterEnabled])

  /* 表示中の台詞と対応していない進捗は、0文字として扱う。 */
  const revealedCount = typedText.text === guideText ? typedText.count : 0
  const visibleText = typewriterEnabled ? guideText.slice(0, revealedCount) : guideText
  const isTyping = typewriterEnabled && revealedCount < guideText.length
  const activeMood = reaction ?? mood ?? null

  const className = [
    'quantum-pet',
    `quantum-pet--${phase}`,
    bubbleOpen ? 'quantum-pet--open' : '',
    poked ? 'quantum-pet--poked' : '',
    isTutorialPet ? 'quantum-pet--tutorial' : '',
    activeMood ? `quantum-pet--expressive quantum-pet--mood-${activeMood}` : '',
    isTyping ? 'quantum-pet--speaking' : '',
    motionEnabled ? '' : 'quantum-pet--still',
  ]
    .filter((token) => token !== '')
    .join(' ')

  function handleStageClick() {
    setPoked(true)

    /* 案内中は閉じられると進めなくなるので、代わりに反応だけ返す。 */
    if (isTutorialPet) {
      reactionCountRef.current += 1
      setReaction(reactionMoods[reactionCountRef.current % reactionMoods.length])
      return
    }

    setBubbleOpen((current) => !current)
  }

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
          <span className="quantum-pet__bubble-eyebrow">{eyebrow ?? phaseLabels[phase]}</span>

          {/* 途中まで表示している間は、読み上げに断片を渡さない。 */}
          <span
            className="quantum-pet__bubble-text"
            aria-hidden={isTyping ? 'true' : undefined}
            /* 待ちきれないときは、押せば最後まで出る。 */
            onClick={() => setTypedText({ text: guideText, count: guideText.length })}
          >
            {visibleText}
            {isTyping ? <i className="quantum-pet__caret" aria-hidden="true" /> : null}
          </span>

          {phase === 'running' ? (
            /* 0.1秒ごとに変わるので、読み上げ対象からは外す。 */
            <span className="quantum-pet__bubble-meta" aria-hidden="true">
              {(elapsedMs / 1000).toFixed(1)} 秒経過
            </span>
          ) : null}

          {actions ? <div className="quantum-pet__bubble-actions">{actions}</div> : null}
        </div>

        <button
          type="button"
          ref={stageRef}
          className="quantum-pet__stage"
          aria-label={
            isTutorialPet
              ? 'ナビペット（チュートリアル案内中）'
              : `シミュレーションガイド（${phaseLabels[phase]}）`
          }
          aria-expanded={isTutorialPet ? undefined : bubbleOpen}
          aria-controls="quantum-pet-bubble"
          onClick={handleStageClick}
        >
          <span className="quantum-pet__aura" aria-hidden="true" />

          <span className="quantum-pet__body" aria-hidden="true" />

          <span className="quantum-pet__face" aria-hidden="true">
            <span className="quantum-pet__eyes" ref={eyesRef}>
              <span className="quantum-pet__eye" />
              <span className="quantum-pet__eye" />
            </span>

            {/* 口はチュートリアルの表情つきのときだけ出す。 */}
            {activeMood ? <span className="quantum-pet__mouth" /> : null}
          </span>
        </button>
      </div>
    </>
  )
}
