import { useRef, useState } from 'react'
import './PulseCircuitStudioPage.css'
import { PulseBlockEditor } from '../components/PulseBlockEditor'
import { QuantumPet } from '../components/QuantumPet'
import type { PulseLabForm } from '../types/pulse'
import type {
  PulseCircuitState,
  PulseCircuitStep,
  PulsePrimitive,
  PulseStepParameters,
} from '../types/pulseCircuit'
import {
  createPulseCircuitStep,
  isDrivePulseStep,
  normalizeFramePhase,
  pulseStepDurationUs,
  resizePulseCircuit,
} from '../utils/pulseCircuit'
import { matchingPulseDeviceProfile } from '../utils/pulseDeviceProfiles'
import { pulseCircuitStudioTips } from '../utils/quantumPetTips'

type PulseCircuitStudioPageProps = {
  circuit: PulseCircuitState
  currentForm: PulseLabForm
  onCircuitChange: (circuit: PulseCircuitState) => void
  onSelectPulseForRun: (transmonIndex: number, pulse: PulseStepParameters) => void
}

const palette: Array<{ primitive: PulsePrimitive; label: string; detail: string }> = [
  { primitive: 'x90', label: 'X/2', detail: 'X軸周りに+90°' },
  { primitive: 'x180', label: 'X', detail: 'X軸周りに+180°' },
  { primitive: 'y90', label: 'Y/2', detail: 'Y軸周りに+90°' },
  { primitive: 'y180', label: 'Y', detail: 'Y軸周りに+180°' },
  { primitive: 'custom', label: 'Custom', detail: '現在のPulse設定' },
  { primitive: 'virtual_z', label: 'VZ', detail: 'ゼロ時間の位相フレーム更新' },
]

