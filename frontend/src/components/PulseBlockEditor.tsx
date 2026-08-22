import './PulseBlockEditor.css'
import type { PulseLabForm } from '../types/pulse'
import type { PulseExecutionConstraints, PulseStepParameters } from '../types/pulseCircuit'
import { TWO_LEVEL_PULSE_MODEL } from '../types/pulse'
import { pulseWaveform } from '../utils/pulseLab'
import { applyPulseStepToForm, normalizeFramePhase, pulseStepDurationUs } from '../utils/pulseCircuit'
import { drivePulseConstraintIssues } from '../utils/pulseConstraints'

type PulseBlockEditorProps = {
  label: string
  pulse: PulseStepParameters
  globalForm: PulseLabForm
  constraints: PulseExecutionConstraints
  framePhaseRad: number
  dirty: boolean
  onChange: (pulse: PulseStepParameters) => void
  onSave: () => void
  onClose: () => void
}

export function PulseBlockEditor({
  label,
  pulse,
  globalForm,
  constraints,
  framePhaseRad,
  dirty,
  onChange,
  onSave,
  onClose,
}: PulseBlockEditorProps) {
  const form = applyPulseStepToForm(globalForm, pulse)
  const waveform = pulseWaveform(form, 65)
  const duration = Math.max(pulseStepDurationUs(pulse), 1e-12)
  const hasValidDuration = pulse.shape === 'square'
    ? Number.isFinite(pulse.pulseDurationUs) && pulse.pulseDurationUs > 0
    : Number.isFinite(pulse.sigmaUs)
      && pulse.sigmaUs > 0
      && Number.isFinite(pulse.truncationSigma)
      && pulse.truncationSigma > 0
  const hasValidAmplitude = pulse.amplitudeMode === 'target_rotation_angle'
    ? Number.isFinite(pulse.targetRotationAngleRad)
    : Number.isFinite(pulse.peakAmplitudeRadPerUs)
  const isValid = hasValidDuration
    && hasValidAmplitude
    && Number.isFinite(pulse.phaseRad)
    && Number.isFinite(pulse.detuningRadPerUs)
    && Number.isFinite(pulse.dragBetaUs)
  /* 実行時と同じ判定を編集中にも出す。保存はできるが、そのままでは実行できない。 */
  const constraintIssues = isValid ? drivePulseConstraintIssues(form, constraints) : []
  const peak = Math.max(...waveform.map((point) => Math.hypot(point.omegaX, point.omegaY)), 1e-12)
  const path = waveform.map((point, index) => {
    const x = 10 + (point.timeUs / duration) * 300
    const magnitude = Math.hypot(point.omegaX, point.omegaY)
    const y = 74 - (magnitude / peak) * 54
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  const effectivePhaseRad = normalizeFramePhase(pulse.phaseRad + framePhaseRad)

  function setValue<Key extends keyof PulseStepParameters>(
    key: Key,
    value: PulseStepParameters[Key],
  ) {
    onChange({ ...pulse, [key]: value })
  }

  return (
    <aside className="pulse-block-editor" aria-labelledby="pulse-block-editor-title" data-dirty={dirty}>
      <div className="pulse-block-editor__heading">
        <div>
          <span>Pulseブロック{dirty ? ' / 未保存' : ''}</span>
          <h2 id="pulse-block-editor-title">{label} をカスタマイズ</h2>
          <p>このブロック固有の制御波形だけを編集します。外界環境はPulse Labの共通設定です。</p>
        </div>
        <button
          type="button"
          className="pulse-block-editor__close"
          aria-label={dirty ? '編集を破棄して閉じる' : '編集画面を閉じる'}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="pulse-block-editor__body">
        <div className="pulse-block-editor__fields">
          <label>
            波形
            <select value={pulse.shape} onChange={(event) => setValue('shape', event.target.value as PulseStepParameters['shape'])}>
              <option value="gaussian">Gaussian</option>
              <option value="square">Square</option>
            </select>
          </label>
          <label>
            振幅の指定方法
            <select value={pulse.amplitudeMode} onChange={(event) => setValue('amplitudeMode', event.target.value as PulseStepParameters['amplitudeMode'])}>
              <option value="target_rotation_angle">回転角</option>
              <option value="peak_amplitude">ピーク振幅</option>
            </select>
          </label>
          {pulse.amplitudeMode === 'target_rotation_angle' ? (
            <NumberField label="回転角 [rad]" value={pulse.targetRotationAngleRad} step={0.01} onChange={(value) => setValue('targetRotationAngleRad', value)} />
          ) : (
            <NumberField label="ピーク振幅 [rad/us]" value={pulse.peakAmplitudeRadPerUs} step={0.1} onChange={(value) => setValue('peakAmplitudeRadPerUs', value)} />
          )}
          {pulse.shape === 'square' ? (
            <NumberField label="Pulse長 [us]" value={pulse.pulseDurationUs} step={0.001} min={0} onChange={(value) => setValue('pulseDurationUs', value)} />
          ) : (
            <>
              <NumberField label="Gaussian σ [us]" value={pulse.sigmaUs} step={0.001} min={0} onChange={(value) => setValue('sigmaUs', value)} />
              <NumberField label="打ち切り [σ]" value={pulse.truncationSigma} step={0.5} min={0} onChange={(value) => setValue('truncationSigma', value)} />
            </>
          )}
          <NumberField label="位相 [rad]" value={pulse.phaseRad} step={0.05} onChange={(value) => setValue('phaseRad', value)} />
          <NumberField label="離調 [rad/us]" value={pulse.detuningRadPerUs} step={0.1} onChange={(value) => setValue('detuningRadPerUs', value)} />
          {globalForm.modelId !== TWO_LEVEL_PULSE_MODEL && pulse.shape === 'gaussian' ? (
            <NumberField label="DRAG β [us]" value={pulse.dragBetaUs} step={0.0001} onChange={(value) => setValue('dragBetaUs', value)} />
          ) : null}
        </div>

        <section className="pulse-block-editor__preview" aria-label="Pulse波形プレビュー">
          <div>
            <span>波形プレビュー</span>
            <strong>{pulseStepDurationUs(pulse).toPrecision(4)} us</strong>
          </div>
          <svg viewBox="0 0 320 84" role="img" aria-label={`${label}の振幅波形`}>
            <line x1="10" y1="74" x2="310" y2="74" />
            <path d={path} />
          </svg>
          <dl>
            <div><dt>位相</dt><dd>{pulse.phaseRad.toFixed(3)} rad</dd></div>
            <div>
              <dt>実効位相</dt>
              <dd>{effectivePhaseRad.toFixed(3)} rad</dd>
            </div>
            <div><dt>離調</dt><dd>{pulse.detuningRadPerUs.toFixed(3)} rad/us</dd></div>
            <div><dt>環境</dt><dd>グローバル</dd></div>
          </dl>
          <p className="pulse-block-editor__frame-note">
            実効位相 = 位相 {pulse.phaseRad.toFixed(3)} + 手前のVirtual Zフレーム {framePhaseRad.toFixed(3)} rad
          </p>
        </section>
      </div>

      {constraintIssues.length > 0 ? (
        <ul className="pulse-block-editor__constraints" aria-label="ハードウェア制約の違反">
          {constraintIssues.map((message) => <li key={message}>{message}</li>)}
        </ul>
      ) : null}

      <div className="pulse-block-editor__actions">
        {!isValid ? <span role="alert">有限値と0より大きいPulse長を入力してください。</span> : null}
        <button type="button" onClick={onClose}>{dirty ? '変更を破棄' : '閉じる'}</button>
        <button type="button" className="pulse-block-editor__save" disabled={!isValid || !dirty} onClick={onSave}>
          {dirty ? 'ブロックへ保存' : '保存済み'}
        </button>
      </div>
    </aside>
  )
}

function NumberField({
  label,
  value,
  step,
  min,
  onChange,
}: {
  label: string
  value: number
  step: number
  min?: number
  onChange: (value: number) => void
}) {
  return (
    <label>
      {label}
      <input type="number" value={value} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
