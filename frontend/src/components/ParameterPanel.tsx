import './ParameterPanel.css'
import { SectionHeader } from './SectionHeader'
import type {
  GateDurationDefaultErrors,
  GateDurationDefaults,
  SimulateRequestParameterErrors,
  SimulateRequestParameters,
  SimulationParameters,
} from '../types/simulation'

type ParameterPanelProps = {
  parameters: SimulationParameters
  editableParameters: SimulateRequestParameters
  gateDurationDefaults: GateDurationDefaults
  validationMessages: SimulateRequestParameterErrors
  gateDurationValidationMessages: GateDurationDefaultErrors
  onEditableParametersChange: (parameters: SimulateRequestParameters) => void
  onGateDurationDefaultsChange: (gateDurations: GateDurationDefaults) => void
}

type EditableParameterName = keyof SimulateRequestParameters
type GateDurationName = keyof GateDurationDefaults

const parameterRanges: Record<
  EditableParameterName,
  { min: number; max?: number; step: number }
> = {
  device_quality: { min: 0, max: 1, step: 0.01 },
  temperature_mk: { min: 0, step: 1 },
  flux_noise_phi0: { min: 0, step: 0.000001 },
  qubit_frequency_ghz: { min: 0.001, step: 0.1 },
  t1_max_us: { min: 0.001, step: 1 },
  tphi_max_us: { min: 0.001, step: 1 },
  duration_us: { min: 0.001, step: 0.1 },
  time_steps: { min: 2, step: 1 },
  fidelity_threshold: { min: 0, max: 1, step: 0.01 },
}

const gateDurationRanges: Record<
  GateDurationName,
  { min: number; step: number }
> = {
  H: { min: 0.001, step: 0.01 },
  X: { min: 0.001, step: 0.01 },
  Z: { min: 0, step: 0.01 },
  CNOT: { min: 0.001, step: 0.01 },
  MEASURE: { min: 0, step: 0.01 },
}

function clampParameterValue(name: EditableParameterName, value: number) {
  const range = parameterRanges[name]
  const maxClamped = range.max === undefined ? value : Math.min(value, range.max)
  const minClamped = Math.max(maxClamped, range.min)
  return name === 'time_steps' ? Math.round(minClamped) : minClamped
}

function clampGateDurationValue(name: GateDurationName, value: number) {
  const range = gateDurationRanges[name]
  return Math.max(value, range.min)
}

