import './ParameterPanel.css'
import type {
  SimulateRequestParameterErrors,
  SimulateRequestParameters,
  SimulationParameters,
} from '../types/simulation'

type ParameterPanelProps = {
  parameters: SimulationParameters
  editableParameters: SimulateRequestParameters
  validationMessages: SimulateRequestParameterErrors
  onEditableParametersChange: (parameters: SimulateRequestParameters) => void
}

type EditableParameterName = keyof SimulateRequestParameters

const parameterRanges: Record<
  EditableParameterName,
  { min: number; max?: number; step: number }
> = {
  normalized_temperature: { min: 0, max: 1, step: 0.01 },
  normalized_magnetic_field: { min: 0, max: 1, step: 0.01 },
  noise_level: { min: 0, max: 1, step: 0.01 },
  duration_us: { min: 0.1, max: 20, step: 0.1 },
  time_steps: { min: 2, step: 1 },
  fidelity_threshold: { min: 0, max: 1, step: 0.01 },
}

function clampParameterValue(name: EditableParameterName, value: number) {
  const range = parameterRanges[name]
  const maxClamped = range.max === undefined ? value : Math.min(value, range.max)
  const minClamped = Math.max(maxClamped, range.min)
  return name === 'time_steps' ? Math.round(minClamped) : minClamped
}

export function ParameterPanel({
  parameters,
  editableParameters,
  validationMessages,
  onEditableParametersChange,
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

  return (
    <section className="parameter-panel" aria-label="Simulation parameters">
      <div className="parameter-panel__header">
        <div>
          <div className="parameter-panel__eyebrow">Parameters</div>
          <h2 className="parameter-panel__title">Simulation parameters</h2>
        </div>
        <p className="parameter-panel__note">
          Editable values are sent to POST /api/simulate.
        </p>
      </div>

      <div className="parameter-panel__sections">
        <article className="parameter-panel__section">
          <h3 className="parameter-panel__section-title">Environment</h3>
          <div className="parameter-panel__fields">
            {renderNumberInput(
              'normalized_temperature',
              'Normalized temperature',
              '0.0 to 1.0',
            )}
            {renderNumberInput(
              'normalized_magnetic_field',
              'Normalized magnetic field',
              '0.0 to 1.0',
            )}
            {renderNumberInput('noise_level', 'Noise level', '0.0 to 1.0')}
          </div>
        </article>

        <article className="parameter-panel__section">
          <h3 className="parameter-panel__section-title">Simulation</h3>
          <div className="parameter-panel__fields">
            {renderNumberInput('duration_us', 'Duration', 'microseconds')}
            {renderNumberInput('time_steps', 'Time steps', 'integer, 2 or more')}
            {renderNumberInput(
              'fidelity_threshold',
              'Fidelity threshold',
              '0.0 to 1.0',
            )}
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
