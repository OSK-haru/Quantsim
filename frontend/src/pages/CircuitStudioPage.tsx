import './CircuitStudioPage.css'
import { useState } from 'react'
import { CircuitWorkspace } from '../components/CircuitWorkspace'
import type { CircuitEditorState } from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import { useCircuitContext } from '../context/useCircuitContext'
import { circuitEditorStateToConfig } from '../utils/circuitConfig'
import { validateCircuitConfigForRun } from '../utils/circuitValidation'

type CircuitStudioPageProps = {
  gateDurationDefaults: GateDurationDefaults
  onOpenSimulation: () => void
  onOpenStateExplorer: () => void
  onOpenHelp: () => void
}

function getCircuitCounts(circuit: CircuitEditorState) {
  return circuit.columns.reduce(
    (summary, column) => {
      for (const gate of column.gates) {
        summary.gates += 1
        if (gate.type === 'CNOT') {
          summary.cnots += 1
        }
      }
      return summary
    },
    {
      gates: 0,
      cnots: 0,
    },
  )
}

function formatStudioValidationMessage(message: string | null) {
  if (!message) {
    return '回路の検証に失敗しました。'
  }

  return message
    .replace('This circuit was not simulated. ', '回路の検証に失敗しました。')
    .replace(' The previous result is still shown.', '')
}

export function CircuitStudioPage({
  gateDurationDefaults,
  onOpenSimulation,
  onOpenStateExplorer,
  onOpenHelp,
}: CircuitStudioPageProps) {
  const circuit = useCircuitContext()
  const [validationStatus, setValidationStatus] = useState<string | null>(null)
  const counts = getCircuitCounts(circuit.circuitState)

  function handleValidateCircuit() {
    const validation = validateCircuitConfigForRun(
      circuitEditorStateToConfig(circuit.circuitState),
    )
    setValidationStatus(
      validation.valid
        ? '検証に成功しました'
        : formatStudioValidationMessage(validation.message),
    )
  }

  return (
    <main className="circuit-studio-page">
      <header className="circuit-studio-page__header">
        <div>
          <div className="circuit-studio-page__eyebrow">QuantaScope / Gate-aware</div>
          <h1>Gate-aware 回路スタジオ</h1>
          <p className="circuit-studio-page__lede">
            Gate-aware シミュレーションで使用する回路を編集します。Pulse
            Labの単一パルスモデルには接続されていません。
          </p>
        </div>
        <div className="circuit-studio-page__header-panel">
          <div className="circuit-studio-page__summary" aria-label="回路の概要">
            <span>量子ビット {circuit.circuitState.logical_qubits}</span>
            <span>列 {circuit.circuitState.columns.length}</span>
            <span>ゲート {counts.gates}</span>
            <span>CNOT {counts.cnots}</span>
          </div>
          <div className="circuit-studio-page__header-actions" aria-label="ナビゲーション">
            <button className="circuit-studio-page__nav" type="button" onClick={onOpenStateExplorer}>
              Gate-aware 状態エクスプローラー
            </button>
            <button className="circuit-studio-page__nav" type="button" onClick={onOpenHelp}>
              ヘルプ
            </button>
          </div>
        </div>
      </header>

      <div className="circuit-studio-page__stack">
        <CircuitWorkspace
          circuit={circuit.circuitState}
          gateDurationDefaults={gateDurationDefaults}
          selectedGateType={circuit.selectedGateType}
          selectedGateId={circuit.selectedGateId}
          pendingCnotControl={circuit.pendingCnotControl}
          dragPayload={circuit.dragPayload}
          editorHint={circuit.editorHint}
          canUndo={circuit.canUndoCircuit}
          canRedo={circuit.canRedoCircuit}
          canDeleteSelected={circuit.canDeleteSelected}
          canClearCircuit={circuit.canClearCircuit}
          canRemoveLastColumn={circuit.canRemoveLastCircuitColumn}
          onSelectGateType={circuit.handleSelectGateType}
          onSelectLogicalQubits={circuit.handleLogicalQubitsChange}
          onResetToBell={circuit.handleResetCircuitToBell}
          onUndo={circuit.handleUndoCircuit}
          onRedo={circuit.handleRedoCircuit}
          onDeleteSelected={circuit.handleDeleteSelectedGate}
          onClearCircuit={circuit.handleClearCircuit}
          onAddColumn={circuit.handleAddCircuitColumn}
          onRemoveLastColumn={circuit.handleRemoveLastCircuitColumn}
          onGateDragStart={circuit.handlePaletteGateDragStart}
          onGateDragEnd={circuit.handleGateDragEnd}
          onSlotClick={circuit.handleCircuitSlotClick}
          onGateSelect={circuit.handleGateSelect}
          onCircuitGateDragStart={circuit.handleCircuitGateDragStart}
          onDragEnd={circuit.handleGateDragEnd}
          onSlotDrop={circuit.handleCircuitSlotDrop}
          onImportCircuitConfig={circuit.handleImportCircuitConfig}
          onValidateCircuit={handleValidateCircuit}
          onOpenSimulation={onOpenSimulation}
          validationStatus={validationStatus}
        />
      </div>
    </main>
  )
}
