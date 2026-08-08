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
  RegisterGateType,
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
  createCcxGate,
  createPairGate,
  createPlacedGate,
  createRegisterGate,
  isCircuitEmpty,
  moveCnotGateInCircuit,
  moveCcxGateInCircuit,
  movePairGateInCircuit,
  moveRegisterGateInCircuit,
  moveSingleGateInCircuit,
  placeCnotGateFromDropInCircuit,
  placeCnotGateInCircuit,
  placeCcxGateFromDropInCircuit,
  placePairGateFromDropInCircuit,
  placePairGateInCircuit,
  placeRegisterGateFromDropInCircuit,
  placeRegisterGateInCircuit,
  placeSingleGateInCircuit,
  registerDurationUs,
  registerTargetsFromEntryOrder,
  removeGateById,
  reverseRegisterOrderById,
  updateGateParamsById,
  removeLastEmptyColumn,
  resizeCircuitEditorState,
  resolveCnotDropPlacement,
  resolveCcxDropPlacement,
  resolveRegisterDropPlacement,
  isControlledGateType,
  isPairGateType,
  isMultiControlledGateType,
  isRegisterGateType,
  isThetaGateType,
  maxMarkedIndex,
  MIN_REGISTER_GATE_QUBITS,
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
import { CircuitContext, type CircuitContextValue, type CircuitPresetKey, type PendingCnotControl } from './CircuitContextCore'

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

