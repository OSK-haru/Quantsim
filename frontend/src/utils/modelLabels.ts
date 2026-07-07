export type ModelLabelStatus = 'current' | 'default' | 'preview' | 'planned'

export type ModelLabelInfo = {
  id: string
  label: string
  description: string
  status: ModelLabelStatus
  statusLabel: string
}

export const MODEL_IDS = {
  simulationModel: 'gate_aware_open_system',
  evolutionMode: 'gate_aware_hamiltonian_lindblad_v1',
  defaultBackend: 'python_dense',
  previewBackend: 'rust_dense_preview',
  plannedMode: 'gate_aware_cptp_kraus',
} as const

export const modelLabels: Record<string, ModelLabelInfo> = {
  [MODEL_IDS.simulationModel]: {
    id: MODEL_IDS.simulationModel,
    label: 'Gate-aware open system',
    description:
      'The circuit is evolved as an open quantum system rather than as ideal instantaneous gates.',
    status: 'current',
    statusLabel: 'Current model',
  },
  [MODEL_IDS.evolutionMode]: {
    id: MODEL_IDS.evolutionMode,
    label: 'Gate-aware Hamiltonian Lindblad v1',
    description:
      'Each gate column is represented by an effective Hamiltonian while Lindblad noise acts during the operation.',
    status: 'current',
    statusLabel: 'Current evolution',
  },
  [MODEL_IDS.defaultBackend]: {
    id: MODEL_IDS.defaultBackend,
    label: 'Python dense backend',
    description:
      'Default reference backend for small dense density-matrix simulations.',
    status: 'default',
    statusLabel: 'Default backend',
  },
  [MODEL_IDS.previewBackend]: {
    id: MODEL_IDS.previewBackend,
    label: 'Rust dense preview',
    description:
      'Optional preview acceleration path. It should not be presented as the default validated backend.',
    status: 'preview',
    statusLabel: 'Preview backend',
  },
  [MODEL_IDS.plannedMode]: {
    id: MODEL_IDS.plannedMode,
    label: 'CPTP Kraus evolution',
    description:
      'Planned future mode. Not implemented in the current simulation path.',
    status: 'planned',
    statusLabel: 'Planned mode',
  },
}

export function getModelLabel(id: string): ModelLabelInfo {
  return (
    modelLabels[id] ?? {
      id,
      label: id,
      description: 'No frontend label has been registered for this internal ID yet.',
      status: 'current',
      statusLabel: 'Internal ID',
    }
  )
}

export function modelStatusText(id: string) {
  const info = getModelLabel(id)
  return info.status === 'planned' ? `${info.label} (not available yet)` : info.label
}
