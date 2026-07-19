import './RunPanel.css'
import { ResultDrawer } from './ResultDrawer'
import { SectionHeader } from './SectionHeader'
import { RunCostNotice } from './RunCostNotice'
import type { RunPanelData, SimulationLoadStatus } from '../types/simulation'
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
  onReloadApiExample: () => void
  onRunSimulation: () => void
}

function formatElapsedMs(value: number | null) {
  if (value === null) {
    return 'not available'
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
  onReloadApiExample,
  onRunSimulation,
}: RunPanelProps) {
  const canRun = run.can_run ?? true
  const isRequestPending = loadStatus === 'loading'

  return (
    <section className="run-panel" aria-label="Run simulation" data-load-status={loadStatus}>
      <div className="run-panel__header">
        <SectionHeader icon="terminal" eyebrow="Execution" title="Run simulation" />
        <div className="run-panel__meta">
          <p className="run-panel__status">Load status: {loadStatus}</p>
          <p className="run-panel__source">Connection: {connectionLabel}</p>
          <p className="run-panel__source">Data source: {dataSourceLabel}</p>
          {errorMessage ? (
            <p className="run-panel__error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>

      <div className="run-panel__rows">
        <div className="run-panel__row">
          <span className="run-panel__label">Status</span>
          <strong className="run-panel__value">{run.status}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">Backend</span>
          <strong className="run-panel__value">{run.selected_backend}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">Last run</span>
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
          Reload API example
        </button>
        <button
          className="run-panel__button"
          type="button"
          onClick={onRunSimulation}
          disabled={!canRun || isRequestPending}
        >
          Run simulation
        </button>
      </div>

      <RunCostNotice estimate={costEstimate} />

      <div className="run-panel__debug">
        <ResultDrawer
          eyebrow="API debug"
          title="Request snapshot"
          icon="terminal"
          description="Low-level fetch metadata for the latest request."
          defaultOpen={false}
        >
          <div className="run-panel__debug-grid">
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Last fetch result</span>
              <strong className="run-panel__debug-value">{lastFetchResult}</strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Last fetch URL</span>
              <strong className="run-panel__debug-value">
                {lastFetchUrl || 'not requested yet'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Last fetch started</span>
              <strong className="run-panel__debug-value">
                {lastFetchStartedAt || 'not started yet'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Frontend run started</span>
              <strong className="run-panel__debug-value">
                {frontendRunStartedAt || 'not started yet'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Frontend run finished</span>
              <strong className="run-panel__debug-value">
                {frontendRunFinishedAt || 'not finished yet'}
              </strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Frontend run elapsed</span>
              <strong className="run-panel__debug-value">
                {formatElapsedMs(frontendRunElapsedMs)}
              </strong>
            </div>
            <div className="run-panel__debug-item">
              <span className="run-panel__debug-label">Frontend timeout</span>
              <strong className="run-panel__debug-value">
                {frontendRunTimeoutMs === null ? 'not available' : `${frontendRunTimeoutMs} ms`}
              </strong>
            </div>
          </div>
        </ResultDrawer>
      </div>
    </section>
  )
}
