import { useEffect } from 'react'
import './SimulationCompletionPopup.css'

export type SimulationCompletionPopupMode = 'gate-aware' | 'pulse'

type SimulationCompletionPopupProps = {
  mode: SimulationCompletionPopupMode
  title: string
  detail: string
  onDismiss: () => void
}

export function SimulationCompletionPopup({
  mode,
  title,
  detail,
  onDismiss,
}: SimulationCompletionPopupProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, 4200)
    return () => window.clearTimeout(timeoutId)
  }, [onDismiss])

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
      id="simulation-completion-wobble"
      x="-20%"
      y="-50%"
      width="140%"
      height="200%"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.012 0.035"
        numOctaves="2"
        seed="8"
        result="noise"
      >
        <animate
          attributeName="baseFrequency"
          dur="4.8s"
          values="
            0.012 0.035;
            0.020 0.025;
            0.010 0.045;
            0.017 0.030;
            0.012 0.035
          "
          repeatCount="indefinite"
        />

        <animate
          attributeName="seed"
          dur="8s"
          values="8;14;21;27;8"
          repeatCount="indefinite"
        />
      </feTurbulence>

      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="13"
        xChannelSelector="R"
        yChannelSelector="B"
      >
        <animate
          attributeName="scale"
          dur="3.6s"
          values="8;17;11;20;10;8"
          repeatCount="indefinite"
        />
      </feDisplacementMap>
    </filter>
  </svg>

  <div className={`simulation-completion-popup simulation-completion-popup--${mode}`} role="status" aria-live="polite">
    <div className="simulation-completion-popup__inner">
      <div className="simulation-completion-popup__glow" />
      <div className="simulation-completion-popup__fluctuation" />

      <div className="simulation-completion-popup__content">
        <span className="simulation-completion-popup__eyebrow">
          {mode === 'gate-aware' ? 'GATE-AWARE' : 'PULSE LAB'}
        </span>

        <strong>{title}</strong>

        <span>{detail}</span>
      </div>
    </div>

    <button
      type="button"
      className="simulation-completion-popup__close"
      aria-label="閉じる"
      onClick={onDismiss}
    >
      ×
    </button>
  </div>
</>
  )
}
