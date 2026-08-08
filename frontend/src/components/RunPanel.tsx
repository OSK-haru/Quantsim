import './RunPanel.css'
import { ResultDrawer } from './ResultDrawer'
import { SectionHeader } from './SectionHeader'
import { RunCostNotice } from './RunCostNotice'
import { SimulationProgressIndicator } from './SimulationProgressIndicator'
import type {
  GateAwareEvolutionMethod,
  GateCompilationMode,
  RunPanelData,
  SimulationBackend,
  SimulationLoadStatus,
} from '../types/simulation'
import type { SimulationCostEstimate } from '../utils/simulationCost'

type RunPanelProps = {
  run: RunPanelData
  costEstimate: SimulationCostEstimate
  connectionLabel: string
  dataSourceLabel: string
  loadStatus: SimulationLoadStatus
  errorMessage: string | null
  lastFetchResult: string
  lastFetchUrl: string
  lastFetchStartedAt: string
  frontendRunStartedAt: string
  frontendRunFinishedAt: string
  frontendRunElapsedMs: number | null
  frontendRunTimeoutMs: number | null
  evolutionMethod: GateAwareEvolutionMethod
  compilationMode: GateCompilationMode
  simulationBackend: SimulationBackend
  onEvolutionMethodChange: (method: GateAwareEvolutionMethod) => void
  onCompilationModeChange: (mode: GateCompilationMode) => void
  onSimulationBackendChange: (backend: SimulationBackend) => void
  onReloadApiExample: () => void
  onRunSimulation: () => void
}

const evolutionMethodDescriptions: Record<GateAwareEvolutionMethod, string> = {
  fixed_step_rk4:
    'ゲート区間とアイドル区間を固定ステップ RK4 で時間発展し、更新後に密度行列を補正します。',
  explicit_cptp:
    '時間一定の GKSL 生成子から区間ごとの CPTP 写像を構築・監査し、密度行列の補正なしで適用します。',
}

const backendDescriptions: Record<SimulationBackend, string> = {
  python_dense: '検証済みの標準 Python dense バックエンドです。',
  rust_dense_preview:
    '任意の Rust preview バックエンドです。RK4 は利用不可時に Python へフォールバックし、Explicit CPTP には Rust 拡張が必要です。',
}

const compilationModeDescriptions: Record<GateCompilationMode, string> = {
  logical_direct:
    '発展ゲートを1つの有効Hamiltonianとして直接実行します。',
  auto_decompose:
    '発展ゲートを基本ゲート列へ展開し、増加した深さと実行時間にもノイズを作用させます。',
}

const compilationModeLabels: Record<GateCompilationMode, string> = {
  logical_direct: '理想ゲート（直接）',
  auto_decompose: '基本ゲートへ自動分解',
}

const evolutionMethodLabels: Record<GateAwareEvolutionMethod, string> = {
  fixed_step_rk4: 'Fixed-step RK4',
  explicit_cptp: 'Explicit CPTP maps',
}

const backendLabels: Record<SimulationBackend, string> = {
  python_dense: 'Python dense',
  rust_dense_preview: 'Rust dense (preview)',
}

function formatElapsedMs(value: number | null) {
  if (value === null) {
    return '利用できません'
  }
  return `${value.toFixed(1)} ms`
}

function formatDurationUs(value: number | null) {
  return value === null ? '—' : `${value.toFixed(3)} us`
}

function formatCompiledOperation(operation: {
  gate: string
  targets: number[]
  controls: number[]
  params: Record<string, number>
}) {
  const angle = operation.params.theta_rad
  const angleLabel = Number.isFinite(angle) ? ` θ=${angle.toFixed(4)}` : ''
  if (operation.controls.length > 0 && operation.targets.length > 0) {
    const controls = operation.controls.map((control) => `q${control}`).join(',')
    const targets = operation.targets.map((target) => `q${target}`).join(',')
    return `${operation.gate}(${controls}→${targets}${angleLabel})`
  }
  return `${operation.gate}(${operation.targets.map((target) => `q${target}`).join(',')}${angleLabel})`
}

