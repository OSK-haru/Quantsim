import type {
  PulseLabErrors,
  PulseLabForm,
  PulseModelId,
  QuasiStaticQuadratureOrder,
} from '../types/pulse'
import {
  COUPLED_TRANSMON_PAIR_PULSE_MODEL,
  QUTRIT_PULSE_MODEL,
  TWO_LEVEL_PULSE_MODEL,
} from '../types/pulse'
import type { PulseExecutionConstraints } from '../types/pulseCircuit'
import {
  matchingPulseDeviceProfile,
  pulseDeviceProfileConstraints,
  pulseDeviceProfiles,
} from '../utils/pulseDeviceProfiles'
import './PulseParameterPanel.css'

type PulseEnvironmentPanelProps = {
  form: PulseLabForm
  errors: PulseLabErrors
  disabled: boolean
  onChange: (next: PulseLabForm) => void
  executionConstraints: PulseExecutionConstraints
  onExecutionConstraintsChange: (next: PulseExecutionConstraints) => void
}

export function PulseEnvironmentPanel({
  form,
  errors,
  disabled,
  onChange,
  executionConstraints,
  onExecutionConstraintsChange,
}: PulseEnvironmentPanelProps) {
  const isQutrit = form.modelId === QUTRIT_PULSE_MODEL
  const isTransmon = form.modelId !== TWO_LEVEL_PULSE_MODEL
  const isPair = form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
  const activeDeviceProfile = matchingPulseDeviceProfile(executionConstraints)
  const setNumber = (field: keyof PulseLabForm, value: number) => {
    onChange({ ...form, [field]: value })
  }
  const setConstraint = (field: keyof PulseExecutionConstraints, value: number) => {
    onExecutionConstraintsChange({ ...executionConstraints, [field]: value })
  }

  return (
    <section className="pulse-parameters" aria-labelledby="pulse-environment-title">
      <div className="pulse-parameters__heading">
        <div>
          <span>GLOBAL EXECUTION CONDITIONS</span>
          <h2 id="pulse-environment-title">外界環境と実行設定</h2>
        </div>
        <p>ここで設定した条件は、Pulse回路内のすべてのブロックに共通で適用されます。</p>
      </div>

      <div className="pulse-parameters__selectors">
        <label>
          量子系モデル
          <select
            value={form.modelId}
            disabled={disabled}
            onChange={(event) => onChange({
              ...form,
              modelId: event.target.value as PulseModelId,
              evolutionMethod: form.evolutionMethod,
              dragBetaUs: event.target.value === TWO_LEVEL_PULSE_MODEL ? 0 : form.dragBetaUs,
            })}
          >
            <option value={TWO_LEVEL_PULSE_MODEL}>2準位モデル</option>
            <option value={QUTRIT_PULSE_MODEL}>Qutrit（漏れ準位あり）</option>
            <option value={COUPLED_TRANSMON_PAIR_PULSE_MODEL}>2トランズモン結合（9次元）</option>
          </select>
        </label>
        <label>
          環境入力
          <select
            value={form.environmentMode}
            disabled={disabled}
            onChange={(event) => onChange({
              ...form,
              environmentMode: event.target.value as PulseLabForm['environmentMode'],
            })}
          >
            <option value="physical">物理パラメータ</option>
            <option value="direct_rates">Lindblad率を直接指定</option>
          </select>
        </label>
        <label>
          発展方式
          <select
            value={form.evolutionMethod}
            disabled={disabled}
            onChange={(event) => onChange({
              ...form,
              evolutionMethod: event.target.value as PulseLabForm['evolutionMethod'],
            })}
          >
            <option value="fixed_step_rk4">Fixed-step RK4</option>
            <option value="explicit_cptp">Explicit CPTP maps</option>
          </select>
        </label>
        <label>
          バックエンド
          <select
            value={form.backend}
            disabled={disabled}
            onChange={(event) => onChange({
              ...form,
              backend: event.target.value as PulseLabForm['backend'],
            })}
          >
            <option value="auto">Auto（Rust優先）</option>
            <option value="rust">Rust dense</option>
            <option value="python">Python dense</option>
          </select>
        </label>
      </div>

      <div className="pulse-parameters__grid">
        <NumberField field="totalSimulationTimeUs" label="観測時間 [us]" value={form.totalSimulationTimeUs} error={errors.totalSimulationTimeUs} step={0.001} min={0} disabled={disabled} onChange={setNumber} />
        <NumberField field="snapshotCount" label="スナップショット数" value={form.snapshotCount} error={errors.snapshotCount} step={1} min={2} max={1001} disabled={disabled} onChange={setNumber} />
        {isTransmon ? (
          <NumberField field="anharmonicityMhz" label="非調和性 [MHz]" value={form.anharmonicityMhz} error={errors.anharmonicityMhz} step={10} max={0} disabled={disabled} onChange={setNumber} />
        ) : null}
      </div>

      {isPair ? (
        <div className="pulse-parameters__environment">
          <h3>2トランズモン結合モデル</h3>
          <p className="pulse-parameters__model-note">
            各トランズモンを3準位で打ち切り、交換結合 J(a0†a1 + a0a1†) を含む9次元モデルです。
          </p>
          <div className="pulse-parameters__grid">
            <NumberField field="pairSecondAnharmonicityMhz" label="q1 非調和性 [MHz]" value={form.pairSecondAnharmonicityMhz} error={errors.pairSecondAnharmonicityMhz} step={10} max={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="pairDetuningQ0RadPerUs" label="q0 基準離調 [rad/us]" value={form.pairDetuningQ0RadPerUs} error={errors.pairDetuningQ0RadPerUs} step={1} disabled={disabled} onChange={setNumber} />
            <NumberField field="pairDetuningQ1RadPerUs" label="q1 基準離調 [rad/us]" value={form.pairDetuningQ1RadPerUs} error={errors.pairDetuningQ1RadPerUs} step={1} disabled={disabled} onChange={setNumber} />
            <NumberField field="pairExchangeCouplingRadPerUs" label="交換結合 J [rad/us]" value={form.pairExchangeCouplingRadPerUs} error={errors.pairExchangeCouplingRadPerUs} step={0.5} min={0} disabled={disabled} onChange={setNumber} />
            <label>
              <span>駆動対象</span>
              <select
                value={form.pairDriveTarget}
                disabled={disabled}
                onChange={(event) => onChange({
                  ...form,
                  pairDriveTarget: Number(event.target.value) as 0 | 1,
                })}
              >
                <option value={0}>q0</option>
                <option value={1}>q1</option>
              </select>
            </label>
          </div>
          <h3>相関準静的離調ノイズ</h3>
          <div className="pulse-parameters__grid">
            <NumberField field="pairQuasiStaticSigmaQ0RadPerUs" label="q0 σ [rad/us]" value={form.pairQuasiStaticSigmaQ0RadPerUs} error={errors.pairQuasiStaticSigmaQ0RadPerUs} step={0.1} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="pairQuasiStaticSigmaQ1RadPerUs" label="q1 σ [rad/us]" value={form.pairQuasiStaticSigmaQ1RadPerUs} error={errors.pairQuasiStaticSigmaQ1RadPerUs} step={0.1} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="pairQuasiStaticCorrelation" label="相関係数 r" value={form.pairQuasiStaticCorrelation} error={errors.pairQuasiStaticCorrelation} step={0.1} min={-1} max={1} disabled={disabled} onChange={setNumber} />
            <label>
              <span>求積次数 / 軸</span>
              <select
                value={form.pairQuasiStaticQuadratureOrder}
                disabled={disabled}
                onChange={(event) => onChange({
                  ...form,
                  pairQuasiStaticQuadratureOrder: Number(event.target.value) as 3 | 5,
                })}
              >
                <option value={3}>3（9軌道）</option>
                <option value={5}>5（25軌道）</option>
              </select>
            </label>
          </div>
          <h3>同時セカンダリdrive</h3>
          <div className="pulse-parameters__grid">
            <label>
              <span>反対側のdrive</span>
              <select
                value={form.pairSecondaryDriveEnabled ? 'enabled' : 'disabled'}
                disabled={disabled}
                onChange={(event) => onChange({
                  ...form,
                  pairSecondaryDriveEnabled: event.target.value === 'enabled',
                })}
              >
                <option value="disabled">無効</option>
                <option value="enabled">有効</option>
              </select>
            </label>
            <label>
              <span>波形</span>
              <select value={form.pairSecondaryShape} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={(event) => onChange({ ...form, pairSecondaryShape: event.target.value as PulseLabForm['pairSecondaryShape'] })}>
                <option value="gaussian">Gaussian</option>
                <option value="square">Square</option>
              </select>
            </label>
            <label>
              <span>振幅指定</span>
              <select value={form.pairSecondaryAmplitudeMode} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={(event) => onChange({ ...form, pairSecondaryAmplitudeMode: event.target.value as PulseLabForm['pairSecondaryAmplitudeMode'] })}>
                <option value="target_rotation_angle">回転角</option>
                <option value="peak_amplitude">ピーク振幅</option>
              </select>
            </label>
            {form.pairSecondaryAmplitudeMode === 'target_rotation_angle' ? (
              <NumberField field="pairSecondaryTargetRotationAngleRad" label="副回転角 [rad]" value={form.pairSecondaryTargetRotationAngleRad} error={errors.pairSecondaryTargetRotationAngleRad} step={0.01} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            ) : (
              <NumberField field="pairSecondaryPeakAmplitudeRadPerUs" label="副ピーク [rad/us]" value={form.pairSecondaryPeakAmplitudeRadPerUs} error={errors.pairSecondaryPeakAmplitudeRadPerUs} step={0.1} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            )}
            {form.pairSecondaryShape === 'square' ? (
              <NumberField field="pairSecondaryPulseDurationUs" label="副Pulse幅 [us]" value={form.pairSecondaryPulseDurationUs} error={errors.pairSecondaryPulseDurationUs} step={0.001} min={0} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            ) : (
              <>
                <NumberField field="pairSecondarySigmaUs" label="副Gaussian σ [us]" value={form.pairSecondarySigmaUs} error={errors.pairSecondarySigmaUs} step={0.001} min={0} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
                <NumberField field="pairSecondaryTruncationSigma" label="副打ち切り [σ]" value={form.pairSecondaryTruncationSigma} error={errors.pairSecondaryTruncationSigma} step={0.5} min={0} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
              </>
            )}
            <NumberField field="pairSecondaryPhaseRad" label="副位相 [rad]" value={form.pairSecondaryPhaseRad} error={errors.pairSecondaryPhaseRad} step={0.05} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            <NumberField field="pairSecondaryDetuningRadPerUs" label="副離調 [rad/us]" value={form.pairSecondaryDetuningRadPerUs} error={errors.pairSecondaryDetuningRadPerUs} step={0.1} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            {form.pairSecondaryShape === 'gaussian' ? (
              <NumberField field="pairSecondaryDragBetaUs" label="副DRAG β [us]" value={form.pairSecondaryDragBetaUs} error={errors.pairSecondaryDragBetaUs} step={0.0001} disabled={disabled || !form.pairSecondaryDriveEnabled} onChange={setNumber} />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="pulse-parameters__environment">
        <h3>実行ハードウェア制約</h3>
        <div className="pulse-parameters__device-profile">
          <label>
            デバイスプロファイル
            <select
              value={activeDeviceProfile?.id ?? 'custom'}
              disabled={disabled}
              onChange={(event) => {
                const next = pulseDeviceProfileConstraints(event.target.value)
                if (next) onExecutionConstraintsChange(next)
              }}
            >
              {pulseDeviceProfiles.map((profile) => (
                <option value={profile.id} key={profile.id}>{profile.name}</option>
              ))}
              <option value="custom" disabled>カスタム</option>
            </select>
          </label>
          <p>
            {activeDeviceProfile?.description
              ?? '各制約を個別に変更したカスタム設定です。'}
            <strong> 実機校正値ではありません。</strong>
          </p>
        </div>
        <div className="pulse-parameters__grid">
          <ConstraintField field="maximumDriveAmplitudeRadPerUs" label="最大駆動振幅 [rad/us]" value={executionConstraints.maximumDriveAmplitudeRadPerUs} step={10} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="minimumPulseDurationUs" label="最小パルス幅 [us]" value={executionConstraints.minimumPulseDurationUs} step={0.001} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="awgSamplePeriodUs" label="AWGサンプル周期 [us]" value={executionConstraints.awgSamplePeriodUs} step={0.0001} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="phaseResolutionRad" label="位相分解能 [rad]" value={executionConstraints.phaseResolutionRad} step={0.001} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="amplitudeResolutionRadPerUs" label="振幅分解能 [rad/us]" value={executionConstraints.amplitudeResolutionRadPerUs} step={0.01} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="maximumDetuningRadPerUs" label="最大離調 [rad/us]" value={executionConstraints.maximumDetuningRadPerUs} step={10} min={0} disabled={disabled} onChange={setConstraint} />
          <ConstraintField field="interPulseGapUs" label="パルス間待機 [us]" value={executionConstraints.interPulseGapUs} step={0.001} min={0} disabled={disabled} onChange={setConstraint} />
        </div>
      </div>

      {isQutrit ? (
        <div className="pulse-parameters__environment">
          <h3>準静的ノイズ</h3>
          <p className="pulse-parameters__model-note">
            1回のショット中は一定で、ショット間でGaussian分布する周波数離調を密度行列のアンサンブル平均として計算します。
          </p>
          <div className="pulse-parameters__selectors">
            <label>
              <span>準静的離調ノイズ</span>
              <select
                value={form.quasiStaticNoiseEnabled ? 'enabled' : 'disabled'}
                disabled={disabled}
                onChange={(event) => onChange({
                  ...form,
                  quasiStaticNoiseEnabled: event.target.value === 'enabled',
                })}
              >
                <option value="disabled">無効</option>
                <option value="enabled">有効</option>
              </select>
            </label>
            <NumberField
              field="quasiStaticDetuningSigmaRadPerUs"
              label="離調の標準偏差 σ [rad/us]"
              value={form.quasiStaticDetuningSigmaRadPerUs}
              error={errors.quasiStaticDetuningSigmaRadPerUs}
              step={0.1}
              min={0}
              disabled={disabled || !form.quasiStaticNoiseEnabled}
              onChange={setNumber}
            />
            <label>
              <span>Gauss-Hermite求積次数</span>
              <select
                value={form.quasiStaticQuadratureOrder}
                disabled={disabled || !form.quasiStaticNoiseEnabled}
                onChange={(event) => onChange({
                  ...form,
                  quasiStaticQuadratureOrder: Number(event.target.value) as QuasiStaticQuadratureOrder,
                })}
              >
                {[3, 5, 7, 9].map((order) => <option key={order} value={order}>{order}</option>)}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      <div className="pulse-parameters__environment">
        <h3>{form.environmentMode === 'physical' ? '外界の物理環境' : '外界との結合率'}</h3>
        {form.environmentMode === 'physical' ? (
          <div className="pulse-parameters__grid">
            <NumberField field="deviceQuality" label="デバイス品質" value={form.deviceQuality} error={errors.deviceQuality} step={0.05} min={0} max={1} disabled={disabled} onChange={setNumber} />
            <NumberField field="temperatureMk" label="温度 [mK]" value={form.temperatureMk} error={errors.temperatureMk} step={1} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="fluxNoisePhi0" label="磁束ノイズ [Phi0]" value={form.fluxNoisePhi0} error={errors.fluxNoisePhi0} step={0.000001} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="qubitFrequencyGhz" label="量子ビット周波数 [GHz]" value={form.qubitFrequencyGhz} error={errors.qubitFrequencyGhz} step={0.1} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="t1MaxUs" label="最大 T1 [us]" value={form.t1MaxUs} error={errors.t1MaxUs} step={1} min={0} disabled={disabled} onChange={setNumber} />
            <NumberField field="tphiMaxUs" label="最大 Tphi [us]" value={form.tphiMaxUs} error={errors.tphiMaxUs} step={1} min={0} disabled={disabled} onChange={setNumber} />
          </div>
        ) : (
          <div className="pulse-parameters__grid">
            {isTransmon ? (
              <>
                <NumberField field="gamma10DownPerUs" label="gamma 10 down [1/us]" value={form.gamma10DownPerUs} error={errors.gamma10DownPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma01UpPerUs" label="gamma 01 up [1/us]" value={form.gamma01UpPerUs} error={errors.gamma01UpPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma21DownPerUs" label="gamma 21 down [1/us]" value={form.gamma21DownPerUs} error={errors.gamma21DownPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma12UpPerUs" label="gamma 12 up [1/us]" value={form.gamma12UpPerUs} error={errors.gamma12UpPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gammaPhiAdjacentPerUs" label="隣接準位の位相緩和 [1/us]" value={form.gammaPhiAdjacentPerUs} error={errors.gammaPhiAdjacentPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
              </>
            ) : (
              <>
                <NumberField field="gammaDownPerUs" label="gamma down [1/us]" value={form.gammaDownPerUs} error={errors.gammaDownPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gammaUpPerUs" label="gamma up [1/us]" value={form.gammaUpPerUs} error={errors.gammaUpPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gammaPhiPerUs" label="gamma phi [1/us]" value={form.gammaPhiPerUs} error={errors.gammaPhiPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

type ConstraintFieldProps = {
  field: keyof PulseExecutionConstraints
  label: string
  value: number
  step: number
  min: number
  disabled: boolean
  onChange: (field: keyof PulseExecutionConstraints, value: number) => void
}

function ConstraintField({ field, label, value, step, min, disabled, onChange }: ConstraintFieldProps) {
  return (
    <label className="pulse-parameters__field">
      <span>{label}</span>
      <input type="number" value={value} step={step} min={min} disabled={disabled} onChange={(event) => onChange(field, Number(event.target.value))} />
    </label>
  )
}

type NumberFieldProps = {
  field: keyof PulseLabForm
  label: string
  value: number
  error?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  onChange: (field: keyof PulseLabForm, value: number) => void
}

function NumberField({
  field,
  label,
  value,
  error,
  step = 1,
  min,
  max,
  disabled,
  onChange,
}: NumberFieldProps) {
  const errorId = `${String(field)}-environment-error`
  return (
    <label className="pulse-parameters__field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(field, Number(event.target.value))}
      />
      {error ? <small className="pulse-parameters__error" id={errorId}>{error}</small> : null}
    </label>
  )
}
