import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  CircuitEditorState,
  DragGatePayload,
  GateType,
} from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import { createDefaultBellCircuit } from '../utils/circuitDefaults'
import { parseCircuitConfigJson } from '../utils/circuitConfigTransfer'
import {
  appendEmptyColumn,
  canRemoveLastColumn,
  canPlaceGateInColumn,
  clearCircuit,
  createCnotGate,
  createPlacedGate,
  getGateIdAtSlot,
  isCircuitEmpty,
  moveCnotGateInCircuit,
  moveSingleGateInCircuit,
  placeCnotGateFromDropInCircuit,
  placeCnotGateInCircuit,
  placeSingleGateInCircuit,
  removeGateById,
  removeLastEmptyColumn,
  resizeCircuitEditorState,
  resolveCnotDropPlacement,
} from '../utils/circuitEditing'
import {
  canRedo,
  canUndo,
  commitCircuitChange,
  createCircuitHistory,
  redoCircuitChange,
  undoCircuitChange,
  type CircuitHistoryState,
} from '../utils/circuitHistory'
import { CircuitContext, type CircuitContextValue, type PendingCnotControl } from './CircuitContextCore'

type ActiveDragSession = {
  source: 'palette' | 'circuit'
  gateId?: string
  gateType: GateType
  committed: boolean
}

type CircuitProviderProps = {
  gateDurationDefaults: GateDurationDefaults
  children: ReactNode
}

const DEFAULT_EDITOR_HINT = 'ゲートを選択してから、回路スロットをクリックしてください。'

