import './ModelInfoPanel.css'
import { ResultDrawer } from './ResultDrawer'
import { MODEL_IDS, getModelLabel } from '../utils/modelLabels'

type ModelInfoPanelProps = {
  simulationModelId: string
  evolutionModeId: string
  defaultBackendId?: string
  previewBackendId?: string
  plannedModeId?: string
}

type ModelInfoRowProps = {
  title: string
  id: string
}

function ModelInfoRow({ title, id }: ModelInfoRowProps) {
  const info = getModelLabel(id)

  return (
    <div className="model-info-panel__row">
      <div className="model-info-panel__row-heading">
        <span className="model-info-panel__row-title">{title}</span>
        <span
          className={`model-info-panel__status model-info-panel__status--${info.status}`}
        >
          {info.statusLabel}
        </span>
      </div>
      <strong className="model-info-panel__label">{info.label}</strong>
      <span className="model-info-panel__id">{info.id}</span>
      <p className="model-info-panel__description">{info.description}</p>
    </div>
  )
}

export function ModelInfoPanel({
  simulationModelId,
  evolutionModeId,
  defaultBackendId = MODEL_IDS.defaultBackend,
  previewBackendId = MODEL_IDS.previewBackend,
  plannedModeId = MODEL_IDS.plannedMode,
}: ModelInfoPanelProps) {
  return (
    <ResultDrawer
      eyebrow="Physics model"
      title="Computation method"
      description="Canonical labels for the model, backend, and planned modes."
      defaultOpen={false}
    >
      <div className="model-info-panel">
        <ModelInfoRow title="Simulation model" id={simulationModelId} />
        <ModelInfoRow title="Evolution mode" id={evolutionModeId} />
        <ModelInfoRow title="Default backend" id={defaultBackendId} />
        <ModelInfoRow title="Preview backend" id={previewBackendId} />
        <ModelInfoRow title="Planned mode" id={plannedModeId} />
      </div>

      <p className="model-info-panel__note">
        Current runs use the gate-aware Hamiltonian Lindblad path. Planned modes
        are shown for orientation only and are not available through the current
        simulation API.
      </p>
    </ResultDrawer>
  )
}