export function PulseCircuitStudioPage({
  circuit,
  currentForm,
  onCircuitChange,
  onSelectPulseForRun,
}: PulseCircuitStudioPageProps) {
  const firstStep = circuit.lanes.flatMap((lane) => lane.steps)[0] ?? null
  const [selectedTransmonIndex, setSelectedTransmonIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(firstStep?.id ?? null)
  const [draftPulse, setDraftPulse] = useState<PulseStepParameters | null>(
    firstStep && isDrivePulseStep(firstStep) ? { ...firstStep.pulse } : null,
  )
  const [draftVirtualZAngle, setDraftVirtualZAngle] = useState<number | null>(
    firstStep?.operation === 'virtual_z' ? firstStep.angleRad : null,
  )
  const idCounter = useRef(circuit.lanes.reduce((count, lane) => count + lane.steps.length, 0))
  const selectedStep = findStep(circuit, selectedId)
  const totalPulseCount = circuit.lanes.reduce((count, lane) => count + lane.steps.length, 0)
  const transmonCount = circuit.transmons.length
  const deviceProfile = matchingPulseDeviceProfile(circuit.executionConstraints)

  function updateLane(transmonIndex: number, steps: PulseCircuitStep[]) {
    onCircuitChange({
      ...circuit,
      lanes: circuit.lanes.map((lane) => (
        lane.transmonIndex === transmonIndex ? { ...lane, steps } : lane
      )),
    })
  }

  function addStep(primitive: PulsePrimitive) {
    const lane = circuit.lanes[selectedTransmonIndex]
    if (!lane) {
      return
    }
    idCounter.current += 1
    const step = createPulseCircuitStep(
      primitive,
      currentForm,
      `pulse-q${selectedTransmonIndex}-step-${idCounter.current}`,
    )
    updateLane(selectedTransmonIndex, [...lane.steps, step])
    selectStep(selectedTransmonIndex, step)
  }

  function removeStep(transmonIndex: number, id: string) {
    const lane = circuit.lanes[transmonIndex]
    if (!lane) {
      return
    }
    const index = lane.steps.findIndex((step) => step.id === id)
    const next = lane.steps.filter((step) => step.id !== id)
    updateLane(transmonIndex, next)
    if (selectedId === id) {
      const nextSelected = next[Math.min(index, Math.max(next.length - 1, 0))] ?? null
      setSelectedId(nextSelected?.id ?? null)
      setDraftPulse(nextSelected && isDrivePulseStep(nextSelected) ? { ...nextSelected.pulse } : null)
      setDraftVirtualZAngle(nextSelected?.operation === 'virtual_z' ? nextSelected.angleRad : null)
      if (nextSelected && isDrivePulseStep(nextSelected)) {
        onSelectPulseForRun(transmonIndex, nextSelected.pulse)
      }
    }
  }

  function moveStep(transmonIndex: number, index: number, offset: number) {
    const lane = circuit.lanes[transmonIndex]
    const destination = index + offset
    if (!lane || destination < 0 || destination >= lane.steps.length) {
      return
    }
    const next = [...lane.steps]
    const [step] = next.splice(index, 1)
    next.splice(destination, 0, step)
    updateLane(transmonIndex, next)
  }

  function selectStep(transmonIndex: number, step: PulseCircuitStep) {
    setSelectedTransmonIndex(transmonIndex)
    setSelectedId(step.id)
    if (isDrivePulseStep(step)) {
      setDraftPulse({ ...step.pulse })
      setDraftVirtualZAngle(null)
      onSelectPulseForRun(transmonIndex, step.pulse)
    } else {
      setDraftPulse(null)
      setDraftVirtualZAngle(step.angleRad)
    }
  }

  function saveDraft() {
    if (!selectedStep) {
      return
    }
    const lane = circuit.lanes[selectedStep.transmonIndex]
    if (!lane) {
      return
    }
    if (selectedStep.step.operation === 'virtual_z') {
      if (draftVirtualZAngle === null || !Number.isFinite(draftVirtualZAngle)) {
        return
      }
      updateLane(
        selectedStep.transmonIndex,
        lane.steps.map((step) => (
          step.id === selectedStep.step.id && step.operation === 'virtual_z'
            ? { ...step, angleRad: normalizeFramePhase(draftVirtualZAngle) }
            : step
        )),
      )
      setDraftVirtualZAngle(normalizeFramePhase(draftVirtualZAngle))
      return
    }
    if (!draftPulse) {
      return
    }
    updateLane(selectedStep.transmonIndex, lane.steps.map((step) => (
      step.id === selectedStep.step.id && step.operation === 'drive'
        ? { ...step, pulse: { ...draftPulse } }
        : step
    )))
    onSelectPulseForRun(selectedStep.transmonIndex, draftPulse)
  }

  function changeTransmonCount(count: number) {
    const next = resizePulseCircuit(circuit, count)
    onCircuitChange(next)
    const nextSelectedIndex = Math.min(selectedTransmonIndex, next.transmons.length - 1)
    setSelectedTransmonIndex(nextSelectedIndex)
    if (selectedStep && selectedStep.transmonIndex >= next.transmons.length) {
      setSelectedId(null)
      setDraftPulse(null)
      setDraftVirtualZAngle(null)
    }
  }

  return (
    <main className="pulse-circuit-studio">
      <header className="pulse-circuit-studio__header">
        <div>
          <span className="pulse-circuit-studio__eyebrow">Yuragi-Strider / Pulseワークスペース</span>
          <h1>Pulse 回路スタジオ</h1>
          <p>トランズモンごとの制御レーンへPulseを配置します。Gate-aware回路とは状態を共有しません。</p>
        </div>
        <div className="pulse-circuit-studio__summary">
          <span>{transmonCount} トランズモン</span>
          <strong>{totalPulseCount} Pulse</strong>
        </div>
      </header>

      <aside className="pulse-circuit-studio__notice">
        回路データは複数トランズモン対応です。現行バックエンドは選択中の単一Pulseのみ実行し、複数トランズモン結合は将来の実行エンジンで接続します。
      </aside>

      <section className="pulse-circuit-studio__environment" aria-label="Pulse回路の環境設定">
        <div>
          <span>システム全体</span>
          <strong>回路全体の構成</strong>
        </div>
        <label className="pulse-circuit-studio__transmon-count">
          トランズモン数
          <select value={transmonCount} onChange={(event) => changeTransmonCount(Number(event.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option value={count} key={count}>{count}</option>)}
          </select>
        </label>
        <dl>
          <div><dt>デバイス</dt><dd>{deviceProfile?.name ?? 'カスタム'}</dd></div>
          <div><dt>温度</dt><dd>{currentForm.temperatureMk} mK</dd></div>
          <div><dt>デバイス品質</dt><dd>{currentForm.deviceQuality.toFixed(2)}</dd></div>
          <div><dt>発展方式</dt><dd>{currentForm.evolutionMethod === 'explicit_cptp' ? 'Explicit CPTP' : 'RK4'}</dd></div>
          <div><dt>最大駆動</dt><dd>{circuit.executionConstraints.maximumDriveAmplitudeRadPerUs} rad/us</dd></div>
          <div><dt>AWG刻み</dt><dd>{circuit.executionConstraints.awgSamplePeriodUs} us</dd></div>
          <div><dt>パルス間隔</dt><dd>{circuit.executionConstraints.interPulseGapUs} us</dd></div>
        </dl>
      </section>

      <section className="pulse-circuit-studio__workspace">
        <aside className="pulse-circuit-studio__palette" aria-label="Pulseパレット">
          <div>
            <span>プリミティブ / q{selectedTransmonIndex}</span>
            <h2>Pulseを追加</h2>
          </div>
          {palette.map((item) => (
            <button type="button" key={item.primitive} onClick={() => addStep(item.primitive)}>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </button>
          ))}
        </aside>

        <section className="pulse-circuit-studio__sequence" aria-labelledby="pulse-sequence-title">
          <div className="pulse-circuit-studio__sequence-heading">
            <div>
              <span>複数トランズモンシーケンス</span>
              <h2 id="pulse-sequence-title">Pulseタイムライン</h2>
            </div>
            <button
              type="button"
              className="pulse-circuit-studio__clear"
              disabled={totalPulseCount === 0}
              onClick={() => {
                onCircuitChange({
                  ...circuit,
                  lanes: circuit.lanes.map((lane) => ({ ...lane, steps: [] })),
                })
                setSelectedId(null)
                setDraftPulse(null)
                setDraftVirtualZAngle(null)
              }}
            >
              すべて削除
            </button>
          </div>

          <div className="pulse-circuit-studio__lanes">
            {circuit.lanes.map((lane) => (
              <div
                className="pulse-circuit-studio__track"
                data-active={lane.transmonIndex === selectedTransmonIndex}
                key={lane.transmonIndex}
                onClick={() => setSelectedTransmonIndex(lane.transmonIndex)}
              >
                <button
                  type="button"
                  className="pulse-circuit-studio__line-label"
                  aria-pressed={lane.transmonIndex === selectedTransmonIndex}
                  onClick={() => setSelectedTransmonIndex(lane.transmonIndex)}
                >
                  <strong>{circuit.transmons[lane.transmonIndex]?.label ?? `q${lane.transmonIndex}`}</strong>
                  <small>|0⟩ / 駆動</small>
                </button>
                {lane.steps.length === 0 ? (
                  <p className="pulse-circuit-studio__lane-empty">q{lane.transmonIndex}を選択してPulseを追加</p>
                ) : (
                  <div className="pulse-circuit-studio__steps">
                    {lane.steps.map((step, index) => (
                      <article
                        className="pulse-circuit-studio__step"
                        data-operation={step.operation}
                        data-selected={step.id === selectedId}
                        key={step.id}
                      >
                        <button type="button" className="pulse-circuit-studio__step-main" aria-pressed={step.id === selectedId} onClick={() => selectStep(lane.transmonIndex, step)}>
                          <span>{index + 1}</span>
                          <strong>{step.label}</strong>
                          <small>
                            {isDrivePulseStep(step)
                              ? `${pulseStepDurationUs(step.pulse).toPrecision(3)} us`
                              : `frame ${normalizeFramePhase(framePhaseAtStep(lane.steps, index)).toFixed(3)} rad`}
                          </small>
                        </button>
                        <div className="pulse-circuit-studio__step-actions">
                          <button type="button" aria-label="左へ移動" disabled={index === 0} onClick={() => moveStep(lane.transmonIndex, index, -1)}>←</button>
                          <button type="button" aria-label="右へ移動" disabled={index === lane.steps.length - 1} onClick={() => moveStep(lane.transmonIndex, index, 1)}>→</button>
                          <button type="button" aria-label={`${step.label}を削除`} onClick={() => removeStep(lane.transmonIndex, step.id)}>×</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedStep?.step.operation === 'drive' && draftPulse ? (
            <PulseBlockEditor
              label={`q${selectedStep.transmonIndex} / ${selectedStep.step.label}`}
              pulse={draftPulse}
              globalForm={currentForm}
              onChange={setDraftPulse}
              onSave={saveDraft}
              onClose={() => setDraftPulse(null)}
            />
          ) : null}
          {selectedStep?.step.operation === 'virtual_z' && draftVirtualZAngle !== null ? (
            <aside className="pulse-circuit-studio__virtual-z-editor">
              <div>
                <span>PHASE FRAME / q{selectedStep.transmonIndex}</span>
                <h2>Virtual Zを編集</h2>
                <p>時間を進めず、以後の論理位相フレームを更新します。</p>
              </div>
              <label>
                回転角 λ [rad]
                <input type="number" step="0.05" value={draftVirtualZAngle} onChange={(event) => setDraftVirtualZAngle(Number(event.target.value))} />
              </label>
              <div className="pulse-circuit-studio__virtual-z-presets">
                {[Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => (
                  <button type="button" key={angle} onClick={() => setDraftVirtualZAngle(angle)}>{formatPhase(angle)}</button>
                ))}
              </div>
              <button type="button" className="pulse-circuit-studio__virtual-z-save" disabled={!Number.isFinite(draftVirtualZAngle)} onClick={saveDraft}>フレーム更新を保存</button>
            </aside>
          ) : null}
        </section>
      </section>
      {/* ここは実行しない編集ページなので、ペットはガイド役だけ。 */}
      <QuantumPet phase="idle" tips={pulseCircuitStudioTips} />
    </main>
  )
}

function framePhaseAtStep(steps: PulseCircuitStep[], inclusiveIndex: number): number {
  return steps.slice(0, inclusiveIndex + 1).reduce(
    (phase, step) => phase + (step.operation === 'virtual_z' ? step.angleRad : 0),
    0,
  )
}

function formatPhase(angleRad: number): string {
  const ratio = angleRad / Math.PI
  if (ratio === 1) return 'π'
  if (ratio === 0.5) return 'π/2'
  if (ratio === 0.25) return 'π/4'
  if (ratio === -0.5) return '-π/2'
  return `${angleRad.toFixed(3)} rad`
}

function findStep(
  circuit: PulseCircuitState,
  stepId: string | null,
): { transmonIndex: number; step: PulseCircuitStep } | null {
  if (!stepId) {
    return null
  }
  for (const lane of circuit.lanes) {
    const step = lane.steps.find((candidate) => candidate.id === stepId)
    if (step) {
      return { transmonIndex: lane.transmonIndex, step }
    }
  }
  return null
}
