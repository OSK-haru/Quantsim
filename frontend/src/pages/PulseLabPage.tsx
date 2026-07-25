import { useEffect, useRef, useState } from 'react'
import { PulseDensityMatrixHeatmap } from '../components/PulseDensityMatrixHeatmap'
import { PulseParameterPanel } from '../components/PulseParameterPanel'
import { PulsePopulationTimeline } from '../components/PulsePopulationTimeline'
import { PulseWaveform } from '../components/PulseWaveform'
import { ResultDrawer } from '../components/ResultDrawer'
import {
  isQutritPulseResponse,
  QUTRIT_PULSE_MODEL,
  type PulseLabForm,
  type PulseResponse,
} from '../types/pulse'
import {
  buildPulsePayload,
  estimatePulseCost,
  hasPulseResponseShape,
  initialPulseLabForm,
  pulseDurationUs,
  pulseWaveform,
  qutritTargetOverlap,
  validatePulseLabForm,
} from '../utils/pulseLab'
import './PulseLabPage.css'

type PulseLabPageProps = {
  onBackToHome: () => void
  onOpenSimulation: () => void
  onOpenHelp: () => void
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

export function PulseLabPage({
  onBackToHome,
  onOpenSimulation,
  onOpenHelp,
}: PulseLabPageProps) {
  const [form, setForm] = useState<PulseLabForm>(initialPulseLabForm)
  const [result, setResult] = useState<PulseResponse | null>(null)
  const [resultForm, setResultForm] = useState<PulseLabForm | null>(null)
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastRequestPayload, setLastRequestPayload] = useState<Record<string, unknown> | null>(null)
  const [lastResponseAt, setLastResponseAt] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const errors = validatePulseLabForm(form)
  const cost = estimatePulseCost(form)
  const waveform = pulseWaveform(form)
  const isValid = Object.keys(errors).length === 0
  const canRun = isValid && !cost.overBudget && status !== 'loading'
  const qutritResult = result && isQutritPulseResponse(result) ? result : null
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
    const payload = buildPulsePayload(form)
    const timeoutId = window.setTimeout(() => controller.abort(), 16000)
    setStatus('loading')
    setErrorMessage(null)
    setLastRequestPayload(payload)

    try {
      const response = await fetch(`/api/pulse/simulate?ts=${Date.now()}`, {
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
      if (!mountedRef.current || abortRef.current !== controller) {
        return
      }
      setResult(parsed)
      setResultForm({ ...form })
      setStatus('success')
      setErrorMessage(null)
      setLastResponseAt(new Date().toISOString())
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
        <nav className="pulse-lab__nav" aria-label="Pulse Lab navigation">
          <button type="button" onClick={onOpenSimulation}>Gate-aware simulation</button>
          <button type="button" onClick={onOpenHelp}>Help</button>
          <button type="button" onClick={onBackToHome}>Home</button>
        </nav>
      </header>

      <aside className="pulse-lab__scope-note" aria-label="Pulse Lab scope">
        <strong>Single-pulse experiment.</strong>
        <span>
          Circuit Studio and the gate-aware State Explorer are not connected
          to this model. Pulse results remain inside Pulse Lab.
        </span>
      </aside>

      <section className="pulse-lab__identity" aria-label="Pulse model identity">
        <div>
          <span>MODEL</span>
          <strong>
            {form.modelId === QUTRIT_PULSE_MODEL
              ? 'Three-level transmon qutrit'
              : 'Two-level baseline'}
          </strong>
        </div>
        <div>
          <span>FRAME</span>
          <strong>Rotating / RWA</strong>
        </div>
        <div>
          <span>PULSE WINDOW</span>
          <strong>{pulseDurationUs(form).toPrecision(4)} us</strong>
        </div>
        <div>
          <span>TOTAL OBSERVATION</span>
          <strong>{form.totalSimulationTimeUs.toPrecision(4)} us</strong>
        </div>
      </section>

      <div className="pulse-lab__workspace">
        <PulseParameterPanel
          form={form}
          errors={errors}
          disabled={status === 'loading'}
          onChange={setForm}
        />

        <section className="pulse-lab__run" aria-labelledby="pulse-run-title">
          <div>
            <span>BOUNDED EXECUTION</span>
            <h2 id="pulse-run-title">Run pulse simulation</h2>
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
            {status === 'loading' ? 'Running...' : 'Run pulse simulation'}
          </button>
          {!isValid ? (
            <p className="pulse-lab__run-error" role="alert">
              Correct the highlighted fields before running.
            </p>
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
            </section>

            <PulseSummary response={result} formAtRun={activeResultForm} />
            <PulsePopulationTimeline response={result} formAtRun={activeResultForm} />
            {qutritResult ? (
              <PulseDensityMatrixHeatmap matrix={qutritResult.final.density_matrix} />
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
    </main>
  )
}

function PulseSummary({
  response,
  formAtRun,
}: {
  response: PulseResponse
  formAtRun: PulseLabForm
}) {
  const qutrit = isQutritPulseResponse(response)
  const pulseEnd = response.pulse_end
  const final = response.final
  const fidelity = isQutritPulseResponse(response)
    ? qutritTargetOverlap(response.final, formAtRun)
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
        <span>{qutrit ? 'TARGET OVERLAP' : 'FINAL FIDELITY'}</span>
        <strong>{fidelity === null ? 'N/A' : fidelity.toFixed(6)}</strong>
        {qutrit ? <small>Not leakage-renormalized</small> : null}
      </article>
      {qutrit ? (
        <>
          <article className="pulse-lab__summary--leakage">
            <span>MAX LEAKAGE P2</span>
            <strong>{response.leakage.maximum_recorded_leakage_probability.toFixed(6)}</strong>
          </article>
          <article className="pulse-lab__summary--leakage">
            <span>FINAL LEAKAGE P2</span>
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
