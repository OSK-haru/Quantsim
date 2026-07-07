import './ParameterPanel.css'
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
    <section className="parameter-panel" aria-label="Simulation parameters">
      <div className="parameter-panel__header">
        <div>
          <div className="parameter-panel__eyebrow">Parameters</div>
          <h2 className="parameter-panel__title">Simulation parameters</h2>
        </div>
        <p className="parameter-panel__note">
          This is a generic educational profile, not a calibrated hardware model.
        </p>
      </div>

      <div className="parameter-panel__sections">
        <article className="parameter-panel__section">
          <h3 className="parameter-panel__section-title">Device / Environment</h3>
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'device_quality',
              'Device quality',
              'Abstract 0-1 profile parameter used by the educational device model.',
            )}
            {renderNumberInput(
              'temperature_mk',
              'Temperature [mK]',
              '0 or more',
            )}
            {renderNumberInput(
              'flux_noise_phi0',
              'Flux noise [\u03a60]',
              '0 or more',
            )}
            {renderNumberInput(
              'qubit_frequency_ghz',
              'Qubit frequency [GHz]',
              'greater than 0',
            )}
            {renderNumberInput(
              't1_max_us',
              'Max T1 [\u03bcs]',
              'greater than 0',
            )}
            {renderNumberInput(
              'tphi_max_us',
              'Max T\u03c6 [\u03bcs]',
              'greater than 0',
            )}
          </div>
        </article>

        <article className="parameter-panel__section">
          <h3 className="parameter-panel__section-title">Simulation</h3>
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'duration_us',
              'Total simulation time [\u03bcs]',
              'Includes gate operation time and any idle/observation time after the circuit completes.',
            )}
            {renderNumberInput('time_steps', 'Time steps', 'integer, 2 or more')}
            {renderNumberInput(
              'fidelity_threshold',
              'Fidelity threshold',
              '0.0 to 1.0',
            )}
          </div>
        </article>

        <article className="parameter-panel__section">
          <h3 className="parameter-panel__section-title">Gate Durations</h3>
          <p className="parameter-panel__section-note">
            Default operation time used for each gate type in the current preset.
          </p>
          <div className="parameter-panel__fields parameter-panel__fields--compact">
            {renderGateDurationInput('H', 'H [\u03bcs]')}
            {renderGateDurationInput('X', 'X [\u03bcs]')}
            {renderGateDurationInput('Z', 'Z [\u03bcs]')}
            {renderGateDurationInput('CNOT', 'CNOT [\u03bcs]')}
            {renderGateDurationInput('MEASURE', 'Measure [\u03bcs]')}
          </div>
        </article>
      </div>

      <dl className="parameter-panel__snapshot" aria-label="Latest response context">
        <div className="parameter-panel__snapshot-item">
          <dt>Input mode</dt>
          <dd>{parameters.input_mode}</dd>
        </div>
        <div className="parameter-panel__snapshot-item">
          <dt>Backend</dt>
          <dd>{parameters.simulation_backend}</dd>
        </div>
        <div className="parameter-panel__snapshot-item">
          <dt>Latest duration</dt>
          <dd>{parameters.duration_us.toFixed(2)} us</dd>
        </div>
      </dl>
    </section>
  )
}
