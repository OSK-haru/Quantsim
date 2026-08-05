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
  Y: { min: 0.001, step: 0.01 },
  Z: { min: 0, step: 0.01 },
  S: { min: 0, step: 0.01 },
  T: { min: 0, step: 0.01 },
  RX: { min: 0.001, step: 0.01 },
  RY: { min: 0.001, step: 0.01 },
  RZ: { min: 0.001, step: 0.01 },
  CNOT: { min: 0.001, step: 0.01 },
  CZ: { min: 0.001, step: 0.01 },
  SWAP: { min: 0.001, step: 0.01 },
  CP: { min: 0.001, step: 0.01 },
  CCX: { min: 0.001, step: 0.01 },
  MEASURE: { min: 0, step: 0.01 },
  RECEIVED: { min: 0, step: 0.01 },
  MESSAGE: { min: 0.04, step: 0.01 },
}

type GateDurationGroup = {
  title: string
  note: string
  gates: Array<{ name: GateDurationName; label: string }>
}

const gateDurationGroups: GateDurationGroup[] = [
  {
    title: '回転ゲート(物理パルス)',
    note: '有限のパルス長を持つ1量子ビット回転ゲートです。',
    gates: [
      { name: 'H', label: 'H' },
      { name: 'X', label: 'X' },
      { name: 'Y', label: 'Y' },
      { name: 'RX', label: 'RX' },
      { name: 'RY', label: 'RY' },
      { name: 'RZ', label: 'RZ' },
    ],
  },
  {
    title: '仮想位相ゲート(瞬時)',
    note: 'フレーム更新で実装され、既定では所要時間 0 です。',
    gates: [
      { name: 'Z', label: 'Z' },
      { name: 'S', label: 'S' },
      { name: 'T', label: 'T' },
    ],
  },
  {
    title: '複数量子ビットゲート',
    note: '2量子ビット以上の結合操作です。',
    gates: [
      { name: 'CNOT', label: 'CNOT' },
      { name: 'CZ', label: 'CZ' },
      { name: 'SWAP', label: 'SWAP' },
      { name: 'CP', label: 'CP' },
      { name: 'CCX', label: 'CCX' },
    ],
  },
  {
    title: '測定',
    note: '測定操作の所要時間です。',
    gates: [{ name: 'MEASURE', label: '測定' }],
  },
]

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
      <label className="parameter-panel__field" key={name}>
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
              '最大 T1 [μs]',
              '0 より大きい値',
            )}
            {renderNumberInput(
              'tphi_max_us',
              '最大 Tφ [μs]',
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
              '磁束ノイズ [Φ0]',
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
              '総シミュレーション時間 [μs]',
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

        <details className="parameter-panel__section parameter-panel__section--collapsible">
          <summary className="parameter-panel__section-summary">
            <SectionHeader
              className="parameter-panel__section-header"
              icon="stopwatch"
              title="ゲート時間のデフォルト"
              headingLevel="h3"
            />
            <span className="parameter-panel__section-toggle" aria-hidden="true" />
          </summary>
          <p className="parameter-panel__section-note">
            現在のプリセットで各ゲート種別に使用するデフォルトの操作時間です。
            ゲートの種類ごとにグループ化しています。
          </p>
          <div className="parameter-panel__gate-groups">
            {gateDurationGroups.map((group) => (
              <div className="parameter-panel__gate-group" key={group.title}>
                <h4 className="parameter-panel__gate-group-title">{group.title}</h4>
                <p className="parameter-panel__gate-group-note">{group.note}</p>
                <div className="parameter-panel__fields parameter-panel__fields--compact">
                  {group.gates.map(({ name, label }) =>
                    renderGateDurationInput(name, `${label} [μs]`),
                  )}
                </div>
              </div>
            ))}
          </div>
        </details>
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
