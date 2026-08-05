import { useEffect, useRef, useState } from 'react'
import { PulseDensityMatrixHeatmap } from '../components/PulseDensityMatrixHeatmap'
import { PulseEnvironmentPanel } from '../components/PulseEnvironmentPanel'
import { PulsePopulationTimeline } from '../components/PulsePopulationTimeline'
import { PulseWaveform } from '../components/PulseWaveform'
import { ResultDrawer } from '../components/ResultDrawer'
import { SimulationCompletionPopup } from '../components/SimulationCompletionPopup'
import {
  isQutritPulseResponse,
  isCoupledTransmonPairResponse,
  COUPLED_TRANSMON_PAIR_PULSE_MODEL,
  QUTRIT_PULSE_MODEL,
  type PulseLabForm,
  type PulseComplexValue,
  type PulseCostEstimate,
  type QutritPulsePoint,
  type QutritPulseResponse,
  type PulseResponse,
} from '../types/pulse'
import type { PulseCircuitStep, PulseExecutionConstraints } from '../types/pulseCircuit'
import {
  buildPulsePayload,
  estimatePulseCost,
  hasPulseResponseShape,
  pulseDurationUs,
  pulseWaveform,
  qutritTargetOverlap,
  validatePulseLabForm,
} from '../utils/pulseLab'
import {
  applyPulseStepToForm,
  isDrivePulseStep,
  normalizeFramePhase,
} from '../utils/pulseCircuit'
import './PulseLabPage.css'

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

type PulseLabPageProps = {
  form: PulseLabForm
  onFormChange: (form: PulseLabForm) => void
  sequence: PulseCircuitStep[]
  activeTransmonIndex: number
  executionConstraints: PulseExecutionConstraints
  onExecutionConstraintsChange: (next: PulseExecutionConstraints) => void
}

