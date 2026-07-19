import { createContext } from 'react'
import type { CircuitEditorState, DragGatePayload, GateType } from '../types/circuit'

export type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
}

export type CircuitContextValue = {
  circuitState: CircuitEditorState
  selectedGateType: GateType | null
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
  handleGateSelect: (gateId: string | null) => void
  handleResetCircuitToBell: () => void
  handleLogicalQubitsChange: (nextLogicalQubits: number) => void
  handleCircuitSlotClick: (columnIndex: number, qubitIndex: number) => void
  handleDeleteSelectedGate: () => void
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
  handleCircuitSlotDrop: (columnIndex: number, qubitIndex: number) => void
  handleImportCircuitConfig: (file: File) => Promise<string>
}

export const CircuitContext = createContext<CircuitContextValue | null>(null)
