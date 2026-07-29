import './RunPanel.css'
import { ResultDrawer } from './ResultDrawer'
import { SectionHeader } from './SectionHeader'
import { RunCostNotice } from './RunCostNotice'
import type {
  GateAwareEvolutionMethod,
  RunPanelData,
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
  onEvolutionMethodChange: (method: GateAwareEvolutionMethod) => void
  onReloadApiExample: () => void
  onRunSimulation: () => void
}

function formatElapsedMs(value: number | null) {
  if (value === null) {
    return '利用できません'
  }
  return `${value.toFixed(1)} ms`
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
  onEvolutionMethodChange,
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

      <div className="run-panel__rows">
        <label className="run-panel__method">
          <span>
            <strong>Evolution method</strong>
            <small>
              Explicit CPTP audits each finite-time GKSL map and does not apply
              density-matrix cleanup.
            </small>
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
        <div className="run-panel__row">
          <span className="run-panel__label">状態</span>
          <strong className="run-panel__value">{run.status}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">バックエンド</span>
          <strong className="run-panel__value">{run.selected_backend}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">前回の実行</span>
          <strong className="run-panel__value">{run.last_run_label}</strong>
        </div>
      </div>

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
          シミュレーションを実行
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