export function RunPanel({
  run,
  costEstimate,
  connectionLabel,
  dataSourceLabel,
  loadStatus,
  errorMessage,
  lastFetchResult,
  lastFetchUrl,
  lastFetchStartedAt,
  frontendRunStartedAt,
  frontendRunFinishedAt,
  frontendRunElapsedMs,
  frontendRunTimeoutMs,
  evolutionMethod,
  compilationMode,
  simulationBackend,
  onEvolutionMethodChange,
  onCompilationModeChange,
  onSimulationBackendChange,
  onReloadApiExample,
  onRunSimulation,
}: RunPanelProps) {
  const canRun = run.can_run ?? true
  const isRequestPending = loadStatus === 'loading'

  return (
    <section className="run-panel" aria-label="シミュレーションの実行" data-load-status={loadStatus}>
      <div className="run-panel__header">
        <SectionHeader icon="terminal" eyebrow="実行" title="シミュレーションを実行" />
        <div className="run-panel__meta">
          <p className="run-panel__status">読み込み状態: {loadStatus}</p>
          <p className="run-panel__source">接続: {connectionLabel}</p>
          <p className="run-panel__source">データソース: {dataSourceLabel}</p>
          {errorMessage ? (
            <p className="run-panel__error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <SimulationProgressIndicator isPending={isRequestPending} timeoutMs={frontendRunTimeoutMs} />

      <div className="run-panel__rows">
        <details className="run-panel__methods">
          <summary className="run-panel__methods-summary">
            <span>
              <strong>計算方法</strong>
              <small>
                推奨設定を使用中: {compilationModeLabels[compilationMode]} /{' '}
                {evolutionMethodLabels[evolutionMethod]} / {backendLabels[simulationBackend]}
              </small>
            </span>
            <span className="run-panel__methods-toggle" aria-hidden="true" />
          </summary>
          <div className="run-panel__methods-body">
            <label className="run-panel__method">
              <span>
                <strong>Gate execution</strong>
                <small>{compilationModeDescriptions[compilationMode]}</small>
              </span>
              <select
                value={compilationMode}
                onChange={(event) => {
                  onCompilationModeChange(event.target.value as GateCompilationMode)
                }}
                disabled={isRequestPending}
                aria-label="Gate compilation mode"
              >
                <option value="logical_direct">理想ゲート（直接）</option>
                <option value="auto_decompose">基本ゲートへ自動分解</option>
              </select>
            </label>
            <label className="run-panel__method">
              <span>
                <strong>Evolution method</strong>
                <small>{evolutionMethodDescriptions[evolutionMethod]}</small>
              </span>
              <select
                value={evolutionMethod}
                onChange={(event) => {
                  onEvolutionMethodChange(
                    event.target.value as GateAwareEvolutionMethod,
                  )
                }}
                disabled={isRequestPending}
                aria-label="Gate-aware evolution method"
              >
                <option value="fixed_step_rk4">Fixed-step RK4</option>
                <option value="explicit_cptp">Explicit CPTP maps</option>
              </select>
            </label>
            <label className="run-panel__method">
              <span>
                <strong>Execution backend</strong>
                <small>{backendDescriptions[simulationBackend]}</small>
              </span>
              <select
                value={simulationBackend}
                onChange={(event) => {
                  onSimulationBackendChange(event.target.value as SimulationBackend)
                }}
                disabled={isRequestPending}
                aria-label="Simulation backend"
              >
                <option value="python_dense">Python dense (standard)</option>
                <option value="rust_dense_preview">Rust dense (preview)</option>
              </select>
            </label>
          </div>
        </details>
        <div className="run-panel__row">
          <span className="run-panel__label">状態</span>
          <strong className="run-panel__value">{run.status}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">前回のバックエンド</span>
          <strong className="run-panel__value">{run.selected_backend}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">前回の実行</span>
          <strong className="run-panel__value">{run.last_run_label}</strong>
        </div>
        {run.compilation ? (
          <>
            <div className="run-panel__row">
              <span className="run-panel__label">Gate count</span>
              <strong className="run-panel__value">
                {run.compilation.logical_gate_count} → {run.compilation.compiled_gate_count}
              </strong>
            </div>
            <div className="run-panel__row">
              <span className="run-panel__label">Depth</span>
              <strong className="run-panel__value">
                {run.compilation.logical_depth} → {run.compilation.compiled_depth}
              </strong>
            </div>
            <div className="run-panel__row">
              <span className="run-panel__label">Gate duration</span>
              <strong className="run-panel__value">
                {formatDurationUs(run.compilation.logical_duration_us)} →{' '}
                {formatDurationUs(run.compilation.compiled_duration_us)}
              </strong>
            </div>
          </>
        ) : null}
      </div>

      {run.compilation ? (
        <ResultDrawer
          eyebrow="GATE COMPILER"
          title="分解後の回路"
          icon="chip"
          description="論理ゲートと、実際にGate-awareモデルへ渡された基本ゲート列の対応です。"
          defaultOpen={run.compilation.mode === 'auto_decompose'}
        >
          <div className="run-panel__debug-grid">
            {(run.compilation.compiled_circuit.columns ?? []).map((column) => (
              <div className="run-panel__debug-item" key={column.step}>
                <span className="run-panel__debug-label">Column {column.step + 1}</span>
                <strong className="run-panel__debug-value">
                  {column.gates.map((gate) => gate.type).join(' + ') || 'Idle'}
                </strong>
              </div>
            ))}
            {run.compilation.source_map.map((entry, index) => (
              <div
                className="run-panel__debug-item"
                key={`${entry.logical_column}-${entry.source_gate}-${index}`}
              >
                <span className="run-panel__debug-label">
                  {entry.source_gate} / logical column {entry.logical_column + 1}
                </span>
                <strong className="run-panel__debug-value">
                  {entry.compiled_operations.map(formatCompiledOperation).join(' → ')}
                </strong>
              </div>
            ))}
          </div>
        </ResultDrawer>
      ) : null}

      <div className="run-panel__actions">
        <button
          className="run-panel__button run-panel__button--secondary"
          type="button"
          onClick={onReloadApiExample}
          disabled={isRequestPending}
        >
          API サンプルを再読み込み
        </button>
        <button
          className="run-panel__button"
          type="button"
          onClick={onRunSimulation}
          disabled={!canRun || isRequestPending}
        >
          {isRequestPending ? '実行中…' : 'シミュレーションを実行'}
        </button>
      </div>

      <RunCostNotice estimate={costEstimate} />

      <div className="run-panel__debug">
        <ResultDrawer
          eyebrow="API デバッグ"
          title="リクエストのスナップショット"
          icon="terminal"
          description="最新のリクエストに関する低レベルの取得メタデータです。"
          defaultOpen={false}
        >
          <div className="run-panel__debug-grid">
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">前回の取得結果</span>
              <strong className="run-panel__debug-value">{lastFetchResult}</strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">前回の取得 URL</span>
              <strong className="run-panel__debug-value">
                {lastFetchUrl || '未リクエスト'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">前回の取得開始</span>
              <strong className="run-panel__debug-value">
                {lastFetchStartedAt || '未開始'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">フロントエンド実行開始</span>
              <strong className="run-panel__debug-value">
                {frontendRunStartedAt || '未開始'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">フロントエンド実行終了</span>
              <strong className="run-panel__debug-value">
                {frontendRunFinishedAt || '未終了'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">フロントエンド実行時間</span>
              <strong className="run-panel__debug-value">
                {formatElapsedMs(frontendRunElapsedMs)}
              </strong>
            </div>
            <div className="run-panel__debug-item">
                <span className="run-panel__debug-label">フロントエンドのタイムアウト</span>
              <strong className="run-panel__debug-value">
                {frontendRunTimeoutMs === null ? '利用できません' : `${frontendRunTimeoutMs} ms`}
              </strong>
            </div>
          </div>
        </ResultDrawer>
      </div>
    </section>
  )
}
