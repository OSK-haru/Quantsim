import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import './LabDial.css'

type LabDialProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  hint?: string
  validationMessage?: string
  formatValue?: (value: number) => string
  onChange: (value: number) => void
}

const CENTER = 60
const RADIUS = 44
const START_ANGLE = -135
const END_ANGLE = 135
const SWEEP = END_ANGLE - START_ANGLE
const TICK_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1]

function polarPoint(angleDeg: number, radius: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  }
}

function describeArc(startAngle: number, endAngle: number, radius: number) {
  const start = polarPoint(endAngle, radius)
  const end = polarPoint(startAngle, radius)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundToStep(value: number, min: number, step: number) {
  if (step <= 0) {
    return value
  }
  const steps = Math.round((value - min) / step)
  return min + steps * step
}

function defaultFormat(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2)
}

export function LabDial({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  validationMessage,
  formatValue = defaultFormat,
  onChange,
}: LabDialProps) {
  const reactId = useId()
  const labelId = `lab-dial-label-${reactId}`
  const gaugeRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState('')

  const boundedMax = Math.max(max, min + step)
  const fraction = clamp((value - min) / (boundedMax - min), 0, 1)
  const needleAngle = START_ANGLE + fraction * SWEEP
  const needleTip = polarPoint(needleAngle, RADIUS - 8)
  const trackPath = describeArc(START_ANGLE, END_ANGLE, RADIUS)
  const valuePath = describeArc(START_ANGLE, needleAngle, RADIUS)

  function commit(nextValue: number) {
    if (!Number.isFinite(nextValue)) {
      return
    }
    // `max` is only the gauge's visual full-scale (the needle pins at it like a
    // real meter); typed/keyboard values may legitimately exceed it, so only the
    // physical minimum is enforced here. The caller re-applies true domain limits.
    onChange(Math.max(min, roundToStep(nextValue, min, step)))
  }

  function valueFromPointer(clientX: number, clientY: number) {
    const gauge = gaugeRef.current
    if (!gauge) {
      return null
    }
    const rect = gauge.getBoundingClientRect()
    const scaleX = 120 / rect.width
    const scaleY = 120 / rect.height
    const x = (clientX - rect.left) * scaleX - CENTER
    const y = (clientY - rect.top) * scaleY - CENTER
    let angleDeg = (Math.atan2(x, -y) * 180) / Math.PI

    if (angleDeg > END_ANGLE && angleDeg <= 180) {
      angleDeg = END_ANGLE
    } else if (angleDeg < START_ANGLE && angleDeg >= -180) {
      angleDeg = START_ANGLE
    }

    const pointerFraction = clamp((angleDeg - START_ANGLE) / SWEEP, 0, 1)
    return min + pointerFraction * (boundedMax - min)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isEditing) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    const nextValue = valueFromPointer(event.clientX, event.clientY)
    if (nextValue !== null) {
      commit(nextValue)
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDragging) {
      return
    }
    const nextValue = valueFromPointer(event.clientX, event.clientY)
    if (nextValue !== null) {
      commit(nextValue)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const bigStep = step * 10
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      commit(value + (event.shiftKey ? bigStep : step))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      commit(value - (event.shiftKey ? bigStep : step))
    } else if (event.key === 'Home') {
      event.preventDefault()
      commit(min)
    } else if (event.key === 'End') {
      event.preventDefault()
      commit(max)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      setDraftText(String(value))
      setIsEditing(true)
    }
  }

  function openEditor() {
    setDraftText(String(value))
    setIsEditing(true)
  }

  function commitEditor() {
    const parsed = Number(draftText)
    if (Number.isFinite(parsed)) {
      commit(parsed)
    }
    setIsEditing(false)
  }

  return (
    <div className="lab-dial">
      <span className="lab-dial__label" id={labelId}>{label}</span>
      <div
        ref={gaugeRef}
        className={`lab-dial__gauge${isDragging ? ' lab-dial__gauge--dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${formatValue(value)}${unit ? ` ${unit}` : ''}`}
        aria-invalid={validationMessage ? 'true' : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <svg viewBox="0 0 120 120" className="lab-dial__svg" aria-hidden="true">
          <path className="lab-dial__track" d={trackPath} />
          {TICK_FRACTIONS.map((tickFraction) => {
            const angle = START_ANGLE + tickFraction * SWEEP
            const outer = polarPoint(angle, RADIUS + 4)
            const inner = polarPoint(angle, RADIUS - 3)
            return (
              <line
                key={tickFraction}
                className="lab-dial__tick"
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
              />
            )
          })}
          <path className="lab-dial__value-arc" d={valuePath} />
          <line
            className="lab-dial__needle"
            x1={CENTER}
            y1={CENTER}
            x2={needleTip.x}
            y2={needleTip.y}
            style={isDragging ? { transition: 'none' } : undefined}
          />
          <circle className="lab-dial__hub" cx={CENTER} cy={CENTER} r={5} />
        </svg>
        <div className="lab-dial__readout">
          {isEditing ? (
            <input
              className="lab-dial__readout-input"
              type="number"
              min={min}
              max={max}
              step={step}
              value={draftText}
              autoFocus
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => setDraftText(event.target.value)}
              onBlur={commitEditor}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  commitEditor()
                } else if (event.key === 'Escape') {
                  setIsEditing(false)
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="lab-dial__readout-value"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={openEditor}
              aria-label={`${label} を直接入力`}
            >
              {formatValue(value)}
              {unit ? <span className="lab-dial__unit">{unit}</span> : null}
            </button>
          )}
        </div>
      </div>
      {hint ? <span className="lab-dial__hint">{hint}</span> : null}
      {validationMessage ? <span className="lab-dial__validation">{validationMessage}</span> : null}
    </div>
  )
}