export function ParameterPanel({
  parameters,
  editableParameters,
  gateDurationDefaults,
  validationMessages,
  gateDurationValidationMessages,
  onEditableParametersChange,
  onGateDurationDefaultsChange,
}: ParameterPanelProps) {
  function updateParameter(name: EditableParameterName, value: number) {
    if (!Number.isFinite(value)) {
      return
    }

    onEditableParametersChange({
      ...editableParameters,
      [name]: clampParameterValue(name, value),
    })
  }

  function updateGateDuration(name: GateDurationName, value: number) {
    if (!Number.isFinite(value)) {
      return
    }

    onGateDurationDefaultsChange({
      ...gateDurationDefaults,
      [name]: clampGateDurationValue(name, value),
    })
  }

  function renderNumberInput(
    name: EditableParameterName,
    label: string,
    hint: string,
  ) {
    const range = parameterRanges[name]
    const validationMessage = validationMessages[name]
    return (
      <label className="parameter-panel__field">
        <span className="parameter-panel__field-label">{label}</span>
        <input
          className={`parameter-panel__input${
            validationMessage ? ' parameter-panel__input--invalid' : ''
          }`}
          type="number"
          min={range.min}
          max={range.max}
          step={range.step}
          value={editableParameters[name]}
          aria-invalid={validationMessage ? 'true' : undefined}
          onChange={(event) => updateParameter(name, event.currentTarget.valueAsNumber)}
        />
        <span className="parameter-panel__hint">{hint}</span>
        {validationMessage ? (
          <span className="parameter-panel__validation">{validationMessage}</span>
        ) : null}
      </label>
    )
  }

  function renderGateDurationInput(name: GateDurationName, label: string) {
    const range = gateDurationRanges[name]
    const validationMessage = gateDurationValidationMessages[name]
    return (
      <label className="parameter-panel__field">
        <span className="parameter-panel__field-label">{label}</span>
        <input
          className={`parameter-panel__input${
            validationMessage ? ' parameter-panel__input--invalid' : ''
          }`}
          type="number"
          min={range.min}
          step={range.step}
          value={gateDurationDefaults[name]}
          aria-invalid={validationMessage ? 'true' : undefined}
          onChange={(event) => updateGateDuration(name, event.currentTarget.valueAsNumber)}
        />
        {validationMessage ? (
          <span className="parameter-panel__validation">{validationMessage}</span>
        ) : null}
      </label>
    )
  }

  return (
    <section className="parameter-panel" aria-label="シミュレーションパラメーター">
      <div className="parameter-panel__header">
        <SectionHeader
          icon="chip"
          eyebrow="パラメーター"
          title="シミュレーションパラメーター"
        />
        <p className="parameter-panel__note">
          校正済みのハードウェアモデルではなく、学習用の一般的なプロファイルです。
        </p>
      </div>

      <div className="parameter-panel__sections">
        <article className="parameter-panel__section">
          <SectionHeader
            className="parameter-panel__section-header"
            icon="chip"
            title="デバイス"
            headingLevel="h3"
          />
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'device_quality',
              'デバイス品質',
              '学習用デバイスモデルで使用する 0〜1 の抽象的なプロファイル値です。',
            )}
            {renderNumberInput(
              'qubit_frequency_ghz',
              '量子ビット周波数 [GHz]',
              '0 より大きい値',
            )}
            {renderNumberInput(
              't1_max_us',
              '最大 T1 [\u03bcs]',
              '0 より大きい値',
            )}
            {renderNumberInput(
              'tphi_max_us',
              '最大 T\u03c6 [\u03bcs]',
              '0 より大きい値',
            )}
          </div>
        </article>

        <article className="parameter-panel__section">
          <SectionHeader
            className="parameter-panel__section-header"
            icon="thermometer"
            title="環境"
            headingLevel="h3"
          />
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'temperature_mk',
              '温度 [mK]',
              '0 以上',
            )}
            {renderNumberInput(
              'flux_noise_phi0',
              '磁束ノイズ [\u03a60]',
              '0 以上',
            )}
          </div>
        </article>

        <article className="parameter-panel__section">
          <SectionHeader
            className="parameter-panel__section-header"
            icon="clock"
            title="シミュレーション時間"
            headingLevel="h3"
          />
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'duration_us',
              '総シミュレーション時間 [\u03bcs]',
              'ゲート操作時間と、回路完了後の待機・観測時間を含みます。',
            )}
            {renderNumberInput('time_steps', '時間ステップ数', '2 以上の整数')}
            {renderNumberInput(
              'fidelity_threshold',
              '忠実度のしきい値',
              '0.0〜1.0',
            )}
          </div>
        </article>

        <article className="parameter-panel__section">
          <SectionHeader
            className="parameter-panel__section-header"
            icon="stopwatch"
            title="ゲート時間のデフォルト"
            headingLevel="h3"
          />
          <p className="parameter-panel__section-note">
            現在のプリセットで各ゲート種別に使用するデフォルトの操作時間です。
          </p>
          <div className="parameter-panel__fields parameter-panel__fields--compact">
            {renderGateDurationInput('H', 'H [\u03bcs]')}
            {renderGateDurationInput('X', 'X [\u03bcs]')}
            {renderGateDurationInput('Z', 'Z [\u03bcs]')}
            {renderGateDurationInput('CNOT', 'CNOT [\u03bcs]')}
            {renderGateDurationInput('MEASURE', '測定 [\u03bcs]')}
          </div>
        </article>
      </div>

      <dl className="parameter-panel__snapshot" aria-label="最新の応答情報">
        <div className="parameter-panel__snapshot-item">
          <dt>入力モード</dt>
          <dd>{parameters.input_mode}</dd>
        </div>
        <div className="parameter-panel__snapshot-item">
          <dt>バックエンド</dt>
          <dd>{parameters.simulation_backend}</dd>
        </div>
        <div className="parameter-panel__snapshot-item">
          <dt>最新の実行時間</dt>
          <dd>{parameters.duration_us.toFixed(2)} us</dd>
        </div>
      </dl>
    </section>
  )
}
