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
    label: 'ゲートを考慮した開放系',
    description:
      '理想的な瞬時ゲートではなく、開放量子系として回路を発展させます。',
    status: 'current',
    statusLabel: '現在のモデル',
  },
  [MODEL_IDS.evolutionMode]: {
    id: MODEL_IDS.evolutionMode,
    label: 'ゲートを考慮したハミルトニアン Lindblad v1',
    description:
      '各ゲート列を有効ハミルトニアンで表現し、操作中に Lindblad ノイズを作用させます。',
    status: 'current',
    statusLabel: '現在の発展方式',
  },
  [MODEL_IDS.defaultBackend]: {
    id: MODEL_IDS.defaultBackend,
    label: 'Python 密行列バックエンド',
    description:
      '小規模な密度行列シミュレーション用の標準参照バックエンドです。',
    status: 'default',
    statusLabel: 'デフォルトバックエンド',
  },
  [MODEL_IDS.previewBackend]: {
    id: MODEL_IDS.previewBackend,
    label: 'Rust 密行列プレビュー',
    description:
      '任意で使用できる高速化プレビュー経路です。検証済みの標準バックエンドではありません。',
    status: 'preview',
    statusLabel: 'プレビューバックエンド',
  },
  [MODEL_IDS.plannedMode]: {
    id: MODEL_IDS.plannedMode,
    label: 'CPTP Kraus 発展',
    description:
      '将来対応予定のモードです。現在のシミュレーション経路には未実装です。',
    status: 'planned',
    statusLabel: '計画中のモード',
  },
}

export function getModelLabel(id: string): ModelLabelInfo {
  return (
    modelLabels[id] ?? {
      id,
      label: id,
      description: 'この内部 ID に対応する表示名はまだ登録されていません。',
      status: 'current',
      statusLabel: '内部 ID',
    }
  )
}

export function modelStatusText(id: string) {
  const info = getModelLabel(id)
  return info.status === 'planned' ? `${info.label}（未提供）` : info.label
}
