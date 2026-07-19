import { useRef, useState, type ChangeEvent } from 'react'
import './CircuitWorkspace.css'
import { CircuitColumnNavigator } from './CircuitColumnNavigator'
import { CircuitConfigPreview } from './CircuitConfigPreview'
import { CircuitPreview } from './CircuitPreview'
import { CircuitZoomControls } from './CircuitZoomControls'
import { GateInspector } from './GateInspector'
import { GatePalette } from './GatePalette'
import type { CircuitEditorState, CircuitGate, DragGatePayload, GateType } from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import { useCircuitViewport } from '../hooks/useCircuitViewport'
import { exportCircuitConfigBundleJson } from '../utils/circuitConfigTransfer'

type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
}

type CircuitWorkspaceProps = {
  circuit: CircuitEditorState
  gateDurationDefaults: GateDurationDefaults
  selectedGateType: GateType | null
  selectedGateId: string | null
  pendingCnotControl: PendingCnotControl | null
  dragPayload: DragGatePayload | null
  editorHint: string
  canUndo: boolean
  canRedo: boolean
  canDeleteSelected: boolean
  canClearCircuit: boolean
  canRemoveLastColumn: boolean
  onSelectGateType: (gateType: GateType | null) => void
  onSelectLogicalQubits: (logicalQubits: number) => void
  onResetToBell: () => void
  onUndo: () => void
  onRedo: () => void
  onDeleteSelected: () => void
  onClearCircuit: () => void
  onAddColumn: () => void
  onRemoveLastColumn: () => void
  onGateDragStart: (gateType: GateType) => void
  onGateDragEnd: () => void
  onSlotClick: (columnIndex: number, qubitIndex: number) => void
  onGateSelect: (gateId: string | null) => void
  onCircuitGateDragStart: (
    gateId: string,
    gateType: GateType,
    columnIndex: number,
    qubitIndex: number,
  ) => void
  onDragEnd: () => void
  onSlotDrop: (columnIndex: number, qubitIndex: number) => void
  onImportCircuitConfig: (file: File) => Promise<string>
  onValidateCircuit: () => void
  onOpenSimulation: () => void
  validationStatus?: string | null
}

type SelectedGateInfo = {
  gate: CircuitGate
  columnIndex: number
} | null

function getSelectedGateInfo(circuit: CircuitEditorState, selectedGateId: string | null): SelectedGateInfo {
  if (!selectedGateId) {
    return null
  }

  for (const [columnIndex, column] of circuit.columns.entries()) {
    const gate = column.gates.find((candidate) => candidate.id === selectedGateId)
    if (gate) {
      return { gate, columnIndex }
    }
  }

  return null
}

function formatGateLocation(gate: CircuitGate) {
  const targetLabel = gate.targets.map((target) => `q${target}`).join(', ')
  const controlLabel = gate.controls?.map((control) => `q${control}`).join(', ')

  if (gate.type === 'CNOT' && controlLabel) {
    return `${controlLabel} -> ${targetLabel}`
  }

  return targetLabel
}

function getGateDuration(gate: CircuitGate, gateDurationDefaults: GateDurationDefaults) {
  return gate.params?.duration_us ?? gateDurationDefaults[gate.type]
}

function formatDurationLabel(duration: number) {
  const fixed = duration < 0.01 && duration > 0 ? duration.toFixed(3) : duration.toFixed(2)
  return `${fixed.replace(/\.?0+$/, '')} us`
}

