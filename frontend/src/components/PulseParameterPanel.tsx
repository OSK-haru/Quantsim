import type {
  PulseLabErrors,
  PulseLabForm,
  PulseModelId,
} from '../types/pulse'
import {
  QUTRIT_PULSE_MODEL,
  TWO_LEVEL_PULSE_MODEL,
} from '../types/pulse'
import { pulseDurationUs } from '../utils/pulseLab'
import './PulseParameterPanel.css'

type PulseParameterPanelProps = {
  form: PulseLabForm
  errors: PulseLabErrors
  disabled: boolean
  onChange: (next: PulseLabForm) => void
}

type NumberFieldProps = {
  field: keyof PulseLabForm
  label: string
  value: number
  error?: string
  hint?: string
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  onChange: (field: keyof PulseLabForm, value: number) => void
}

export function PulseParameterPanel({
  form,
  errors,
  disabled,
  onChange,
}: PulseParameterPanelProps) {
  const isQutrit = form.modelId === QUTRIT_PULSE_MODEL
  const setNumber = (field: keyof PulseLabForm, value: number) => {
    onChange({ ...form, [field]: value })
  }

  return (
    <section className="pulse-parameters" aria-labelledby="pulse-parameters-title">
      <div className="pulse-parameters__heading">
        <div>
          <span>CONTROL SURFACE</span>
          <h2 id="pulse-parameters-title">Pulse parameters</h2>
        </div>
        <p>Only fields active for the selected model are sent to the API.</p>
      </div>

      <div className="pulse-parameters__selectors">
        <label>
          Model
          <select
            value={form.modelId}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                modelId: event.target.value as PulseModelId,
                dragBetaUs:
                  event.target.value === QUTRIT_PULSE_MODEL
                    ? form.dragBetaUs
                    : 0,
              })
            }
          >
            <option value={TWO_LEVEL_PULSE_MODEL}>Two-level baseline</option>
            <option value={QUTRIT_PULSE_MODEL}>Qutrit with leakage</option>
          </select>
        </label>
        <label>
          Envelope
          <select
            value={form.shape}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                shape: event.target.value as PulseLabForm['shape'],
                dragBetaUs: event.target.value === 'gaussian' ? form.dragBetaUs : 0,
              })
            }
          >
            <option value="gaussian">Gaussian</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label>
          Amplitude definition
          <select
            value={form.amplitudeMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                amplitudeMode: event.target.value as PulseLabForm['amplitudeMode'],
              })
            }
          >
            <option value="target_rotation_angle">Target rotation angle</option>
            <option value="peak_amplitude">Peak amplitude</option>
          </select>
        </label>
        <label>
          Environment input
          <select
            value={form.environmentMode}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                environmentMode: event.target.value as PulseLabForm['environmentMode'],
              })
            }
          >
            <option value="physical">Educational physical profile</option>
            <option value="direct_rates">Direct rates / expert</option>
          </select>
        </label>
        <label>
          Evolution method
          <select
            value={form.evolutionMethod}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...form,
                evolutionMethod:
                  event.target.value as PulseLabForm['evolutionMethod'],
              })
            }
          >
            <option value="fixed_step_rk4">
              Fixed-step RK4 (reference)
            </option>
            <option value="explicit_cptp">
              Explicit CPTP maps
            </option>
          </select>
          <small>
            CPTP maps avoid cleanup; time-dependent drives use midpoint
            piecewise approximation.
          </small>
        </label>
      </div>

      <div className="pulse-parameters__grid">
        {form.amplitudeMode === 'target_rotation_angle' ? (
          <NumberField
            field="targetRotationAngleRad"
            label="Target angle [rad]"
            value={form.targetRotationAngleRad}
            error={errors.targetRotationAngleRad}
            step={0.01}
            disabled={disabled}
            onChange={setNumber}
          />
        ) : (
          <NumberField
            field="peakAmplitudeRadPerUs"
            label="Peak amplitude [rad/us]"
            value={form.peakAmplitudeRadPerUs}
            error={errors.peakAmplitudeRadPerUs}
            step={0.1}
            disabled={disabled}
            onChange={setNumber}
          />
        )}
        {form.shape === 'square' ? (
          <NumberField
            field="pulseDurationUs"
            label="Pulse duration [us]"
            value={form.pulseDurationUs}
            error={errors.pulseDurationUs}
            step={0.001}
            min={0}
            disabled={disabled}
            onChange={setNumber}
          />
        ) : (
          <>
            <NumberField
              field="sigmaUs"
              label="Gaussian sigma [us]"
              value={form.sigmaUs}
              error={errors.sigmaUs}
              step={0.001}
              min={0}
              disabled={disabled}
              onChange={setNumber}
            />
            <NumberField
              field="truncationSigma"
              label="Truncation [sigma]"
              value={form.truncationSigma}
              error={errors.truncationSigma}
              step={0.5}
              min={0}
              disabled={disabled}
              onChange={setNumber}
            />
          </>
        )}
        <NumberField
          field="totalSimulationTimeUs"
          label="Total simulation time [us]"
          value={form.totalSimulationTimeUs}
          error={errors.totalSimulationTimeUs}
          hint={`Pulse occupies ${pulseDurationUs(form).toPrecision(4)} us; later time is idle observation.`}
          step={0.001}
          min={0}
          disabled={disabled}
          onChange={setNumber}
        />
        <NumberField
          field="phaseRad"
          label="Drive phase [rad]"
          value={form.phaseRad}
          error={errors.phaseRad}
          step={0.05}
          disabled={disabled}
          onChange={setNumber}
        />
        <NumberField
          field="detuningRadPerUs"
          label="Detuning [rad/us]"
          value={form.detuningRadPerUs}
          error={errors.detuningRadPerUs}
          step={0.1}
          disabled={disabled}
          onChange={setNumber}
        />
        {isQutrit ? (
          <>
            <NumberField
              field="anharmonicityMhz"
              label="Anharmonicity [MHz]"
              value={form.anharmonicityMhz}
              error={errors.anharmonicityMhz}
              hint="Negative for the supported transmon convention."
              step={10}
              max={0}
              disabled={disabled}
              onChange={setNumber}
            />
            {form.shape === 'gaussian' ? (
              <NumberField
                field="dragBetaUs"
                label="DRAG beta [us]"
                value={form.dragBetaUs}
                error={errors.dragBetaUs}
                hint="Quadrature coefficient multiplying the Gaussian derivative."
                step={0.0001}
                disabled={disabled}
                onChange={setNumber}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div className="pulse-parameters__environment">
        <h3>
          {form.environmentMode === 'physical'
            ? 'Educational physical profile'
            : 'Direct Lindblad rates'}
        </h3>
        {form.environmentMode === 'physical' ? (
          <>
            <p>
              Generic educational mapping. These values are not hardware calibration data.
            </p>
            <div className="pulse-parameters__grid">
              <NumberField field="deviceQuality" label="Device quality" value={form.deviceQuality} error={errors.deviceQuality} step={0.05} min={0} max={1} disabled={disabled} onChange={setNumber} />
              <NumberField field="temperatureMk" label="Temperature [mK]" value={form.temperatureMk} error={errors.temperatureMk} step={1} min={0} disabled={disabled} onChange={setNumber} />
              <NumberField field="fluxNoisePhi0" label="Flux noise [Phi0]" value={form.fluxNoisePhi0} error={errors.fluxNoisePhi0} step={0.000001} min={0} disabled={disabled} onChange={setNumber} />
              <NumberField field="qubitFrequencyGhz" label="Qubit frequency [GHz]" value={form.qubitFrequencyGhz} error={errors.qubitFrequencyGhz} step={0.1} min={0} disabled={disabled} onChange={setNumber} />
              <NumberField field="t1MaxUs" label="Max T1 [us]" value={form.t1MaxUs} error={errors.t1MaxUs} step={1} min={0} disabled={disabled} onChange={setNumber} />
              <NumberField field="tphiMaxUs" label="Max Tphi [us]" value={form.tphiMaxUs} error={errors.tphiMaxUs} step={1} min={0} disabled={disabled} onChange={setNumber} />
            </div>
          </>
        ) : (
          <div className="pulse-parameters__grid">
            {isQutrit ? (
              <>
                <NumberField field="gamma10DownPerUs" label="gamma 10 down [1/us]" value={form.gamma10DownPerUs} error={errors.gamma10DownPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma01UpPerUs" label="gamma 01 up [1/us]" value={form.gamma01UpPerUs} error={errors.gamma01UpPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma21DownPerUs" label="gamma 21 down [1/us]" value={form.gamma21DownPerUs} error={errors.gamma21DownPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gamma12UpPerUs" label="gamma 12 up [1/us]" value={form.gamma12UpPerUs} error={errors.gamma12UpPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
                <NumberField field="gammaPhiAdjacentPerUs" label="Adjacent dephasing [1/us]" value={form.gammaPhiAdjacentPerUs} error={errors.gammaPhiAdjacentPerUs} step={0.01} min={0} disabled={disabled} onChange={setNumber} />
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

      <details className="pulse-parameters__expert">
        <summary>Sampling and expert details</summary>
        <div className="pulse-parameters__grid">
          <NumberField
            field="snapshotCount"
            label="Snapshot count"
            value={form.snapshotCount}
            error={errors.snapshotCount}
            step={1}
            min={2}
            max={1001}
            disabled={disabled}
            onChange={setNumber}
          />
        </div>
      </details>
    </section>
  )
}

function NumberField({
  field,
  label,
  value,
  error,
  hint,
  step = 1,
  min,
  max,
  disabled,
  onChange,
}: NumberFieldProps) {
  const errorId = `${String(field)}-error`
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
      {hint ? <small>{hint}</small> : null}
      {error ? (
        <small className="pulse-parameters__error" id={errorId}>
          {error}
        </small>
      ) : null}
    </label>
  )
}
