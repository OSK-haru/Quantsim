import './RunCostNotice.css'
import { SectionIcon } from './SectionIcon'
import type { SimulationCostEstimate } from '../utils/simulationCost'

type RunCostNoticeProps = {
  estimate: SimulationCostEstimate
}

export function RunCostNotice({ estimate }: RunCostNoticeProps) {
  return (
    <div className="run-cost-notice" data-level={estimate.level} role="status" aria-live="polite">
      <SectionIcon name={estimate.level === 'low' ? 'clock' : 'warning'} />
      <div className="run-cost-notice__copy">
        <div className="run-cost-notice__eyebrow">Run cost</div>
        <div className="run-cost-notice__title">{estimate.label}</div>
        <p className="run-cost-notice__message">{estimate.message}</p>
        {estimate.suggestion ? (
          <p className="run-cost-notice__suggestion">{estimate.suggestion}</p>
        ) : null}
      </div>
    </div>
  )
}
