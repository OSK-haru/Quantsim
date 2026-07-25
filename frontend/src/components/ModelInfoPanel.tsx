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
      eyebrow="物理モデル"
      title="計算方法"
      icon="atom"
      description="モデル、バックエンド、計画中のモードを示します。"
      defaultOpen={false}
    >
      <div className="model-info-panel">
        <ModelInfoRow title="シミュレーションモデル" id={simulationModelId} />
        <ModelInfoRow title="発展モード" id={evolutionModeId} />
        <ModelInfoRow title="デフォルトバックエンド" id={defaultBackendId} />
        <ModelInfoRow title="プレビューバックエンド" id={previewBackendId} />
        <ModelInfoRow title="計画中のモード" id={plannedModeId} />
      </div>

      <p className="model-info-panel__note">
        現在の実行では、ゲートを考慮したハミルトニアン Lindblad 経路を使用します。
        計画中のモードは参考情報として表示しているだけで、現在のシミュレーション API では利用できません。
      </p>
    </ResultDrawer>
  )
}
