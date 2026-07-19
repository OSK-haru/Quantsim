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
    return 'Circuit validation failed.'
  }

  return message
    .replace('This circuit was not simulated. ', 'Circuit validation failed. ')
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
        ? 'Validation passed'
        : formatStudioValidationMessage(validation.message),
    )
  }

  return (
    <main className="circuit-studio-page">
      <header className="circuit-studio-page__header">
        <div>
          <div className="circuit-studio-page__eyebrow">QuantaScope</div>
          <h1>Circuit Studio</h1>
          <p className="circuit-studio-page__lede">
            A dedicated editing surface for the circuit used by the Simulation Lab.
          </p>
        </div>
        <div className="circuit-studio-page__header-panel">
          <div className="circuit-studio-page__summary" aria-label="Circuit summary">
            <span>{circuit.circuitState.logical_qubits} qubits</span>
            <span>{circuit.circuitState.columns.length} columns</span>
            <span>{counts.gates} gates</span>
            <span>{counts.cnots} CNOTs</span>
          </div>
          <div className="circuit-studio-page__header-actions" aria-label="Navigation">
            <button className="circuit-studio-page__nav" type="button" onClick={onOpenStateExplorer}>
              State Explorer
            </button>
            <button className="circuit-studio-page__nav" type="button" onClick={onOpenHelp}>
              Help
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
