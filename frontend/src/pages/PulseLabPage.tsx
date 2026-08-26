import { useEffect, useRef, useState } from 'react'
import { PulseDensityMatrixHeatmap } from '../components/PulseDensityMatrixHeatmap'
import { PulseEnvironmentPanel } from '../components/PulseEnvironmentPanel'
import { PulsePopulationTimeline } from '../components/PulsePopulationTimeline'
import { PulseWaveform } from '../components/PulseWaveform'
import { QuantumPet, type QuantumPetPhase } from '../components/QuantumPet'
import { ResultDrawer } from '../components/ResultDrawer'
import { SimulationCompletionPopup } from '../components/SimulationCompletionPopup'
import { apiUrl } from '../utils/apiBase'
import { pulseLabTips, pulseRunningStages } from '../utils/quantumPetTips'
import { useInternalInfoVisible } from '../context/useAdminMode'
import {
  isQutritPulseResponse,
  isCoupledTransmonNetworkResponse,
  isCoupledTransmonPairResponse,
  COUPLED_TRANSMON_NETWORK_PULSE_MODEL,
  COUPLED_TRANSMON_PAIR_PULSE_MODEL,
  QUTRIT_PULSE_MODEL,
  type PulseLabForm,
  type PulseComplexValue,
  type PulseCostEstimate,
  type QutritPulsePoint,
  type QutritPulseResponse,
  type PulseResponse,
  type PulseRunRecord,
} from '../types/pulse'
import type {
  PulseCircuitState,
  PulseCircuitStep,
  PulseExecutionConstraints,
} from '../types/pulseCircuit'
import {
  buildPulsePayload,
  buildTransmonNetworkPayload,
  circuitLaneWaveform,
  estimatePulseCost,
  estimateTransmonNetworkCost,
  hasPulseResponseShape,
  pulseDurationUs,
  pulseWaveform,
  sequentialPulseWaveform,
  qutritTargetOverlap,
  validatePulseLabForm,
} from '../utils/pulseLab'
import {
  applyPulseStepToForm,
  isDrivePulseStep,
  normalizeFramePhase,
  pulseStepDurationUs,
} from '../utils/pulseCircuit'
import {
  constraintsAreWellFormed,
  drivePulseConstraintIssues,
  isAlignedToResolution,
  virtualZConstraintIssues,
} from '../utils/pulseConstraints'
import './PulseLabPage.css'

type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

const PET_CELEBRATION_MS = 7000

type PulseLabPageProps = {
  form: PulseLabForm
  onFormChange: (form: PulseLabForm) => void
  circuit: PulseCircuitState
  sequence: PulseCircuitStep[]
  activeTransmonIndex: number
  executionConstraints: PulseExecutionConstraints
  onExecutionConstraintsChange: (next: PulseExecutionConstraints) => void
  /*
   * 直近の実行結果はアプリ側が持つ。Pulse状態エクスプローラーが同じ結果を読むので、
   * このページを離れても消えない場所へ置く必要がある。
   */
  latestRun: PulseRunRecord | null
  runSignature: string
  onRunCommitted: (run: PulseRunRecord) => void
  onOpenPulseStateExplorer: () => void
}

