import { createContext } from 'react'
import type { CircuitEditorState, DragGatePayload, GateType } from '../types/circuit'
import type { CircuitConfig } from '../utils/circuitConfigTransfer'

export type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
  controlValue?: 0 | 1
  additionalQubits?: number[]
  additionalControlValues?: Array<0 | 1>
}

export type CircuitPresetKey = 'teleportation' | 'bit_flip_repetition' | 'grover_2qubit' | 'grover_4qubit' | 'magic_state'

export type CircuitContextValue = {
  circuitState: CircuitEditorState
  selectedGateType: GateType | null
  selectedControlValue: 0 | 1 | null
  selectedGateId: string | null
  dragPayload: DragGatePayload | null
  pendingCnotControl: PendingCnotControl | null
  editorHint: string
  canUndoCircuit: boolean
  canRedoCircuit: boolean
  canDeleteSelected: boolean
  canClearCircuit: boolean
  canRemoveLastCircuitColumn: boolean
  handleSelectGateType: (gateType: GateType | null) => void
  handleSelectControlValue: (controlValue: 0 | 1 | null) => void
  handleControlMarkerDragStart: (controlValue: 0 | 1) => void
  handleGateSelect: (gateId: string | null) => void
  handleLoadCircuitPreset: (preset: CircuitPresetKey) => void
  handleLogicalQubitsChange: (nextLogicalQubits: number) => void
  handleCircuitSlotClick: (columnIndex: number, qubitIndex: number) => void
  handleDeleteSelectedGate: () => void
  handleUpdateSelectedGateTheta: (thetaRad: number) => void
  handleUpdateSelectedGateMarkedIndex: (markedIndex: number) => void
  handleReverseSelectedGateRegister: () => void
  handleClearCircuit: () => void
  handleAddCircuitColumn: () => void
  handleRemoveLastCircuitColumn: () => void
  handleUndoCircuit: () => void
  handleRedoCircuit: () => void
  handlePaletteGateDragStart: (gateType: GateType) => void
  handleCircuitGateDragStart: (
    gateId: string,
    gateType: GateType,
    fromColumn: number,
    fromQubit: number,
  ) => void
  handleGateDragEnd: () => void
  handleCircuitSlotDrop: (columnIndex: number, qubitIndex: number, insertColumn?: boolean) => void
  /** 列と列のあいだへのドロップ。新しい列を割り込ませてそこへ置く。 */
  handleCircuitColumnInsertDrop: (insertIndex: number, qubitIndex: number) => void
  handleDeleteGate: (gateId: string) => void
  handleDuplicateGate: (gateId: string) => void
  handleShiftGateColumn: (gateId: string, offset: -1 | 1) => void
  handleImportCircuitConfig: (file: File) => Promise<string>
  /**
   * 解析済みの CircuitConfig をそのままエディターへ載せる。
   *
   * 結果ファイルの読み込みで使う。結果に同梱された回路をエディターへ
   * 書き戻さないと、「画面の回路 = 図の条件」が成り立たず、復元した結果が
   * 古い結果として隠されてしまう。
   */
  handleReplaceCircuitConfig: (config: CircuitConfig) => void
}

export const CircuitContext = createContext<CircuitContextValue | null>(null)