export function CircuitProvider({ gateDurationDefaults, children }: CircuitProviderProps) {
  const [circuitHistory, setCircuitHistory] = useState<CircuitHistoryState>(() =>
    createCircuitHistory(createDefaultBellCircuit()),
  )
  const [selectedGateType, setSelectedGateType] = useState<GateType | null>(null)
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null)
  const [dragPayload, setDragPayload] = useState<DragGatePayload | null>(null)
  const [pendingCnotControl, setPendingCnotControl] = useState<PendingCnotControl | null>(null)
  const [editorHint, setEditorHint] = useState<string>(DEFAULT_EDITOR_HINT)
  const gateIdCounterRef = useRef(0)
  const activeDragRef = useRef<ActiveDragSession | null>(null)
  const circuitState = circuitHistory.present

  function finalizeCircuitEdit(nextCircuit: CircuitEditorState) {
    setCircuitHistory((currentHistory) => commitCircuitChange(currentHistory, nextCircuit))
    setSelectedGateId(null)
    setPendingCnotControl(null)
  }

  function handleSelectGateType(gateType: GateType | null) {
    setSelectedGateType(gateType)
    setSelectedGateId(null)
    setPendingCnotControl(null)

    if (gateType === null) {
      setEditorHint(DEFAULT_EDITOR_HINT)
      return
    }

    if (gateType === 'CNOT') {
      setEditorHint('CNOT: 同じ列で制御ビット、続けて対象ビットをクリックしてください。')
      return
    }

    setEditorHint(`選択中のゲート: ${gateType}。回路スロットをクリックしてください。`)
  }

  function handleGateSelect(gateId: string | null) {
    setSelectedGateId(gateId)
    setPendingCnotControl(null)
    setEditorHint(gateId ? 'ゲートを選択中です。削除するか、別のスロットを選択してください。' : DEFAULT_EDITOR_HINT)
  }

  function handleResetCircuitToBell() {
    finalizeCircuitEdit(createDefaultBellCircuit())
    setSelectedGateType(null)
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(DEFAULT_EDITOR_HINT)
    gateIdCounterRef.current = 0
  }

  function handleLogicalQubitsChange(nextLogicalQubits: number) {
    if (nextLogicalQubits === circuitState.logical_qubits) {
      return
    }

    finalizeCircuitEdit(resizeCircuitEditorState(circuitState, nextLogicalQubits))
    setEditorHint(`Circuit resized to ${nextLogicalQubits} qubits.`)
  }

  function handleCircuitSlotClick(columnIndex: number, qubitIndex: number) {
    if (!selectedGateType) {
      const gateId = getGateIdAtSlot(circuitState, columnIndex, qubitIndex)
      setSelectedGateId(gateId)
      setEditorHint(gateId ? 'Selected gate. Delete it or choose another slot.' : DEFAULT_EDITOR_HINT)
      return
    }

    const gateType = selectedGateType

    if (gateType === 'CNOT') {
      if (pendingCnotControl === null || pendingCnotControl.columnIndex !== columnIndex) {
        setPendingCnotControl({ columnIndex, qubitIndex })
        setEditorHint(`CNOT: choose target in column ${columnIndex + 1}.`)
        return
      }

      if (pendingCnotControl.qubitIndex === qubitIndex) {
        setEditorHint('CNOT: control and target must differ.')
        return
      }

      const gateId = `cnot-${columnIndex}-${pendingCnotControl.qubitIndex}-${qubitIndex}-${gateIdCounterRef.current}`
      const candidate = createCnotGate(
        pendingCnotControl.qubitIndex,
        qubitIndex,
        gateDurationDefaults.CNOT,
        gateId,
      )
      const placement = canPlaceGateInColumn(circuitState, columnIndex, candidate)
      if (!placement.valid) {
        setEditorHint(placement.message ?? 'CNOT cannot be placed in that occupied slot.')
        return
      }

      gateIdCounterRef.current += 1
      finalizeCircuitEdit(
        placeCnotGateInCircuit(
          circuitState,
          circuitState.columns.length,
          columnIndex,
          pendingCnotControl.qubitIndex,
          qubitIndex,
          gateDurationDefaults.CNOT,
          gateId,
        ),
      )
      setEditorHint('CNOT placed. Click control, then target in the same column.')
      return
    }

    const gateId = `${gateType.toLowerCase()}-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current}`
    const candidate = createPlacedGate(gateType, qubitIndex, gateDurationDefaults[gateType], gateId)
    const placement = canPlaceGateInColumn(circuitState, columnIndex, candidate)
    if (!placement.valid) {
      setEditorHint(placement.message ?? `${gateType} cannot be placed in that occupied slot.`)
      return
    }

    gateIdCounterRef.current += 1
    finalizeCircuitEdit(
      placeSingleGateInCircuit(
        circuitState,
        circuitState.columns.length,
        columnIndex,
        qubitIndex,
        gateType,
        gateDurationDefaults[gateType],
        gateId,
      ),
    )
    setEditorHint(`Selected gate: ${gateType}. Click a circuit slot.`)
  }

  function handleDeleteSelectedGate() {
    if (!selectedGateId) {
      return
    }

    finalizeCircuitEdit(removeGateById(circuitState, selectedGateId))
    setEditorHint('Selected gate deleted.')
  }

  function handleClearCircuit() {
    finalizeCircuitEdit(clearCircuit(circuitState))
    setEditorHint('Circuit cleared.')
  }

  function handleAddCircuitColumn() {
    finalizeCircuitEdit(appendEmptyColumn(circuitState))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(`Added column ${circuitState.columns.length + 1}.`)
  }

  function handleRemoveLastCircuitColumn() {
    if (!canRemoveLastColumn(circuitState)) {
      setEditorHint('Remove last column is available only when the final column is empty.')
      return
    }

    finalizeCircuitEdit(removeLastEmptyColumn(circuitState))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(`Removed column ${circuitState.columns.length}.`)
  }

  function handleUndoCircuit() {
    setCircuitHistory((currentHistory) => undoCircuitChange(currentHistory))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint('Undid last circuit edit.')
  }

  function handleRedoCircuit() {
    setCircuitHistory((currentHistory) => redoCircuitChange(currentHistory))
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint('Redid circuit edit.')
  }

  function handlePaletteGateDragStart(gateType: GateType) {
    activeDragRef.current = { source: 'palette', gateType, committed: false }
    setDragPayload({ source: 'palette', gateType })
    setSelectedGateType(null)
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint(`${gateType} をドラッグ中です。回路スロットにドロップしてください。`)
  }

  function handleCircuitGateDragStart(
    gateId: string,
    gateType: GateType,
    fromColumn: number,
    fromQubit: number,
  ) {
    activeDragRef.current = { source: 'circuit', gateId, gateType, committed: false }
    setDragPayload({ source: 'circuit', gateId, gateType, fromColumn, fromQubit })
    setSelectedGateType(null)
    setSelectedGateId(gateId)
    setPendingCnotControl(null)
    setEditorHint(`${gateType} を移動中です。回路スロットにドロップしてください。`)
  }

  function handleGateDragEnd() {
    const dragSession = activeDragRef.current
    if (dragSession?.source === 'circuit' && dragSession.committed === false && dragSession.gateId) {
      finalizeCircuitEdit(removeGateById(circuitState, dragSession.gateId))
      setEditorHint(`${dragSession.gateType} deleted by drag-out.`)
    }

    activeDragRef.current = null
    setDragPayload(null)
  }

  function handleCircuitSlotDrop(columnIndex: number, qubitIndex: number) {
    if (!dragPayload) {
      return
    }

    if (dragPayload.source === 'palette') {
      const gateId =
        dragPayload.gateType === 'CNOT'
          ? `cnot-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current}`
          : `${dragPayload.gateType.toLowerCase()}-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current}`
      const candidate =
        dragPayload.gateType === 'CNOT'
          ? (() => {
              const placement = resolveCnotDropPlacement(qubitIndex, circuitState.logical_qubits)
              return createCnotGate(
                placement.controlQubit,
                placement.targetQubit,
                gateDurationDefaults.CNOT,
                gateId,
              )
            })()
          : createPlacedGate(
              dragPayload.gateType,
              qubitIndex,
              gateDurationDefaults[dragPayload.gateType],
              gateId,
            )
      const placement = canPlaceGateInColumn(circuitState, columnIndex, candidate)
      if (!placement.valid) {
        if (activeDragRef.current) {
          activeDragRef.current.committed = true
        }
        setEditorHint(placement.message ?? `${dragPayload.gateType} cannot be placed in that occupied slot.`)
        setDragPayload(null)
        return
      }

      gateIdCounterRef.current += 1
      const nextCircuit =
        dragPayload.gateType === 'CNOT'
          ? placeCnotGateFromDropInCircuit(
              circuitState,
              circuitState.columns.length,
              columnIndex,
              qubitIndex,
              gateDurationDefaults.CNOT,
              gateId,
            )
          : placeSingleGateInCircuit(
              circuitState,
              circuitState.columns.length,
              columnIndex,
              qubitIndex,
              dragPayload.gateType,
              gateDurationDefaults[dragPayload.gateType],
              gateId,
            )

      if (activeDragRef.current) {
        activeDragRef.current.committed = true
      }

      finalizeCircuitEdit(nextCircuit)
      setEditorHint(`${dragPayload.gateType} placed by drag-and-drop.`)
      setDragPayload(null)
      return
    }

    if (dragPayload.fromColumn === columnIndex && dragPayload.fromQubit === qubitIndex) {
      if (activeDragRef.current) {
        activeDragRef.current.committed = true
      }
      setEditorHint(`${dragPayload.gateType} stayed in place.`)
      setDragPayload(null)
      return
    }

    const nextCircuit =
      dragPayload.gateType === 'CNOT'
        ? moveCnotGateInCircuit(
            circuitState,
            circuitState.columns.length,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
          )
        : moveSingleGateInCircuit(
            circuitState,
            circuitState.columns.length,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
          )

    if (activeDragRef.current) {
      activeDragRef.current.committed = true
    }

    finalizeCircuitEdit(nextCircuit)
    setEditorHint(
      nextCircuit === circuitState
        ? `${dragPayload.gateType} could not move there because the target slot is occupied.`
        : `${dragPayload.gateType} moved by drag-and-drop.`,
    )
    setDragPayload(null)
  }

  async function handleImportCircuitConfig(file: File) {
    const text = await file.text()
    const importedCircuit = parseCircuitConfigJson(text)

    finalizeCircuitEdit(importedCircuit)
    setSelectedGateType(null)
    setSelectedGateId(null)
    setPendingCnotControl(null)
    setEditorHint('回路をインポートしました。')

    return '回路をインポートしました。'
  }

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase()
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable
        ) {
          return
        }
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedGateId !== null) {
        event.preventDefault()
        handleDeleteSelectedGate()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  })

  const value: CircuitContextValue = {
    circuitState,
    selectedGateType,
    selectedGateId,
    dragPayload,
    pendingCnotControl,
    editorHint,
    canUndoCircuit: canUndo(circuitHistory),
    canRedoCircuit: canRedo(circuitHistory),
    canDeleteSelected: selectedGateId !== null,
    canClearCircuit: !isCircuitEmpty(circuitState),
    canRemoveLastCircuitColumn: canRemoveLastColumn(circuitState),
    handleSelectGateType,
    handleGateSelect,
    handleResetCircuitToBell,
    handleLogicalQubitsChange,
    handleCircuitSlotClick,
    handleDeleteSelectedGate,
    handleClearCircuit,
    handleAddCircuitColumn,
    handleRemoveLastCircuitColumn,
    handleUndoCircuit,
    handleRedoCircuit,
    handlePaletteGateDragStart,
    handleCircuitGateDragStart,
    handleGateDragEnd,
    handleCircuitSlotDrop,
    handleImportCircuitConfig,
  }

  return <CircuitContext.Provider value={value}>{children}</CircuitContext.Provider>
}
