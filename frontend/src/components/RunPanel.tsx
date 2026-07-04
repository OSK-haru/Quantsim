import './RunPanel.css'
import type { RunPanelData, SimulationLoadStatus } from '../types/simulation'

type RunPanelProps = {
  run: RunPanelData
  connectionLabel: string
  dataSourceLabel: string
  loadStatus: SimulationLoadStatus
  errorMessage: string | null
  lastFetchResult: string
  lastFetchUrl: string
  lastFetchStartedAt: string
  onReloadApiExample: () => void
  onRunSimulation: () => void
}

export function RunPanel({
  run,
  connectionLabel,
  dataSourceLabel,
  loadStatus,
  errorMessage,
  lastFetchResult,
  lastFetchUrl,
  lastFetchStartedAt,
  onReloadApiExample,
  onRunSimulation,
}: RunPanelProps) {
  const canRun = run.can_run ?? true
  const isRequestPending = loadStatus === 'loading'

  return (
    <section className="run-panel" aria-label="Run simulation" data-load-status={loadStatus}>
      <div className="run-panel__header">
        <div>
          <div className="run-panel__eyebrow">Execution</div>
          <h2 className="run-panel__title">Run simulation</h2>
        </div>
        <div className="run-panel__meta">
          <p className="run-panel__status">Load status: {loadStatus}</p>
          <p className="run-panel__source">Connection: {connectionLabel}</p>
          <p className="run-panel__source">Data source: {dataSourceLabel}</p>
          {errorMessage ? <p className="run-panel__error">{errorMessage}</p> : null}
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
        <div className="run-panel__row">
          <span className="run-panel__label">Last fetch result</span>
          <strong className="run-panel__value">{lastFetchResult}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">Last fetch URL</span>
          <strong className="run-panel__value">{lastFetchUrl || 'not requested yet'}</strong>
        </div>
        <div className="run-panel__row">
          <span className="run-panel__label">Last fetch started</span>
          <strong className="run-panel__value">{lastFetchStartedAt || 'not started yet'}</strong>
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
    </section>
  )
}
