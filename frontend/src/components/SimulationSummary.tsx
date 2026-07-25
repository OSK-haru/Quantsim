import './SimulationSummary.css'
import { SectionHeader } from './SectionHeader'
import type { SimulationSummaryData } from '../types/simulation'

type SimulationSummaryProps = {
  summary: SimulationSummaryData
}

function formatMetric(value: number) {
  return value.toFixed(12)
}

function formatOptionalMetric(value: number | null) {
  if (value === null) {
    return '利用できません'
  }
  return formatMetric(value)
}

function formatTime(value: number | null) {
  if (value === null) {
    return '利用できません'
  }

  return `${value.toFixed(3)} us`
}

export function SimulationSummary({ summary }: SimulationSummaryProps) {
  return (
    <section className="simulation-summary" aria-label="シミュレーション結果の概要">
      <div className="simulation-summary__header">
        <SectionHeader
          icon="gauge"
          eyebrow="結果の概要"
          title="シミュレーション結果のスナップショット"
        />
      </div>

      <div className="simulation-summary__metrics">
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">最終忠実度</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.final_fidelity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">最終純度</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.final_purity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">完了時の忠実度</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.completion_fidelity)}</strong>
        </article>
        <article className="simulation-summary__metric">
          <span className="simulation-summary__label">完了時の純度</span>
          <strong className="simulation-summary__value">{formatOptionalMetric(summary.completion_purity)}</strong>
        </article>
        <article className="simulation-summary__metric simulation-summary__metric--full">
          <span className="simulation-summary__label">有効時間</span>
          <strong className="simulation-summary__value">{formatTime(summary.effective_time_us)}</strong>
        </article>
      </div>
    </section>
  )
}