export function PulseLabPage({
  form,
  onFormChange,
  sequence,
  activeTransmonIndex,
  executionConstraints,
  onExecutionConstraintsChange,
}: PulseLabPageProps) {
  const [result, setResult] = useState<PulseResponse | null>(null)
  const [resultForm, setResultForm] = useState<PulseLabForm | null>(null)
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastRequestPayload, setLastRequestPayload] = useState<Record<string, unknown> | null>(null)
  const [lastResponseAt, setLastResponseAt] = useState<string | null>(null)
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const executionPlan = sequenceExecutionPlan(form, sequence, executionConstraints)
  const executionForms = executionPlan
    .filter((operation): operation is SequenceDriveOperation => operation.kind === 'drive')
    .map((operation) => operation.form)
  const sequenceMode = form.modelId === QUTRIT_PULSE_MODEL && sequence.length > 0
  const sequenceDurationUs = sequenceMode
    ? executionForms.reduce((total, executionForm) => total + pulseDurationUs(executionForm), 0)
      + Math.max(0, executionForms.length - 1) * executionConstraints.interPulseGapUs
    : form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
      && form.pairSecondaryDriveEnabled
      ? Math.max(
          pulseDurationUs(form),
          form.pairSecondaryShape === 'square'
            ? form.pairSecondaryPulseDurationUs
            : 2 * form.pairSecondarySigmaUs * form.pairSecondaryTruncationSigma,
        )
      : pulseDurationUs(form)
  const errors = validatePulseLabForm(form)
  const executionErrors = executionForms.flatMap((executionForm) =>
    Object.values(validatePulseLabForm(executionForm)),
  )
  const cost = combinedPulseCost(executionForms)
  const waveform = pulseWaveform(form)
  const constraintIssues = [
    ...validateExecutionConstraints(executionPlan, executionConstraints),
    ...validatePairSecondaryConstraints(form, executionConstraints),
  ]
  const isValid = Object.keys(errors).length === 0
    && executionErrors.length === 0
    && constraintIssues.length === 0
    && (!sequenceMode || executionForms.length > 0)
  const canRun = isValid && !cost.overBudget && status !== 'loading'
  const qutritResult = result && isQutritPulseResponse(result) ? result : null
  const pairResult = result && isCoupledTransmonPairResponse(result) ? result : null
  const activeResultForm = resultForm ?? form

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  async function runPulseSimulation() {
    if (!canRun) {
      return
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const payloads: Record<string, unknown>[] = []
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
        ? 90000
        : Math.min(
            120000,
            (form.evolutionMethod === 'explicit_cptp' ? 30000 : 16000)
              * executionForms.length,
          ),
    )
    setStatus('loading')
    setErrorMessage(null)
    setLastRequestPayload(null)

    try {
      let initialDensityMatrix: PulseComplexValue[][] | undefined
      const responses: PulseResponse[] = []
      const driveStepIndices: number[] = []
      const driveLabels: string[] = []
      const virtualEvents: SequenceVirtualEvent[] = []
      let latestQutritPoint: QutritPulsePoint | null = null
      let framePhaseRad = 0
      for (const operation of executionPlan) {
        if (operation.kind === 'virtual_z') {
          initialDensityMatrix = applyVirtualZToDensityMatrix(
            initialDensityMatrix ?? groundQutritDensityMatrix(),
            operation.angleRad,
          )
          framePhaseRad = normalizeFramePhase(framePhaseRad + operation.angleRad)
          latestQutritPoint = virtualZTrajectoryPoint(
            latestQutritPoint,
            initialDensityMatrix,
            operation.stepIndex,
            operation.label,
          )
          virtualEvents.push({
            afterDriveCount: responses.length,
            point: latestQutritPoint,
            angleRad: operation.angleRad,
            framePhaseRad,
          })
          continue
        }

        const payload = buildPulsePayload(operation.form, initialDensityMatrix)
        payloads.push(payload)
        const response = await fetch('/api/pulse/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(await pulseApiError(response))
        }
        const parsed: unknown = await response.json()
        if (!hasPulseResponseShape(parsed)) {
          throw new Error('The pulse API returned an invalid response shape.')
        }
        if (sequenceMode && !isQutritPulseResponse(parsed)) {
          throw new Error('Pulse sequence execution currently requires the qutrit model.')
        }
        responses.push(parsed)
        driveStepIndices.push(operation.stepIndex)
        driveLabels.push(operation.label)
        if (isQutritPulseResponse(parsed)) {
          initialDensityMatrix = parsed.final.density_matrix
          latestQutritPoint = parsed.final
        }
      }
      if (!mountedRef.current || abortRef.current !== controller) {
        return
      }
      const nextResult = sequenceMode
        ? aggregateQutritSequence(
            responses as QutritPulseResponse[],
            driveStepIndices,
            driveLabels,
            virtualEvents,
            sequence.length,
            activeTransmonIndex,
          )
        : responses[0]
      setLastRequestPayload(
        sequenceMode
          ? {
              transmon_index: activeTransmonIndex,
              operations: executionPlan.map((operation) => (
                operation.kind === 'drive'
                  ? { kind: 'drive', label: operation.label }
                  : { kind: 'virtual_z', label: operation.label, angle_rad: operation.angleRad }
              )),
              api_requests: payloads,
            }
          : payloads[0],
      )
      setResult(nextResult)
      setResultForm({ ...form })
      setStatus('success')
      setErrorMessage(null)
      setLastResponseAt(new Date().toISOString())
      setShowCompletionPopup(true)
    } catch (error) {
      if (!mountedRef.current || abortRef.current !== controller) {
        return
      }
      setStatus('error')
      setErrorMessage(
        error instanceof Error && error.name === 'AbortError'
          ? 'Pulse request timed out. The previous valid result remains visible.'
          : `${error instanceof Error ? error.message : 'Pulse request failed.'} The previous valid result remains visible.`,
      )
    } finally {
      window.clearTimeout(timeoutId)
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }

  return (
    <main className="pulse-lab">
      <header className="pulse-lab__header">
        <div>
          <span className="pulse-lab__eyebrow">QuantaScope / Experimental</span>
          <h1>Pulse Lab</h1>
          <p>
            Rotating-frame RWA control-envelope experimental model.
            <strong> Not a calibrated hardware model.</strong>
          </p>
        </div>
      </header>

      <aside className="pulse-lab__scope-note" aria-label="Pulse Lab scope">
        <strong>{sequenceMode ? `q${activeTransmonIndex} sequence execution.` : 'Single-pulse experiment.'}</strong>
        <span>
          {form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
            ? `q${form.pairDriveTarget}への現在の局所Pulseと、q0-q1交換結合を9次元密度行列で実行します。回路レーンの同時driveは未接続です。`
            : sequenceMode
            ? `${sequence.length}個のPulseを、密度行列と共通環境を引き継いで順番に実行します。`
            : 'Pulse回路にブロックがないため、現在の単一Pulse設定を実行します。'}
        </span>
      </aside>

      <section className="pulse-lab__identity" aria-label="Pulse model identity">
        <div>
          <span>MODEL</span>
          <strong>
            {form.modelId === QUTRIT_PULSE_MODEL
              ? 'Three-level transmon qutrit'
              : form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
                ? 'Coupled transmon pair / 3 x 3 levels'
              : 'Two-level baseline'}
          </strong>
        </div>
        <div>
          <span>FRAME</span>
          <strong>Rotating / RWA</strong>
        </div>
        <div>
          <span>PULSE WINDOW</span>
          <strong>{sequenceDurationUs.toPrecision(4)} us</strong>
        </div>
        <div>
          <span>TOTAL OBSERVATION</span>
          <strong>{form.totalSimulationTimeUs.toPrecision(4)} us</strong>
        </div>
        <div>
          <span>EVOLUTION</span>
          <strong>
            {form.evolutionMethod === 'explicit_cptp'
              ? 'Explicit CPTP'
              : 'Fixed-step RK4'}
          </strong>
        </div>
      </section>

      <div className="pulse-lab__workspace">
        <PulseEnvironmentPanel
          form={form}
          errors={errors}
          disabled={status === 'loading'}
          onChange={onFormChange}
          executionConstraints={executionConstraints}
          onExecutionConstraintsChange={onExecutionConstraintsChange}
        />

        <section className="pulse-lab__run" aria-labelledby="pulse-run-title">
          <div>
            <span>BOUNDED EXECUTION</span>
            <h2 id="pulse-run-title">{sequenceMode ? 'Run pulse sequence' : 'Run pulse simulation'}</h2>
            <p data-level={cost.level}>
              {cost.message} Conservative UI estimate: approximately{' '}
              {cost.estimatedInternalSteps.toLocaleString()} /{' '}
              {cost.maximumInternalSteps.toLocaleString()} steps.
            </p>
          </div>
          <button
            type="button"
            disabled={!canRun}
            onClick={() => void runPulseSimulation()}
          >
            {status === 'loading'
              ? `Running ${executionForms.length} block${executionForms.length === 1 ? '' : 's'}...`
              : sequenceMode
                ? `Run q${activeTransmonIndex} sequence`
                : 'Run pulse simulation'}
          </button>
          {!isValid ? (
            <p className="pulse-lab__run-error" role="alert">
              Correct the highlighted fields before running.
            </p>
          ) : null}
          {constraintIssues.length > 0 ? (
            <ul className="pulse-lab__run-error" aria-label="Execution constraint violations">
              {constraintIssues.map((issue) => (
                <li key={`${issue.stepIndex}-${issue.message}`}>{issue.label}: {issue.message}</li>
              ))}
            </ul>
          ) : null}
          {errorMessage ? (
            <p className="pulse-lab__run-error" role="alert">{errorMessage}</p>
          ) : null}
        </section>

        <PulseWaveform
          points={waveform}
          pulseDurationUs={pulseDurationUs(form)}
          totalSimulationTimeUs={form.totalSimulationTimeUs}
        />

        {result ? (
          <>
            <section className="pulse-lab__result-banner">
              <div>
                <span>LAST VALID RESULT</span>
                <strong>{result.model.description}</strong>
              </div>
              <div>
                <span>CONTRACT</span>
                <strong>{result.contract_version}</strong>
              </div>
              <div>
                <span>COMPLETED</span>
                <strong>{lastResponseAt ? new Date(lastResponseAt).toLocaleTimeString() : 'now'}</strong>
              </div>
              <div>
                <span>EVOLUTION</span>
                <strong>
                  {result.diagnostics.evolution.resolved === 'explicit_cptp'
                    ? 'Explicit CPTP'
                    : 'Fixed-step RK4'}
                </strong>
              </div>
            </section>

            <PulseSummary response={result} formAtRun={activeResultForm} />
            <PulsePopulationTimeline response={result} formAtRun={activeResultForm} />
            {qutritResult ? (
              <PulseDensityMatrixHeatmap matrix={qutritResult.final.density_matrix} />
            ) : null}
            {pairResult ? (
              <PulseDensityMatrixHeatmap
                matrix={pairResult.final.density_matrix}
                basisLabels={pairResult.model.basis_order}
              />
            ) : null}

            <div className="pulse-lab__drawers">
              <ResultDrawer
                eyebrow="MODEL"
                title="Model and approximation details"
                description="Identity and assumptions returned by the API."
              >
                <JsonBlock value={result.model} />
              </ResultDrawer>
              <ResultDrawer
                eyebrow="ENVIRONMENT"
                title="Rates and thermal occupations"
                description="Canonical rates actually used by the solver."
              >
                <JsonBlock value={result.rates} />
              </ResultDrawer>
              <ResultDrawer
                eyebrow="NUMERICS"
                title="Step policy and physicality"
                description="Work bound, raw physicality, and cleanup diagnostics."
              >
                <JsonBlock value={{ step_policy: result.step_policy, diagnostics: result.diagnostics }} />
              </ResultDrawer>
              {(result.warnings.length > 0 || result.limitations.length > 0) ? (
                <ResultDrawer
                  eyebrow="SCOPE"
                  title="Warnings and limitations"
                  icon="warning"
                  defaultOpen={result.warnings.length > 1}
                >
                  <div className="pulse-lab__scope">
                    {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    <ul>
                      {result.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                    </ul>
                  </div>
                </ResultDrawer>
              ) : null}
              <ResultDrawer
                eyebrow="API"
                title="Request debug fields"
                description="Last payload sent by this page. Inactive fields are absent."
              >
                <JsonBlock value={lastRequestPayload} />
              </ResultDrawer>
            </div>
          </>
        ) : (
          <section className="pulse-lab__empty">
            <span>RESULTS ARMED</span>
            <h2>No pulse result yet</h2>
            <p>Review the waveform and bounded-work estimate, then run the selected model.</p>
          </section>
        )}
      </div>
      {showCompletionPopup ? (
        <SimulationCompletionPopup
          mode="pulse"
          title="Pulse シミュレーションが完了しました"
          detail={`Evolution: ${result?.diagnostics.evolution.resolved ?? 'completed'}`}
          onDismiss={() => setShowCompletionPopup(false)}
        />
      ) : null}
    </main>
  )
}

type SequenceDriveOperation = {
  kind: 'drive'
  stepIndex: number
  label: string
  form: PulseLabForm
}

type SequenceVirtualZOperation = {
  kind: 'virtual_z'
  stepIndex: number
  label: string
  angleRad: number
}

type SequenceExecutionOperation = SequenceDriveOperation | SequenceVirtualZOperation

type SequenceVirtualEvent = {
  afterDriveCount: number
  point: QutritPulsePoint
  angleRad: number
  framePhaseRad: number
}

function sequenceExecutionPlan(
  globalForm: PulseLabForm,
  sequence: PulseCircuitStep[],
  constraints: PulseExecutionConstraints,
): SequenceExecutionOperation[] {
  if (globalForm.modelId !== QUTRIT_PULSE_MODEL || sequence.length === 0) {
    return [{ kind: 'drive', stepIndex: 0, label: 'Single pulse', form: { ...globalForm } }]
  }

  const driveSteps = sequence.filter(isDrivePulseStep)
  const pulseDurations = driveSteps.map((step) =>
    pulseDurationUs(applyPulseStepToForm(globalForm, step.pulse)),
  )
  const gapCount = Math.max(0, driveSteps.length - 1)
  const scheduledDuration = pulseDurations.reduce((total, duration) => total + duration, 0)
    + gapCount * constraints.interPulseGapUs
  const finalIdleDuration = Math.max(0, globalForm.totalSimulationTimeUs - scheduledDuration)
  const snapshotsPerBlock = Math.max(2, Math.ceil(globalForm.snapshotCount / Math.max(1, driveSteps.length)))
  let driveIndex = 0

  return sequence.map((step, stepIndex): SequenceExecutionOperation => {
    if (!isDrivePulseStep(step)) {
      return {
        kind: 'virtual_z',
        stepIndex,
        label: step.label,
        angleRad: step.angleRad,
      }
    }
    const pulseForm = applyPulseStepToForm(globalForm, step.pulse)
    const currentDriveIndex = driveIndex
    driveIndex += 1
    return {
      kind: 'drive',
      stepIndex,
      label: step.label,
      form: {
        ...pulseForm,
        totalSimulationTimeUs: pulseDurations[currentDriveIndex]
          + (currentDriveIndex < driveSteps.length - 1 ? constraints.interPulseGapUs : 0)
          + (currentDriveIndex === driveSteps.length - 1 ? finalIdleDuration : 0),
        snapshotCount: snapshotsPerBlock,
      },
    }
  })
}

type PulseConstraintIssue = {
  stepIndex: number
  label: string
  message: string
}

function validateExecutionConstraints(
  executionPlan: SequenceExecutionOperation[],
  constraints: PulseExecutionConstraints,
): PulseConstraintIssue[] {
  const issues: PulseConstraintIssue[] = []
  const positiveValues = [
    constraints.maximumDriveAmplitudeRadPerUs,
    constraints.minimumPulseDurationUs,
    constraints.awgSamplePeriodUs,
    constraints.phaseResolutionRad,
    constraints.amplitudeResolutionRadPerUs,
    constraints.maximumDetuningRadPerUs,
  ]
  if (
    positiveValues.some((value) => !Number.isFinite(value) || value <= 0)
    || !Number.isFinite(constraints.interPulseGapUs)
    || constraints.interPulseGapUs < 0
  ) {
    return [{
      stepIndex: -1,
      label: 'Global constraints',
      message: 'Limits and resolutions must be positive finite values; the inter-pulse gap may be zero.',
    }]
  }

  executionPlan.forEach((operation) => {
    if (operation.kind === 'virtual_z') {
      if (!isAligned(operation.angleRad, constraints.phaseResolutionRad)) {
        issues.push({
          stepIndex: operation.stepIndex,
          label: operation.label,
          message: `Virtual Z angle must align to ${constraints.phaseResolutionRad.toPrecision(4)} rad.`,
        })
      }
      return
    }

    const durationUs = pulseDurationUs(operation.form)
    if (durationUs < constraints.minimumPulseDurationUs) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Pulse duration must be at least ${constraints.minimumPulseDurationUs} us.`,
      })
    }
    if (!isAligned(durationUs, constraints.awgSamplePeriodUs)) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Pulse duration must align to the ${constraints.awgSamplePeriodUs} us AWG period.`,
      })
    }
    if (Math.abs(operation.form.detuningRadPerUs) > constraints.maximumDetuningRadPerUs) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Detuning exceeds +/-${constraints.maximumDetuningRadPerUs} rad/us.`,
      })
    }
    if (!isAligned(operation.form.phaseRad, constraints.phaseResolutionRad)) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Phase must align to ${constraints.phaseResolutionRad.toPrecision(4)} rad.`,
      })
    }

    const maximumWaveformAmplitude = Math.max(
      0,
      ...pulseWaveform(operation.form, 129).map((point) => Math.hypot(point.omegaX, point.omegaY)),
    )
    if (maximumWaveformAmplitude > constraints.maximumDriveAmplitudeRadPerUs * (1 + 1e-9)) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Waveform peak ${maximumWaveformAmplitude.toPrecision(4)} rad/us exceeds the ${constraints.maximumDriveAmplitudeRadPerUs} rad/us limit.`,
      })
    }
    if (
      operation.form.amplitudeMode === 'peak_amplitude'
      && !isAligned(operation.form.peakAmplitudeRadPerUs, constraints.amplitudeResolutionRadPerUs)
    ) {
      issues.push({
        stepIndex: operation.stepIndex,
        label: operation.label,
        message: `Peak amplitude must align to ${constraints.amplitudeResolutionRadPerUs} rad/us.`,
      })
    }
  })
  return issues
}

function isAligned(value: number, resolution: number): boolean {
  const ratio = value / resolution
  return Number.isFinite(ratio) && Math.abs(ratio - Math.round(ratio)) <= 1e-6
}

function validatePairSecondaryConstraints(
  form: PulseLabForm,
  constraints: PulseExecutionConstraints,
): PulseConstraintIssue[] {
  if (
    form.modelId !== COUPLED_TRANSMON_PAIR_PULSE_MODEL
    || !form.pairSecondaryDriveEnabled
  ) {
    return []
  }
  const secondaryForm: PulseLabForm = {
    ...form,
    shape: form.pairSecondaryShape,
    amplitudeMode: form.pairSecondaryAmplitudeMode,
    targetRotationAngleRad: form.pairSecondaryTargetRotationAngleRad,
    peakAmplitudeRadPerUs: form.pairSecondaryPeakAmplitudeRadPerUs,
    pulseDurationUs: form.pairSecondaryPulseDurationUs,
    sigmaUs: form.pairSecondarySigmaUs,
    truncationSigma: form.pairSecondaryTruncationSigma,
    phaseRad: form.pairSecondaryPhaseRad,
    detuningRadPerUs: form.pairSecondaryDetuningRadPerUs,
    dragBetaUs: form.pairSecondaryDragBetaUs,
  }
  const duration = pulseDurationUs(secondaryForm)
  const issues: PulseConstraintIssue[] = []
  if (duration < constraints.minimumPulseDurationUs) {
    issues.push({ stepIndex: -2, label: 'Secondary drive', message: `Pulse duration must be at least ${constraints.minimumPulseDurationUs} us.` })
  }
  if (!isAligned(duration, constraints.awgSamplePeriodUs)) {
    issues.push({ stepIndex: -2, label: 'Secondary drive', message: `Duration must align to ${constraints.awgSamplePeriodUs} us.` })
  }
  if (!isAligned(secondaryForm.phaseRad, constraints.phaseResolutionRad)) {
    issues.push({ stepIndex: -2, label: 'Secondary drive', message: `Phase must align to ${constraints.phaseResolutionRad.toPrecision(4)} rad.` })
  }
  const peak = Math.max(
    0,
    ...pulseWaveform(secondaryForm, 129).map((point) => Math.hypot(point.omegaX, point.omegaY)),
  )
  if (peak > constraints.maximumDriveAmplitudeRadPerUs * (1 + 1e-9)) {
    issues.push({ stepIndex: -2, label: 'Secondary drive', message: `Waveform peak ${peak.toPrecision(4)} rad/us exceeds the limit.` })
  }
  return issues
}

function combinedPulseCost(forms: PulseLabForm[]): PulseCostEstimate {
  const costs = forms.map(estimatePulseCost)
  const estimatedInternalSteps = costs.reduce(
    (total, cost) => total + cost.estimatedInternalSteps,
    0,
  )
  const maximumInternalSteps = costs.reduce(
    (total, cost) => total + cost.maximumInternalSteps,
    0,
  )
  const overBudget = costs.some((cost) => cost.overBudget)
  const ratio = maximumInternalSteps > 0
    ? estimatedInternalSteps / maximumInternalSteps
    : 0
  return {
    estimatedInternalSteps,
    maximumInternalSteps,
    overBudget,
    level: overBudget ? 'blocked' : ratio >= 0.7 ? 'elevated' : 'normal',
    message: overBudget
      ? 'At least one Pulse block exceeds the per-request API work limit.'
      : forms.length > 1
        ? `Estimated work for ${forms.length} sequential Pulse blocks is within the API limits.`
        : costs[0]?.message ?? 'Estimated work is within the API limits.',
  }
}

function aggregateQutritSequence(
  responses: QutritPulseResponse[],
  driveStepIndices: number[],
  driveLabels: string[],
  virtualEvents: SequenceVirtualEvent[],
  totalOperationCount: number,
  transmonIndex: number,
): QutritPulseResponse {
  const last = responses.at(-1)
  if (!last) {
    throw new Error('Pulse sequence returned no results.')
  }

  let timeOffset = 0
  let finalStepOffset = 0
  const trajectory: QutritPulseResponse['trajectory'] = []
  let maximumLeakage = 0
  let estimatedInternalSteps = 0
  const operationLabels = Array.from({ length: totalOperationCount }, (_, index) => `Step ${index + 1}`)

  driveStepIndices.forEach((operationIndex, driveIndex) => {
    operationLabels[operationIndex] = driveLabels[driveIndex] ?? `Pulse ${driveIndex + 1}`
  })
  virtualEvents.forEach((event) => {
    if (event.point.sequence_step_index !== undefined) {
      operationLabels[event.point.sequence_step_index] = event.point.sequence_step_label ?? 'VZ'
    }
  })

  function appendVirtualEvents(afterDriveCount: number) {
    virtualEvents
      .filter((event) => event.afterDriveCount === afterDriveCount)
      .forEach((event) => {
        trajectory.push({ ...event.point, time_us: timeOffset })
      })
  }

  appendVirtualEvents(0)
  responses.forEach((response, driveIndex) => {
    finalStepOffset = timeOffset
    response.trajectory.forEach((point) => {
      trajectory.push({
        ...point,
        time_us: point.time_us + timeOffset,
        sequence_step_index: driveStepIndices[driveIndex] ?? driveIndex,
        sequence_step_label: driveLabels[driveIndex] ?? `Pulse ${driveIndex + 1}`,
      })
    })
    maximumLeakage = Math.max(
      maximumLeakage,
      response.leakage.maximum_recorded_leakage_probability,
    )
    estimatedInternalSteps += Number(
      response.step_policy.estimated_internal_step_count ?? 0,
    )
    timeOffset += Number(response.input.total_simulation_time_us ?? 0)
    appendVirtualEvents(driveIndex + 1)
  })

  const trailingVirtualEvent = [...virtualEvents]
    .reverse()
    .find((event) => event.afterDriveCount === responses.length)
  const finalPoint = trailingVirtualEvent?.point ?? last.final
  const finalFramePhaseRad = virtualEvents.at(-1)?.framePhaseRad ?? 0

  return {
    ...last,
    input: {
      ...last.input,
      sequence_length: totalOperationCount,
      drive_pulse_count: responses.length,
      virtual_z_count: virtualEvents.length,
      sequence_labels: operationLabels.join(' -> '),
      transmon_index: transmonIndex,
      total_sequence_time_us: timeOffset,
    },
    step_policy: {
      ...last.step_policy,
      estimated_internal_step_count: estimatedInternalSteps,
      maximum_internal_step_count:
        Number(last.step_policy.maximum_internal_step_count ?? 0) * responses.length,
    },
    sample_times_us: trajectory.map((point) => point.time_us),
    trajectory,
    leakage: {
      maximum_recorded_leakage_probability: maximumLeakage,
      leakage_at_pulse_end: last.leakage.leakage_at_pulse_end,
      leakage_at_final_time: last.leakage.leakage_at_final_time,
    },
    pulse_end: {
      ...last.pulse_end,
      time_us: last.pulse_end.time_us + finalStepOffset,
    },
    final: {
      ...finalPoint,
      time_us: trailingVirtualEvent ? timeOffset : last.final.time_us + finalStepOffset,
    },
    diagnostics: {
      ...last.diagnostics,
      sequence: {
        transmon_index: transmonIndex,
        block_count: totalOperationCount,
        drive_pulse_count: responses.length,
        virtual_z_count: virtualEvents.length,
        final_frame_phase_rad: finalFramePhaseRad,
        virtual_z_convention: 'U=diag(1, exp(-i lambda), exp(-i 2 lambda))',
        state_handoff: 'density_matrix',
        common_environment: true,
      },
    },
    warnings: [
      ...last.warnings,
      `Executed ${totalOperationCount} operations with density-matrix handoff and phase-frame tracking.`,
    ],
  }
}

function groundQutritDensityMatrix(): PulseComplexValue[][] {
  return [
    [{ real: 1, imag: 0 }, { real: 0, imag: 0 }, { real: 0, imag: 0 }],
    [{ real: 0, imag: 0 }, { real: 0, imag: 0 }, { real: 0, imag: 0 }],
    [{ real: 0, imag: 0 }, { real: 0, imag: 0 }, { real: 0, imag: 0 }],
  ]
}

function applyVirtualZToDensityMatrix(
  matrix: PulseComplexValue[][],
  angleRad: number,
): PulseComplexValue[][] {
  return matrix.map((row, rowIndex) => row.map((value, columnIndex) => {
    const phase = (columnIndex - rowIndex) * angleRad
    const cosine = Math.cos(phase)
    const sine = Math.sin(phase)
    return {
      real: value.real * cosine - value.imag * sine,
      imag: value.real * sine + value.imag * cosine,
    }
  }))
}

function virtualZTrajectoryPoint(
  previous: QutritPulsePoint | null,
  densityMatrix: PulseComplexValue[][],
  stepIndex: number,
  label: string,
): QutritPulsePoint {
  if (previous) {
    return {
      ...previous,
      segment: 'virtual_z',
      density_matrix: densityMatrix,
      sequence_step_index: stepIndex,
      sequence_step_label: label,
    }
  }

  const physicality = {
    trace_error: 0,
    hermiticity_error: 0,
    minimum_eigenvalue: 0,
  }
  return {
    time_us: 0,
    segment: 'virtual_z',
    population_0: 1,
    population_1: 0,
    population_2: 0,
    computational_population: 1,
    leakage_probability: 0,
    population_sum_error: 0,
    purity: 1,
    density_matrix: densityMatrix,
    raw_physicality: physicality,
    cleaned_physicality: physicality,
    cleanup_correction_norm: 0,
    sequence_step_index: stepIndex,
    sequence_step_label: label,
  }
}

function PulseSummary({
  response,
  formAtRun,
}: {
  response: PulseResponse
  formAtRun: PulseLabForm
}) {
  const qutrit = isQutritPulseResponse(response)
  const pair = isCoupledTransmonPairResponse(response)
  const pulseEnd = response.pulse_end
  const final = response.final
  const fidelity = pair
    ? null
    : isQutritPulseResponse(response)
    ? Number(response.input.sequence_length ?? 1) > 1
      ? null
      : qutritTargetOverlap(response.final, formAtRun)
    : response.final.fidelity_to_closed
  return (
    <section className="pulse-lab__summary" aria-label="Pulse result summary">
      <article>
        <span>PULSE-END PURITY</span>
        <strong>{pulseEnd.purity.toFixed(6)}</strong>
      </article>
      <article>
        <span>FINAL PURITY</span>
        <strong>{final.purity.toFixed(6)}</strong>
      </article>
      <article>
        <span>{qutrit ? 'TARGET OVERLAP' : pair ? 'JOINT MODEL' : 'FINAL FIDELITY'}</span>
        <strong>{fidelity === null ? 'N/A' : fidelity.toFixed(6)}</strong>
        {qutrit ? <small>Not leakage-renormalized</small> : null}
      </article>
      {qutrit || pair ? (
        <>
          <article className="pulse-lab__summary--leakage">
            <span>{pair ? 'MAX OUTSIDE |00..11>' : 'MAX LEAKAGE P2'}</span>
            <strong>{response.leakage.maximum_recorded_leakage_probability.toFixed(6)}</strong>
          </article>
          <article className="pulse-lab__summary--leakage">
            <span>{pair ? 'FINAL OUTSIDE |00..11>' : 'FINAL LEAKAGE P2'}</span>
            <strong>{response.leakage.leakage_at_final_time.toFixed(6)}</strong>
          </article>
        </>
      ) : null}
    </section>
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="pulse-lab__json">{JSON.stringify(value, null, 2)}</pre>
}

async function pulseApiError(response: Response) {
  const raw = await response.text()
  let detail = raw
  try {
    const body = JSON.parse(raw) as { detail?: unknown }
    detail =
      typeof body.detail === 'string'
        ? body.detail
        : JSON.stringify(body.detail ?? body)
  } catch {
    // Keep the plain response body when the API did not return JSON.
  }
  const label =
    response.status === 422
      ? 'Pulse request was rejected by validation or the work gate.'
      : response.status === 504
        ? 'Pulse request exceeded the API timeout.'
        : `Pulse API returned HTTP ${response.status}.`
  return detail ? `${label} ${detail}` : label
}