export function PulseLabPage({
  form,
  onFormChange,
  circuit,
  sequence,
  activeTransmonIndex,
  executionConstraints,
  onExecutionConstraintsChange,
  latestRun,
  runSignature,
  onRunCommitted,
  onOpenPulseStateExplorer,
}: PulseLabPageProps) {
  const internalInfoVisible = useInternalInfoVisible()
  const result = latestRun?.response ?? null
  const resultForm = latestRun?.formAtRun ?? null
  const lastResponseAt = latestRun?.completedAt ?? null
  const [status, setStatus] = useState<RequestStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [lastRequestPayload, setLastRequestPayload] = useState<Record<string, unknown> | null>(null)
  const [showCompletionPopup, setShowCompletionPopup] = useState(false)
  const [petCelebrating, setPetCelebrating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const networkMode = form.modelId === COUPLED_TRANSMON_NETWORK_PULSE_MODEL
  const executionPlan = networkMode
    ? transmonNetworkExecutionPlan(form, circuit)
    : sequenceExecutionPlan(form, sequence, executionConstraints)
  const executionForms = executionPlan
    .filter((operation): operation is SequenceDriveOperation => operation.kind === 'drive')
    .map((operation) => operation.form)
  const sequenceMode = form.modelId === QUTRIT_PULSE_MODEL
  const sequenceDurationUs = networkMode
    ? transmonNetworkDurationUs(circuit)
    : sequenceMode
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
  const cost = networkMode
    ? estimateTransmonNetworkCost(form, circuit)
    : combinedPulseCost(executionForms)
  const waveform = networkMode
    ? circuitLaneWaveform(form, circuit, activeTransmonIndex)
    : sequenceMode
      ? sequentialPulseWaveform(executionForms, executionConstraints.interPulseGapUs)
      : pulseWaveform(form)
  const waveformPulseEndTimeUs = networkMode || sequenceMode
    ? sequenceDurationUs
    : pulseDurationUs(form)
  const waveformScopeLabel = networkMode
    ? `q${activeTransmonIndex} レーンの回路波形`
    : sequenceMode
      ? `q${activeTransmonIndex} シーケンスの回路波形`
      : '単一 Pulse の波形'
  const constraintIssues = [
    ...validateExecutionConstraints(executionPlan, executionConstraints),
    ...validatePairSecondaryConstraints(form, executionConstraints),
    ...(networkMode
      ? validateTransmonNetworkScope(circuit, sequenceDurationUs, form.totalSimulationTimeUs)
      : []),
  ]
  const hasNoDriveInSequence = sequenceMode && executionForms.length === 0
  const isValid = Object.keys(errors).length === 0
    && executionErrors.length === 0
    && constraintIssues.length === 0
    && !hasNoDriveInSequence
    && (!networkMode || (
      circuit.transmons.length >= 2
      && circuit.transmons.length <= 4
      && executionForms.length > 0
      && sequenceDurationUs <= form.totalSimulationTimeUs
    ))
  const canRun = isValid && !cost.overBudget && status !== 'loading'
  /*
   * スタジオで複数レーンを組んでも、モデルがネットワークでなければ実行されるのは
   * 選択中の1レーンだけ。密度行列の次元が回路と噛み合わない原因がこれなので、
   * 何が走るのかを実行ボタンの手前で明示し、一斉実行へ1クリックで移れるようにする。
   */
  const lanesWithDrives = circuit.lanes.filter((lane) => lane.steps.some(isDrivePulseStep))
  const networkDimension = 3 ** circuit.transmons.length
  const networkRunAvailable = circuit.transmons.length >= 2 && circuit.transmons.length <= 4
  const singleLaneWhileMultiLane = !networkMode && lanesWithDrives.length >= 2

  function switchToNetworkRun() {
    /* 総観測時間が最長レーンより短いと切り替えた瞬間に実行不可になるので、同時に伸ばす。 */
    const requiredDurationUs = transmonNetworkDurationUs(circuit)
    onFormChange({
      ...form,
      modelId: COUPLED_TRANSMON_NETWORK_PULSE_MODEL,
      evolutionMethod: 'fixed_step_rk4',
      totalSimulationTimeUs: Math.max(form.totalSimulationTimeUs, requiredDurationUs),
    })
  }
  const qutritResult = result && isQutritPulseResponse(result) ? result : null
  const pairResult = result && isCoupledTransmonPairResponse(result) ? result : null
  const networkResult = result && isCoupledTransmonNetworkResponse(result) ? result : null
  const activeResultForm = resultForm ?? form

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  /*
   * ペットは完了色（菫）をしばらく保ってから、基本色（緑）へ戻る。
   */
  useEffect(() => {
    if (!petCelebrating) {
      return
    }

    const timeoutId = window.setTimeout(() => setPetCelebrating(false), PET_CELEBRATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [petCelebrating])

  const petPhase: QuantumPetPhase =
    status === 'loading' ? 'running' : petCelebrating ? 'done' : 'idle'
  const petMessage =
    petPhase === 'running'
      ? null
      : petPhase === 'done'
        ? 'パルスシミュレーションが完了したよ。占有数の変化を見てみよう。'
        : status === 'error' && errorMessage !== null
          ? `つまずいたみたい：${errorMessage}`
          : null

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
      form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL || networkMode
        ? 90000
        : Math.min(
            120000,
            (form.evolutionMethod === 'explicit_cptp' ? 30000 : 16000)
              * executionForms.length,
          ),
    )
    setStatus('loading')
    setErrorMessage(null)
    setErrorDetail(null)
    setLastRequestPayload(null)

    try {
      let initialDensityMatrix: PulseComplexValue[][] | undefined
      const responses: PulseResponse[] = []
      const driveStepIndices: number[] = []
      const driveLabels: string[] = []
      const virtualEvents: SequenceVirtualEvent[] = []
      let latestQutritPoint: QutritPulsePoint | null = null
      let framePhaseRad = 0
      if (networkMode) {
        const payload = buildTransmonNetworkPayload(form, circuit)
        payloads.push(payload)
        const response = await fetch(apiUrl('/api/pulse/simulate'), {
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
        if (!hasPulseResponseShape(parsed) || !isCoupledTransmonNetworkResponse(parsed)) {
          throw new Error('複数トランズモンAPIが不正な形式のレスポンスを返しました。')
        }
        responses.push(parsed)
      } else for (const operation of executionPlan) {
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
        const response = await fetch(apiUrl('/api/pulse/simulate'), {
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
          throw new Error('Pulse APIが不正な形式のレスポンスを返しました。')
        }
        if (sequenceMode && !isQutritPulseResponse(parsed)) {
          throw new Error('Pulseシーケンスの実行には現在qutritモデルが必要です。')
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
      onRunCommitted({
        response: nextResult,
        formAtRun: { ...form },
        completedAt: new Date().toISOString(),
        signature: runSignature,
      })
      setStatus('success')
      setErrorMessage(null)
      setErrorDetail(null)
      setShowCompletionPopup(true)
      setPetCelebrating(true)
    } catch (error) {
      if (!mountedRef.current || abortRef.current !== controller) {
        return
      }
      setStatus('error')
      setPetCelebrating(false)
      /* 例外本文にはサーバ側の内部情報が載りうるので、詳細は管理者モードだけに出す。 */
      const timedOut = error instanceof Error && error.name === 'AbortError'
      setErrorMessage(
        timedOut
          ? '待ち時間の上限に達したため、実行を打ち切りました。前回の有効な結果を表示しています。'
          : 'Pulseの実行に失敗しました。前回の有効な結果を表示しています。',
      )
      setErrorDetail(
        timedOut
          ? 'request aborted by timeout'
          : error instanceof Error
            ? error.message
            : null,
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
          <span className="pulse-lab__eyebrow">Yuragi-Strider / 実験的</span>
          <h1>Pulseラボ</h1>
          <p>
            回転フレームRWA制御エンベロープの実験的モデルです。
            <strong> 校正済みのハードウェアモデルではありません。</strong>
          </p>
        </div>
      </header>

      <aside className="pulse-lab__scope-note" aria-label="Pulseラボの適用範囲">
        <strong>{networkMode ? '複数レーン同時実行。' : sequenceMode ? `q${activeTransmonIndex} シーケンス実行。` : '単一Pulse実験。'}</strong>
        <span>
          {networkMode
            ? `${circuit.transmons.length}台の3準位トランズモンと全レーンのPulseを、${3 ** circuit.transmons.length}次元の密度行列で同時に発展させます。`
            : form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
            ? `q${form.pairDriveTarget}への現在の局所Pulseと、q0-q1交換結合を9次元密度行列で実行します。回路レーンの同時driveは未接続です。`
            : sequenceMode
            ? `${sequence.length}個のPulseを、密度行列と共通環境を引き継いで順番に実行します。`
            : 'Pulse回路にブロックがないため、現在の単一Pulse設定を実行します。'}
        </span>
      </aside>

      {/* モデル識別と発展方式の内訳は内部情報。 */}
      {internalInfoVisible ? (
      <section className="pulse-lab__identity" aria-label="Pulseモデルの識別情報">
        <div>
          <span>モデル</span>
          <strong>
            {form.modelId === QUTRIT_PULSE_MODEL
              ? '3準位トランズモン qutrit'
              : networkMode
                ? `${circuit.transmons.length}トランズモン・ネットワーク / 3^${circuit.transmons.length}準位`
              : form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
                ? '結合トランズモンペア / 3 x 3準位'
              : '2準位ベースライン'}
          </strong>
        </div>
        <div>
          <span>フレーム</span>
          <strong>回転フレーム / RWA</strong>
        </div>
        <div>
          <span>PULSE時間幅</span>
          <strong>{sequenceDurationUs.toPrecision(4)} us</strong>
        </div>
        <div>
          <span>総観測時間</span>
          <strong>{form.totalSimulationTimeUs.toPrecision(4)} us</strong>
        </div>
        <div>
          <span>発展方式</span>
          <strong>
            {form.evolutionMethod === 'explicit_cptp'
              ? '明示的 CPTP 写像'
              : '固定ステップ RK4'}
          </strong>
        </div>
      </section>
      ) : null}

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
            <span>実行上限管理</span>
            <h2 id="pulse-run-title">{sequenceMode ? 'Pulseシーケンスを実行' : 'Pulseシミュレーションを実行'}</h2>
            <p data-level={cost.level}>
              {cost.message} UIによる保守的な見積り: 約{' '}
              {cost.estimatedInternalSteps.toLocaleString()} /{' '}
              {cost.maximumInternalSteps.toLocaleString()} ステップ。
            </p>
          </div>

          <div className="pulse-lab__run-scope" data-tone={singleLaneWhileMultiLane ? 'warn' : 'info'}>
            <dl>
              <div>
                <dt>実行対象</dt>
                <dd>
                  {networkMode
                    ? `全 ${circuit.transmons.length} レーン同時（q0〜q${circuit.transmons.length - 1}）`
                    : `q${activeTransmonIndex} のレーンのみ`}
                </dd>
              </div>
              <div>
                <dt>密度行列</dt>
                <dd>
                  {networkMode
                    ? `${networkDimension} × ${networkDimension}（3^${circuit.transmons.length}）`
                    : form.modelId === COUPLED_TRANSMON_PAIR_PULSE_MODEL
                      ? '9 × 9（3 × 3）'
                      : form.modelId === QUTRIT_PULSE_MODEL
                        ? '3 × 3（1トランズモン）'
                        : '2 × 2（1トランズモン）'}
                </dd>
              </div>
            </dl>
            {singleLaneWhileMultiLane ? (
              <>
                <p>
                  回路には Pulse を持つレーンが {lanesWithDrives.length} 本ありますが、
                  いまのモデルでは q{activeTransmonIndex} だけが実行され、残りは無視されます。
                </p>
                {networkRunAvailable ? (
                  <button type="button" onClick={switchToNetworkRun} disabled={status === 'loading'}>
                    全 {circuit.transmons.length} レーンを同時実行に切り替え（{networkDimension} 次元）
                  </button>
                ) : (
                  <p>
                    同時実行できるのは2〜4トランズモンです。回路スタジオでトランズモン数を調整してください。
                  </p>
                )}
              </>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canRun}
            onClick={() => void runPulseSimulation()}
          >
            {status === 'loading'
              ? `${executionForms.length}個のブロックを実行中...`
              : networkMode
                ? `全 ${circuit.transmons.length} レーンを同時実行`
                : sequenceMode
                  ? `q${activeTransmonIndex} シーケンスのみ実行`
                  : 'Pulseシミュレーションを実行'}
          </button>
          {hasNoDriveInSequence ? (
            <p className="pulse-lab__run-error" role="alert">
              回路に駆動 Pulse がありません。波形はゼロのままです。Circuit Studio で Pulse ブロックを追加してください。
            </p>
          ) : !isValid ? (
            <p className="pulse-lab__run-error" role="alert">
              実行前に、強調表示されている項目を修正してください。
            </p>
          ) : null}
          {constraintIssues.length > 0 ? (
            <ul className="pulse-lab__run-error" aria-label="実行制約の違反">
              {constraintIssues.map((issue) => (
                <li key={`${issue.stepIndex}-${issue.message}`}>{issue.label}: {issue.message}</li>
              ))}
            </ul>
          ) : null}
          {errorMessage ? (
            <p className="pulse-lab__run-error" role="alert">
              {errorMessage}
              {internalInfoVisible && errorDetail ? (
                <span className="pulse-lab__run-error-detail">{errorDetail}</span>
              ) : null}
            </p>
          ) : null}
        </section>

        <PulseWaveform
          points={waveform}
          pulseDurationUs={waveformPulseEndTimeUs}
          totalSimulationTimeUs={form.totalSimulationTimeUs}
          scopeLabel={waveformScopeLabel}
        />

        {result ? (
          <>
            {/* 実行系の内訳バナーも内部情報。 */}
            {internalInfoVisible ? (
            <section className="pulse-lab__result-banner">
              <div>
                <span>直近の有効な結果</span>
                <strong>{result.model.description}</strong>
              </div>
              <div>
                <span>契約バージョン</span>
                <strong>{result.contract_version}</strong>
              </div>
              <div>
                <span>完了時刻</span>
                <strong>{lastResponseAt ? new Date(lastResponseAt).toLocaleTimeString() : 'たった今'}</strong>
              </div>
              <div>
                <span>発展方式</span>
                <strong>
                  {result.diagnostics.evolution.resolved === 'explicit_cptp'
                    ? '明示的 CPTP 写像'
                    : '固定ステップ RK4'}
                </strong>
              </div>
            </section>
            ) : null}

            <section className="pulse-lab__explorer-link">
              <div>
                <span>結果を読み解く</span>
                <strong>Pulse 状態エクスプローラー</strong>
                <p>
                  時刻カーソルを1本共有して、指標・占有確率・密度行列を同じ瞬間で並べて読めます。
                </p>
              </div>
              <button type="button" onClick={onOpenPulseStateExplorer}>
                Pulse 状態エクスプローラーで開く
              </button>
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
            {networkResult ? (
              <PulseDensityMatrixHeatmap
                key={`network-density-${networkResult.model.hilbert_dimension}`}
                matrix={networkResult.final.density_matrix}
                basisLabels={networkResult.model.basis_order}
              />
            ) : null}

            <div className="pulse-lab__drawers">
              {/*
                以下は API の応答をそのまま流した生データで、内部フィールド名が
                そのまま並ぶ。管理者モードのときだけ開けるようにしている。
              */}
              {internalInfoVisible ? (
                <>
                  <ResultDrawer
                    eyebrow="モデル"
                    title="モデルと近似の詳細"
                    description="APIが返すモデル識別情報と前提条件。"
                  >
                    <JsonBlock value={result.model} />
                  </ResultDrawer>
                  <ResultDrawer
                    eyebrow="環境"
                    title="レートと熱占有数"
                    description="ソルバーが実際に使用した正規化レート。"
                  >
                    <JsonBlock value={result.rates} />
                  </ResultDrawer>
                  <ResultDrawer
                    eyebrow="数値計算"
                    title="ステップ方針と物理的整合性"
                    description="計算量の上限、生の物理的整合性、クリーンアップ診断。"
                  >
                    <JsonBlock value={{ step_policy: result.step_policy, diagnostics: result.diagnostics }} />
                  </ResultDrawer>
                </>
              ) : null}
              {(result.warnings.length > 0 || result.limitations.length > 0) ? (
                <ResultDrawer
                  eyebrow="適用範囲"
                  title="警告と制限事項"
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
              {internalInfoVisible ? (
                <ResultDrawer
                  eyebrow="API"
                  title="リクエストのデバッグ情報"
                  description="このページが最後に送信したペイロード。未使用のフィールドは含まれません。"
                >
                  <JsonBlock value={lastRequestPayload} />
                </ResultDrawer>
              ) : null}
            </div>
          </>
        ) : (
          <section className="pulse-lab__empty">
            <span>実行準備完了</span>
            <h2>まだPulseの結果がありません</h2>
            <p>波形と計算量見積りを確認してから、選択したモデルを実行してください。</p>
          </section>
        )}
      </div>
      {showCompletionPopup ? (
        <SimulationCompletionPopup
          mode="pulse"
          title="Pulse シミュレーションが完了しました"
          detail={
            internalInfoVisible
              ? `発展方式: ${result?.diagnostics.evolution.resolved ?? '完了'}`
              : '波形どおりに時間発展を計算しました'
          }
          onDismiss={() => setShowCompletionPopup(false)}
        />
      ) : null}
      <QuantumPet
        phase={petPhase}
        message={petMessage}
        tips={pulseLabTips}
        stages={pulseRunningStages}
      />
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

function transmonNetworkExecutionPlan(
  globalForm: PulseLabForm,
  circuit: PulseCircuitState,
): SequenceExecutionOperation[] {
  let stepIndex = 0
  return circuit.lanes.flatMap((lane) => lane.steps.map((step) => {
    const currentIndex = stepIndex
    stepIndex += 1
    return isDrivePulseStep(step)
      ? {
          kind: 'drive' as const,
          stepIndex: currentIndex,
          label: `q${lane.transmonIndex} / ${step.label}`,
          form: applyPulseStepToForm(globalForm, step.pulse),
        }
      : {
          kind: 'virtual_z' as const,
          stepIndex: currentIndex,
          label: `q${lane.transmonIndex} / ${step.label}`,
          angleRad: step.angleRad,
        }
  }))
}

function transmonNetworkDurationUs(circuit: PulseCircuitState): number {
  return Math.max(0, ...circuit.lanes.map((lane) => {
    const driveSteps = lane.steps.filter(isDrivePulseStep)
    return driveSteps.reduce(
      (total, step) => total + pulseStepDurationUs(step.pulse),
      0,
    ) + Math.max(0, driveSteps.length - 1) * circuit.executionConstraints.interPulseGapUs
  }))
}

function sequenceExecutionPlan(
  globalForm: PulseLabForm,
  sequence: PulseCircuitStep[],
  constraints: PulseExecutionConstraints,
): SequenceExecutionOperation[] {
  if (globalForm.modelId !== QUTRIT_PULSE_MODEL) {
    return [{ kind: 'drive', stepIndex: 0, label: '単一Pulse', form: { ...globalForm } }]
  }
  if (sequence.length === 0) {
    return []
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
  if (!constraintsAreWellFormed(constraints)) {
    return [{
      stepIndex: -1,
      label: '全体制約',
      message: '上限値と分解能は正の有限値である必要があります(Pulse間隔は0でも構いません)。',
    }]
  }

  return executionPlan.flatMap((operation) => {
    const messages = operation.kind === 'virtual_z'
      ? virtualZConstraintIssues(operation.angleRad, constraints)
      : drivePulseConstraintIssues(operation.form, constraints)
    return messages.map((message) => ({
      stepIndex: operation.stepIndex,
      label: operation.label,
      message,
    }))
  })
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
    issues.push({ stepIndex: -2, label: '副駆動', message: `Pulse幅は ${constraints.minimumPulseDurationUs} us 以上である必要があります。` })
  }
  if (!isAlignedToResolution(duration, constraints.awgSamplePeriodUs)) {
    issues.push({ stepIndex: -2, label: '副駆動', message: `幅は ${constraints.awgSamplePeriodUs} us の倍数である必要があります。` })
  }
  if (!isAlignedToResolution(secondaryForm.phaseRad, constraints.phaseResolutionRad)) {
    issues.push({ stepIndex: -2, label: '副駆動', message: `位相は ${constraints.phaseResolutionRad.toPrecision(4)} rad の倍数である必要があります。` })
  }
  const peak = Math.max(
    0,
    ...pulseWaveform(secondaryForm, 129).map((point) => Math.hypot(point.omegaX, point.omegaY)),
  )
  if (peak > constraints.maximumDriveAmplitudeRadPerUs * (1 + 1e-9)) {
    issues.push({ stepIndex: -2, label: '副駆動', message: `波形のピーク ${peak.toPrecision(4)} rad/us が上限を超えています。` })
  }
  return issues
}

function validateTransmonNetworkScope(
  circuit: PulseCircuitState,
  scheduledDurationUs: number,
  totalSimulationTimeUs: number,
): PulseConstraintIssue[] {
  const issues: PulseConstraintIssue[] = []
  if (circuit.transmons.length < 2 || circuit.transmons.length > 4) {
    issues.push({
      stepIndex: -3,
      label: 'トランズモン数',
      message: '複数トランズモン・ネットワークは2〜4台で実行してください。',
    })
  }
  if (scheduledDurationUs > totalSimulationTimeUs + 1e-14) {
    issues.push({
      stepIndex: -4,
      label: 'ネットワーク時間軸',
      message: `最長レーン ${scheduledDurationUs.toPrecision(4)} us が総観測時間 ${totalSimulationTimeUs.toPrecision(4)} us を超えています。`,
    })
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
      ? '少なくとも1つのPulseブロックがAPIのリクエストあたりの計算量上限を超えています。'
      : forms.length > 1
        ? `${forms.length}個の連続したPulseブロックの推定計算量はAPI上限内です。`
        : costs[0]?.message ?? '推定計算量はAPI上限内です。',
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
    throw new Error('Pulseシーケンスから結果が返されませんでした。')
  }

  let timeOffset = 0
  let finalStepOffset = 0
  const trajectory: QutritPulseResponse['trajectory'] = []
  let maximumLeakage = 0
  let estimatedInternalSteps = 0
  const operationLabels = Array.from({ length: totalOperationCount }, (_, index) => `ステップ${index + 1}`)

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
      `密度行列の引き継ぎと位相フレーム追跡を伴い、${totalOperationCount}個の操作を実行しました。`,
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
  const network = isCoupledTransmonNetworkResponse(response)
  const coupled = pair || network
  const pulseEnd = response.pulse_end
  const final = response.final
  const fidelity = coupled
    ? null
    : isQutritPulseResponse(response)
    ? Number(response.input.sequence_length ?? 1) > 1
      ? null
      : qutritTargetOverlap(response.final, formAtRun)
    : response.final.fidelity_to_closed
  return (
    <section className="pulse-lab__summary" aria-label="Pulse結果サマリー">
      <article>
        <span>Pulse終了時の純度</span>
        <strong>{pulseEnd.purity.toFixed(6)}</strong>
      </article>
      <article>
        <span>最終純度</span>
        <strong>{final.purity.toFixed(6)}</strong>
      </article>
      <article>
        <span>{qutrit ? '目標状態との重なり' : coupled ? '結合モデル' : '最終忠実度'}</span>
        <strong>{fidelity === null ? 'N/A' : fidelity.toFixed(6)}</strong>
        {qutrit ? <small>リーケージ非正規化</small> : null}
      </article>
      {qutrit || coupled ? (
        <>
          <article className="pulse-lab__summary--leakage">
            <span>{coupled ? '計算空間外の最大値' : '最大リーケージ P2'}</span>
            <strong>{response.leakage.maximum_recorded_leakage_probability.toFixed(6)}</strong>
          </article>
          <article className="pulse-lab__summary--leakage">
            <span>{coupled ? '計算空間外の最終値' : '最終リーケージ P2'}</span>
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
      ? 'Pulseリクエストが検証または計算量ゲートで拒否されました。'
      : response.status === 504
        ? 'PulseリクエストがAPIのタイムアウトを超過しました。'
        : `Pulse APIがHTTP ${response.status}を返しました。`
  return detail ? `${label} ${detail}` : label
}