function getWorkspaceStatus({
  circuit,
  gateDurationDefaults,
  selectedGateType,
  selectedGateId,
  pendingCnotControl,
  dragPayload,
  editorHint,
}: Pick<
  CircuitWorkspaceProps,
  | 'circuit'
  | 'gateDurationDefaults'
  | 'selectedGateType'
  | 'selectedGateId'
  | 'pendingCnotControl'
  | 'dragPayload'
  | 'editorHint'
>) {
  if (dragPayload) {
    return dragPayload.source === 'circuit'
      ? `Dragging ${dragPayload.gateType}`
      : `Dragging ${dragPayload.gateType} from palette`
  }

  if (selectedGateType === 'CNOT' && pendingCnotControl) {
    return `Select CNOT target from q${pendingCnotControl.qubitIndex}`
  }

  const selectedGate = getSelectedGateInfo(circuit, selectedGateId)
  if (selectedGate) {
    const duration = formatDurationLabel(getGateDuration(selectedGate.gate, gateDurationDefaults))
    return `Gate selected: ${selectedGate.gate.type} ${formatGateLocation(selectedGate.gate)}, ${duration}`
  }

  if (selectedGateType) {
    return `Placing ${selectedGateType}`
  }

  return editorHint === 'Ready to edit the circuit.' ? 'Circuit ready' : editorHint || 'Circuit ready'
}