const DEFAULT_EDITOR_HINT = 'パレットからゲートをドラッグして配置するか、既存のゲートをクリックして選択してください。'

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

    if (isRegisterGateType(gateType)) {
      setEditorHint(`${gateType}: 量子ビットをビット0(最下位)から順にクリックしてレジスタを作り、選択済みの量子ビットをもう一度クリックすると確定します。`)
      return
    }

    if (isControlledGateType(gateType) || isPairGateType(gateType)) {
      setEditorHint(`${gateType}: 量子ビットをクリックしてから、接続先の量子ビットをクリックしてください。`)
      return
    }

    setEditorHint(`${gateType}: パレットからドラッグして配置してください。`)
  }

  function handleGateSelect(gateId: string | null) {
    setSelectedGateId(gateId)
    setPendingCnotControl(null)
    setEditorHint(gateId ? 'ゲートを選択中です。Deleteキーで削除できます。' : DEFAULT_EDITOR_HINT)
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

  // Builds a register gate one click at a time, LSB-first: the qubit picked
  // first carries bit 0. Picking top to bottom therefore makes the top wire the
  // least significant bit, matching Quirk and Qiskit. The qubits need be
  // neither adjacent nor ascending. Clicking a qubit already in the register
  // commits it.
  function handleRegisterSlotClick(
    gateType: RegisterGateType,
    columnIndex: number,
    qubitIndex: number,
  ) {
    const pending =
      pendingCnotControl !== null && pendingCnotControl.columnIndex === columnIndex
        ? pendingCnotControl
        : null

    if (pending === null) {
      setPendingCnotControl({ columnIndex, qubitIndex, additionalQubits: [] })
      setEditorHint(`${gateType}: q${qubitIndex} をビット0(最下位)にしました。続けて上位ビットにする量子ビットをクリックしてください。`)
      return
    }

    const entryOrder = [pending.qubitIndex, ...(pending.additionalQubits ?? [])]
    if (!entryOrder.includes(qubitIndex)) {
      setPendingCnotControl({
        ...pending,
        additionalQubits: [...(pending.additionalQubits ?? []), qubitIndex],
      })
      setEditorHint(
        `${gateType}: ビット0から順に [${[...entryOrder, qubitIndex].map((qubit) => `q${qubit}`).join(', ')}]。`
        + '選択済みの量子ビットをもう一度クリックすると確定します。',
      )
      return
    }

    if (entryOrder.length < MIN_REGISTER_GATE_QUBITS) {
      setPendingCnotControl(null)
      setEditorHint(`${gateType}: 選択を解除しました。開始する量子ビットをクリックしてください。`)
      return
    }

    const registerQubits = registerTargetsFromEntryOrder(entryOrder)
    const gateId = `${gateType.toLowerCase()}-${columnIndex}-${registerQubits.join('-')}-${gateIdCounterRef.current}`
    const durationUs = registerDurationUs(
      gateDurationDefaults[gateType],
      registerQubits.length,
    )
    const candidate = createRegisterGate(registerQubits, durationUs, gateId, gateType)
    const placement = canPlaceGateInColumn(circuitState, columnIndex, candidate)
    if (!placement.valid) {
      setEditorHint(placement.message ?? `${gateType} cannot be placed in that occupied slot.`)
      return
    }

    gateIdCounterRef.current += 1
    finalizeCircuitEdit(placeRegisterGateInCircuit(
      circuitState,
      circuitState.columns.length,
      columnIndex,
      registerQubits,
      durationUs,
      gateId,
      gateType,
    ))
    setEditorHint(
      `${gateType} を配置しました。ビット0から順に [${entryOrder.map((qubit) => `q${qubit}`).join(', ')}]。`
      + (gateType === 'ORACLE' ? 'インスペクタでマークする状態を設定してください。' : ''),
    )
  }

  // Only CNOT/CZ/CP/SWAP and the register gates support click placement.
  // CNOT/CZ/CP/SWAP use a two-click "stretch" between any two qubits in a
  // column; register gates accumulate an ordered register (see above). Every
  // other gate type is drag-only (from the palette), and selecting an existing
  // gate happens by clicking it directly (see CircuitPreview's slot click
  // wiring), not through here.
  function handleCircuitSlotClick(columnIndex: number, qubitIndex: number) {
    if (selectedGateType && isRegisterGateType(selectedGateType)) {
      handleRegisterSlotClick(selectedGateType, columnIndex, qubitIndex)
      return
    }

    if (!selectedGateType || !(isControlledGateType(selectedGateType) || isPairGateType(selectedGateType))) {
      return
    }

    const gateType = selectedGateType

    if (pendingCnotControl === null || pendingCnotControl.columnIndex !== columnIndex) {
      setPendingCnotControl({ columnIndex, qubitIndex })
      setEditorHint(`${gateType}: 列 ${columnIndex + 1} で接続先の量子ビットをクリックしてください。`)
      return
    }

    if (pendingCnotControl.qubitIndex === qubitIndex) {
      setPendingCnotControl(null)
      setEditorHint(`${gateType}: 選択を解除しました。開始する量子ビットをクリックしてください。`)
      return
    }

    const gateId = `${gateType.toLowerCase()}-${columnIndex}-${pendingCnotControl.qubitIndex}-${qubitIndex}-${gateIdCounterRef.current}`
    const candidate = isPairGateType(gateType)
      ? createPairGate(pendingCnotControl.qubitIndex, qubitIndex, gateDurationDefaults[gateType], gateId, gateType)
      : createCnotGate(pendingCnotControl.qubitIndex, qubitIndex, gateDurationDefaults[gateType], gateId, gateType)
    const placement = canPlaceGateInColumn(circuitState, columnIndex, candidate)
    if (!placement.valid) {
      setEditorHint(placement.message ?? `${gateType} cannot be placed in that occupied slot.`)
      return
    }

    gateIdCounterRef.current += 1
    finalizeCircuitEdit(
      isPairGateType(gateType)
        ? placePairGateInCircuit(
            circuitState,
            circuitState.columns.length,
            columnIndex,
            pendingCnotControl.qubitIndex,
            qubitIndex,
            gateDurationDefaults[gateType],
            gateId,
            gateType,
          )
        : placeCnotGateInCircuit(
            circuitState,
            circuitState.columns.length,
            columnIndex,
            pendingCnotControl.qubitIndex,
            qubitIndex,
            gateDurationDefaults[gateType],
            gateId,
            gateType,
          ),
    )
    if (isThetaGateType(gateType)) {
      setSelectedGateId(gateId)
      setEditorHint(`${gateType}を配置しました。インスペクターで角度 θ を指定してください。`)
    } else {
      setEditorHint(`${gateType}を配置しました。`)
    }
  }

  function handleDeleteSelectedGate() {
    if (!selectedGateId) {
      return
    }

    finalizeCircuitEdit(removeGateById(circuitState, selectedGateId))
    setEditorHint('Selected gate deleted.')
  }

  function handleLoadCircuitPreset(preset: CircuitPresetKey) {
    const duration = (type: GateType) => gateDurationDefaults[type]
    const gate = (
      id: string,
      type: GateType,
      targets: number[],
      controls: number[] = [],
      extra: Partial<CircuitEditorState['columns'][number]['gates'][number]> = {},
    ) => ({
      id,
      type,
      targets,
      controls,
      params: { duration_us: duration(type) },
      ...extra,
    })

    let columns: CircuitEditorState['columns']
    let logicalQubits: number
    let classicalBits: number
    let initialStates: CircuitEditorState['initial_states']
    let hint: string

    if (preset === 'teleportation') {
      columns = [
        { step: 0, gates: [gate('tele-h-q1', 'H', [1])] },
        { step: 1, gates: [gate('tele-cnot-a', 'CNOT', [2], [1])] },
        { step: 2, gates: [gate('tele-cnot-b', 'CNOT', [1], [0])] },
        { step: 3, gates: [gate('tele-h-q0', 'H', [0])] },
        { step: 4, gates: [gate('tele-m-q0', 'MEASURE', [0], [], { classical_targets: [0] })] },
        { step: 5, gates: [gate('tele-m-q1', 'MEASURE', [1], [], { classical_targets: [1] })] },
        { step: 6, gates: [gate('tele-x-q2', 'X', [2], [], { condition: { bit: 1, value: 1 }, conditions: [{ bit: 1, value: 1 }] })] },
        { step: 7, gates: [gate('tele-z-q2', 'Z', [2], [], { condition: { bit: 0, value: 1 }, conditions: [{ bit: 0, value: 1 }] })] },
      ]
      logicalQubits = 3
      classicalBits = 2
      initialStates = ['+', 0, 0]
      hint = '量子テレポーテーション回路を読み込みました。'
    } else if (preset === 'bit_flip_repetition') {
      columns = [
        { step: 0, gates: [gate('flip-enc-1', 'CNOT', [1], [0])] },
        { step: 1, gates: [gate('flip-enc-2', 'CNOT', [2], [0])] },
        { step: 2, gates: [gate('flip-error', 'X', [1])] },
        { step: 3, gates: [gate('flip-syndrome-a0', 'CNOT', [3], [0])] },
        { step: 4, gates: [gate('flip-syndrome-a1', 'CNOT', [3], [1])] },
        { step: 5, gates: [gate('flip-syndrome-b1', 'CNOT', [4], [1])] },
        { step: 6, gates: [gate('flip-syndrome-b2', 'CNOT', [4], [2])] },
        { step: 7, gates: [gate('flip-measure-a', 'MEASURE', [3], [], { classical_targets: [0] })] },
        { step: 8, gates: [gate('flip-measure-b', 'MEASURE', [4], [], { classical_targets: [1] })] },
        { step: 9, gates: [gate('flip-correct-q0', 'X', [0], [], { conditions: [{ bit: 0, value: 1 }, { bit: 1, value: 0 }] })] },
        { step: 10, gates: [gate('flip-correct-q1', 'X', [1], [], { conditions: [{ bit: 0, value: 1 }, { bit: 1, value: 1 }] })] },
        { step: 11, gates: [gate('flip-correct-q2', 'X', [2], [], { conditions: [{ bit: 0, value: 0 }, { bit: 1, value: 1 }] })] },
      ]
      logicalQubits = 5
      classicalBits = 2
      initialStates = [1, 0, 0, 0, 0]
      hint = '3量子ビット反復符号を読み込みました。X故障を注入済みです。'
    } else {
      // Marks |11> with a CZ oracle, then amplifies it with one Grover diffusion round.
      columns = [
        { step: 0, gates: [gate('grover-h0-a', 'H', [0])] },
        { step: 1, gates: [gate('grover-h1-a', 'H', [1])] },
        { step: 2, gates: [gate('grover-oracle', 'CZ', [1], [0])] },
        { step: 3, gates: [gate('grover-h0-b', 'H', [0])] },
        { step: 4, gates: [gate('grover-h1-b', 'H', [1])] },
        { step: 5, gates: [gate('grover-x0-a', 'X', [0])] },
        { step: 6, gates: [gate('grover-x1-a', 'X', [1])] },
        { step: 7, gates: [gate('grover-diffuser', 'CZ', [1], [0])] },
        { step: 8, gates: [gate('grover-x0-b', 'X', [0])] },
        { step: 9, gates: [gate('grover-x1-b', 'X', [1])] },
        { step: 10, gates: [gate('grover-h0-c', 'H', [0])] },
        { step: 11, gates: [gate('grover-h1-c', 'H', [1])] },
      ]
      logicalQubits = 2
      classicalBits = 0
      initialStates = [0, 0]
      hint = 'Grover探索回路を読み込みました。|11>を1回の反復で振幅増幅します。'
    }

    const nextCircuit: CircuitEditorState = {
      logical_qubits: logicalQubits,
      classical_bits: classicalBits,
      initial_states: initialStates,
      columns,
    }
    finalizeCircuitEdit(nextCircuit)
    setSelectedGateType(null)
    setEditorHint(hint)
  }

  function handleUpdateSelectedGateTheta(thetaRad: number) {
    if (!selectedGateId || !Number.isFinite(thetaRad)) {
      return
    }
    finalizeCircuitEdit(updateGateParamsById(
      circuitState,
      selectedGateId,
      { theta_rad: thetaRad },
    ))
    setSelectedGateId(selectedGateId)
    setEditorHint(`角度を ${thetaRad.toFixed(4)} rad に更新しました。`)
  }

  function handleUpdateSelectedGateMarkedIndex(markedIndex: number) {
    if (!selectedGateId || !Number.isInteger(markedIndex) || markedIndex < 0) {
      return
    }
    const gate = circuitState.columns
      .flatMap((column) => column.gates)
      .find((candidate) => candidate.id === selectedGateId)
    if (!gate || gate.type !== 'ORACLE') {
      return
    }
    const highest = maxMarkedIndex(gate.targets.length)
    if (markedIndex > highest) {
      setEditorHint(`ORACLE: マークできるのは 0〜${highest} です。`)
      return
    }
    finalizeCircuitEdit(updateGateParamsById(
      circuitState,
      selectedGateId,
      { marked_index: markedIndex },
    ))
    setSelectedGateId(selectedGateId)
    const label = markedIndex.toString(2).padStart(gate.targets.length, '0')
    setEditorHint(`ORACLE: |${label}> をマークするようにしました。`)
  }

  function handleReverseSelectedGateRegister() {
    if (!selectedGateId) {
      return
    }
    const nextCircuit = reverseRegisterOrderById(circuitState, selectedGateId)
    if (nextCircuit === circuitState) {
      return
    }
    finalizeCircuitEdit(nextCircuit)
    setSelectedGateId(selectedGateId)
    setEditorHint('レジスタ順を反転しました。上から順のワイヤ列を下位ビット先頭として読む外部シミュレータと突き合わせるときに使えます。')
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
      const gateId = `${dragPayload.gateType.toLowerCase()}-${columnIndex}-${qubitIndex}-${gateIdCounterRef.current}`
      const candidate =
        isRegisterGateType(dragPayload.gateType)
          ? (() => {
              const registerQubits = resolveRegisterDropPlacement(
                qubitIndex,
                circuitState.logical_qubits,
              )
              return createRegisterGate(
                registerQubits,
                registerDurationUs(
                  gateDurationDefaults[dragPayload.gateType],
                  registerQubits.length,
                ),
                gateId,
                dragPayload.gateType,
              )
            })()
          : isMultiControlledGateType(dragPayload.gateType)
          ? (() => {
              const placement = resolveCcxDropPlacement(qubitIndex, circuitState.logical_qubits)
              return createCcxGate(
                placement.controlA,
                placement.controlB,
                placement.targetQubit,
                gateDurationDefaults.CCX,
                gateId,
              )
            })()
          : isControlledGateType(dragPayload.gateType)
          ? (() => {
              const placement = resolveCnotDropPlacement(qubitIndex, circuitState.logical_qubits)
              return createCnotGate(
                placement.controlQubit,
                placement.targetQubit,
                gateDurationDefaults[dragPayload.gateType],
                gateId,
                dragPayload.gateType,
              )
            })()
          : isPairGateType(dragPayload.gateType)
            ? (() => {
                const placement = resolveCnotDropPlacement(qubitIndex, circuitState.logical_qubits)
                return createPairGate(
                  placement.controlQubit,
                  placement.targetQubit,
                  gateDurationDefaults[dragPayload.gateType],
                  gateId,
                  dragPayload.gateType,
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
        isRegisterGateType(dragPayload.gateType)
          ? placeRegisterGateFromDropInCircuit(
              circuitState,
              circuitState.columns.length,
              columnIndex,
              qubitIndex,
              gateDurationDefaults[dragPayload.gateType],
              gateId,
              dragPayload.gateType,
            )
          : isMultiControlledGateType(dragPayload.gateType)
          ? placeCcxGateFromDropInCircuit(
              circuitState,
              circuitState.columns.length,
              columnIndex,
              qubitIndex,
              gateDurationDefaults.CCX,
              gateId,
            )
          : isControlledGateType(dragPayload.gateType)
          ? placeCnotGateFromDropInCircuit(
              circuitState,
              circuitState.columns.length,
              columnIndex,
              qubitIndex,
              gateDurationDefaults[dragPayload.gateType],
              gateId,
              dragPayload.gateType,
            )
          : isPairGateType(dragPayload.gateType)
            ? placePairGateFromDropInCircuit(
                circuitState,
                circuitState.columns.length,
                columnIndex,
                qubitIndex,
                gateDurationDefaults[dragPayload.gateType],
                gateId,
                dragPayload.gateType,
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
      if (isThetaGateType(dragPayload.gateType)) {
        // Select the new gate so the inspector opens on its angle field right away.
        setSelectedGateId(gateId)
        setEditorHint(`${dragPayload.gateType} を配置しました。インスペクターで角度 θ を指定してください。`)
      } else {
        setEditorHint(`${dragPayload.gateType} placed by drag-and-drop.`)
      }
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
      isRegisterGateType(dragPayload.gateType)
        ? moveRegisterGateInCircuit(
            circuitState,
            circuitState.columns.length,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
            dragPayload.fromQubit,
          )
        : isMultiControlledGateType(dragPayload.gateType)
        ? moveCcxGateInCircuit(
            circuitState,
            circuitState.columns.length,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
          )
        : isControlledGateType(dragPayload.gateType)
        ? moveCnotGateInCircuit(
            circuitState,
            circuitState.columns.length,
            dragPayload.gateId,
            columnIndex,
            qubitIndex,
            dragPayload.fromQubit,
          )
        : isPairGateType(dragPayload.gateType)
          ? movePairGateInCircuit(
              circuitState,
              circuitState.columns.length,
              dragPayload.gateId,
              columnIndex,
              qubitIndex,
              dragPayload.fromQubit,
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
    handleLoadCircuitPreset,
    handleLogicalQubitsChange,
    handleCircuitSlotClick,
    handleDeleteSelectedGate,
    handleUpdateSelectedGateTheta,
    handleUpdateSelectedGateMarkedIndex,
    handleReverseSelectedGateRegister,
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
