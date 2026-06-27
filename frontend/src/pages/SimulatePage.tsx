import './SimulatePage.css'
import { DiagnosticsCard, type SimulationDiagnostics } from '../components/DiagnosticsCard'
import { SimulationSummary } from '../components/SimulationSummary'
import type { MockSimulationResult } from '../types/simulation'

type StatusItem = {
  label: string
  value: string
}

type SimulatePageProps = {
  diagnostics: SimulationDiagnostics
  result: MockSimulationResult
  statusItems: StatusItem[]
  onBackToHome: () => void
}

export function SimulatePage({
  diagnostics,
  result,
  statusItems,
  onBackToHome,
}: SimulatePageProps) {
  return (
    <main className="simulate-page">
      <header className="simulate-page__header">
        <div>
          <div className="simulate-page__eyebrow">QuantaScope</div>
          <h1>Simulation workspace</h1>
          <p className="simulate-page__lede">
            Static mock data for the current backend snapshot and simulation result.
          </p>
        </div>
        <button className="simulate-page__back" type="button" onClick={onBackToHome}>
          Back to home
        </button>
      </header>

      <section className="simulate-page__status-grid" aria-label="Simulation status">
        {statusItems.map((item) => (
          <article className="simulate-page__status-card" key={item.label}>
            <span className="simulate-page__status-label">{item.label}</span>
            <strong className="simulate-page__status-value">{item.value}</strong>
          </article>
        ))}
      </section>

      <div className="simulate-page__stack">
        <DiagnosticsCard diagnostics={diagnostics} />
        <SimulationSummary result={result} />
      </div>
    </main>
  )
}