export function CircuitWorkspace({
  circuit,
  gateDurationDefaults,
  selectedGateType,
  selectedGateId,
  pendingCnotControl,
  dragPayload,
  editorHint,
  canUndo,
  canRedo,
  canDeleteSelected,
  canClearCircuit,
  canRemoveLastColumn,
  onSelectGateType,
  onSelectLogicalQubits,
  onResetToBell,
  onUndo,
  onRedo,
  onDeleteSelected,
  onClearCircuit,
  onAddColumn,
  onRemoveLastColumn,
  onGateDragStart,
  onGateDragEnd,
  onSlotClick,
  onGateSelect,
  onCircuitGateDragStart,
  onDragEnd,
  onSlotDrop,
  onImportCircuitConfig,
  onValidateCircuit,
  onOpenSimulation,
  validationStatus = null,
}: CircuitWorkspaceProps) {
  const [scrollToEndToken, setScrollToEndToken] = useState(0)
  const [showConfigPreview, setShowConfigPreview] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [transferStatus, setTransferStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectedGateInfo = getSelectedGateInfo(circuit, selectedGateId)
  const viewport = useCircuitViewport({
    columnCount: circuit.columns.length,
    selectedColumnIndex: selectedGateInfo?.columnIndex ?? null,
  })

  const statusText = getWorkspaceStatus({
    circuit,
    gateDurationDefaults,
    selectedGateType,
    selectedGateId,
    pendingCnotControl,
    dragPayload,
    editorHint,
  })

  function handleAddColumn() {
    setScrollToEndToken((token) => token + 1)
    onAddColumn()
  }

  function handleExportJson() {
    const json = exportCircuitConfigBundleJson(circuit)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'quantscope-circuit.qscope.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
    setTransferStatus('Exported circuit JSON.')
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const message = await onImportCircuitConfig(file)
      setTransferStatus(message)
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : 'Import failed.')
    }
  }

  return (
    <section className="circuit-workspace" aria-label="Circuit workspace">
      <div className="circuit-workspace__toolbar" aria-label="Circuit editing toolbar">
        <div className="circuit-workspace__tool-group" role="group" aria-label="History">
          <span className="circuit-workspace__tool-label">History</span>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="Edit actions">
          <span className="circuit-workspace__tool-label">Edit</span>
          <button
            className="circuit-workspace__toolbar-danger"
            type="button"
            onClick={onDeleteSelected}
            disabled={!canDeleteSelected}
          >
            Delete selected
          </button>
          <button
            className="circuit-workspace__toolbar-danger"
            type="button"
            onClick={onClearCircuit}
            disabled={!canClearCircuit}
          >
            Clear
          </button>
          <button type="button" onClick={onResetToBell}>
            Reset to Bell
          </button>
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="Columns">
          <span className="circuit-workspace__tool-label">Columns</span>
          <button type="button" onClick={onRemoveLastColumn} disabled={!canRemoveLastColumn}>
            - Column
          </button>
          <span className="circuit-workspace__column-count">{circuit.columns.length} columns</span>
          <button type="button" onClick={handleAddColumn}>
            + Column
          </button>
        </div>

        <CircuitZoomControls
          zoom={viewport.zoom}
          onZoomOut={viewport.zoomOut}
          onZoomIn={viewport.zoomIn}
          onResetZoom={viewport.resetZoom}
          onFitCircuit={viewport.fitCircuit}
        />

        <CircuitColumnNavigator
          columnCount={circuit.columns.length}
          visibleRange={viewport.visibleRange}
          onJumpToColumn={(columnIndex) => viewport.scrollToColumn(columnIndex, { highlight: true })}
          onFirst={viewport.goFirst}
          onPreviousGroup={viewport.goPreviousGroup}
          onNextGroup={viewport.goNextGroup}
          onLast={viewport.goLast}
        />

        <div className="circuit-workspace__tool-group" role="group" aria-label="Files">
          <span className="circuit-workspace__tool-label">Files</span>
          <button type="button" onClick={openFilePicker}>
            Import
          </button>
          <button type="button" onClick={handleExportJson}>
            Export
          </button>
          <button
            type="button"
            aria-pressed={showConfigPreview}
            onClick={() => setShowConfigPreview((isOpen) => !isOpen)}
          >
            {showConfigPreview ? 'Hide JSON' : 'Preview JSON'}
          </button>
          <input
            ref={fileInputRef}
            className="circuit-workspace__file-input"
            type="file"
            accept=".json,.qscope.json,application/json"
            aria-label="Import circuit configuration JSON"
            onChange={handleFileChange}
          />
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="Actions">
          <span className="circuit-workspace__tool-label">Actions</span>
          <button type="button" onClick={onValidateCircuit}>
            Validate
          </button>
          <button type="button" onClick={onOpenSimulation}>
            Simulation Lab
          </button>
          <button
            type="button"
            aria-pressed={showInspector}
            disabled={!selectedGateId}
            onClick={() => setShowInspector((isOpen) => !isOpen)}
          >
            {showInspector ? 'Hide inspector' : 'Inspector'}
          </button>
        </div>
      </div>

      <div className="circuit-workspace__body">
        <GatePalette
          selectedGateType={selectedGateType}
          logicalQubits={circuit.logical_qubits}
          onSelectGateType={onSelectGateType}
          onSelectLogicalQubits={onSelectLogicalQubits}
          onGateDragStart={onGateDragStart}
          onGateDragEnd={onGateDragEnd}
        />
        <CircuitPreview
          circuit={circuit}
          gateDurationDefaults={gateDurationDefaults}
          selectedGateType={selectedGateType}
          selectedGateId={selectedGateId}
          pendingCnotControl={pendingCnotControl}
          dragPayload={dragPayload}
          zoom={viewport.zoom}
          scrollToEndToken={scrollToEndToken}
          viewportRef={viewport.viewportRef}
          highlightedColumnIndex={viewport.highlightedColumnIndex}
          onViewportScroll={viewport.updateVisibleRange}
          onSlotClick={onSlotClick}
          onGateSelect={onGateSelect}
          onCircuitGateDragStart={onCircuitGateDragStart}
          onDragEnd={onDragEnd}
          onSlotDrop={onSlotDrop}
        />
      </div>

      {showInspector && selectedGateId ? (
        <GateInspector
          circuit={circuit}
          selectedGateId={selectedGateId}
          gateDurationDefaults={gateDurationDefaults}
          onDeleteSelected={onDeleteSelected}
          onReveal={viewport.revealSelectedColumn}
        />
      ) : null}

      <div className="circuit-workspace__status-row">
        <div className="circuit-workspace__status-block" aria-live="polite">
          <p className="circuit-workspace__status">{validationStatus ?? statusText}</p>
          {validationStatus ? (
            <p className="circuit-workspace__status-secondary">{statusText}</p>
          ) : null}
        </div>
        <p className="circuit-workspace__shortcut-hints">
          Delete: remove selected | F: fit | Home/End: first/last
        </p>
        <p className="circuit-workspace__transfer-status" aria-live="polite">
          {transferStatus || ' '}
        </p>
      </div>

      {showConfigPreview ? (
        <CircuitConfigPreview
          circuit={circuit}
          onImportCircuitConfig={onImportCircuitConfig}
          defaultOpen
          showTransferActions={false}
        />
      ) : null}
    </section>
  )
}
