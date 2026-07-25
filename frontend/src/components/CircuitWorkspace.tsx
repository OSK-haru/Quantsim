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
      ? `${dragPayload.gateType} をドラッグ中`
      : `パレットから ${dragPayload.gateType} をドラッグ中`
  }

  if (selectedGateType === 'CNOT' && pendingCnotControl) {
    return `q${pendingCnotControl.qubitIndex} の CNOT 対象を選択してください`
  }

  const selectedGate = getSelectedGateInfo(circuit, selectedGateId)
  if (selectedGate) {
    const duration = formatDurationLabel(getGateDuration(selectedGate.gate, gateDurationDefaults))
    return `ゲートを選択中: ${selectedGate.gate.type} ${formatGateLocation(selectedGate.gate)}、${duration}`
  }

  if (selectedGateType) {
    return `${selectedGateType} を配置中`
  }

  return editorHint === 'Ready to edit the circuit.' ? '回路を編集できます' : editorHint || '回路を編集できます'
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
    setTransferStatus('回路 JSON をエクスポートしました。')
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
      setTransferStatus(error instanceof Error ? error.message : 'インポートに失敗しました。')
    }
  }

  return (
    <section className="circuit-workspace" aria-label="回路編集ワークスペース">
      <div className="circuit-workspace__toolbar" aria-label="回路編集ツールバー">
        <div className="circuit-workspace__tool-group" role="group" aria-label="履歴">
          <span className="circuit-workspace__tool-label">履歴</span>
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            元に戻す
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            やり直す
          </button>
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="編集操作">
          <span className="circuit-workspace__tool-label">編集</span>
          <button
            className="circuit-workspace__toolbar-danger"
            type="button"
            onClick={onDeleteSelected}
            disabled={!canDeleteSelected}
          >
            選択項目を削除
          </button>
          <button
            className="circuit-workspace__toolbar-danger"
            type="button"
            onClick={onClearCircuit}
            disabled={!canClearCircuit}
          >
            クリア
          </button>
          <button type="button" onClick={onResetToBell}>
            Bell 状態にリセット
          </button>
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="列">
          <span className="circuit-workspace__tool-label">列</span>
          <button type="button" onClick={onRemoveLastColumn} disabled={!canRemoveLastColumn}>
            - 列
          </button>
          <span className="circuit-workspace__column-count">列 {circuit.columns.length}</span>
          <button type="button" onClick={handleAddColumn}>
            + 列
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

        <div className="circuit-workspace__tool-group" role="group" aria-label="ファイル">
          <span className="circuit-workspace__tool-label">ファイル</span>
          <button type="button" onClick={openFilePicker}>
            インポート
          </button>
          <button type="button" onClick={handleExportJson}>
            エクスポート
          </button>
          <button
            type="button"
            aria-pressed={showConfigPreview}
            onClick={() => setShowConfigPreview((isOpen) => !isOpen)}
          >
            {showConfigPreview ? 'JSON を隠す' : 'JSON をプレビュー'}
          </button>
          <input
            ref={fileInputRef}
            className="circuit-workspace__file-input"
            type="file"
            accept=".json,.qscope.json,application/json"
            aria-label="回路設定 JSON をインポート"
            onChange={handleFileChange}
          />
        </div>

        <div className="circuit-workspace__tool-group" role="group" aria-label="操作">
          <span className="circuit-workspace__tool-label">操作</span>
          <button type="button" onClick={onValidateCircuit}>
            検証
          </button>
          <button type="button" onClick={onOpenSimulation}>
            シミュレーションラボ
          </button>
          <button
            type="button"
            aria-pressed={showInspector}
            disabled={!selectedGateId}
            onClick={() => setShowInspector((isOpen) => !isOpen)}
          >
            {showInspector ? 'インスペクターを隠す' : 'インスペクター'}
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
          Delete: 選択項目を削除 | F: 回路に合わせる | Home/End: 最初/最後
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
