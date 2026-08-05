import type {
  CircuitColumn,
  CircuitEditorState,
  CircuitGate,
  CircuitGateParams,
  ControlledGateType,
  InitialQubitState,
  GateType,
  MultiControlledGateType,
  PairGateType,
  SingleQubitGateType,
} from '../types/circuit'

export function isAnnotationGateType(gateType: GateType): gateType is 'RECEIVED' {
  return gateType === 'RECEIVED'
}

export function isControlledGateType(gateType: GateType): gateType is ControlledGateType {
  return gateType === 'CNOT' || gateType === 'CZ' || gateType === 'CP'
}

export function isPairGateType(gateType: GateType): gateType is PairGateType {
  return gateType === 'SWAP'
}

export function isMultiControlledGateType(
  gateType: GateType,
): gateType is MultiControlledGateType {
  return gateType === 'CCX'
}

export function isTwoQubitGateType(gateType: GateType) {
  return isControlledGateType(gateType) || isPairGateType(gateType)
}

export function isMultiQubitGateType(gateType: GateType) {
  return isTwoQubitGateType(gateType) || isMultiControlledGateType(gateType)
}

export const DEFAULT_EDITOR_COLUMN_COUNT = 4
const MIN_SUPPORTED_LOGICAL_QUBITS = 2
const MAX_SUPPORTED_LOGICAL_QUBITS = 4

export function createEmptyCircuitColumn(step: number): CircuitColumn {
  return {
    step,
    gates: [],
  }
}

export function ensureCircuitColumnCount(
  circuit: CircuitEditorState,
  columnCount: number,
): CircuitEditorState {
  const columns = [...circuit.columns]
  while (columns.length < columnCount) {
    columns.push(createEmptyCircuitColumn(columns.length))
  }
  return {
    ...circuit,
    columns,
  }
}

export function appendEmptyColumn(circuit: CircuitEditorState): CircuitEditorState {
  return {
    ...circuit,
    columns: [
      ...circuit.columns,
      createEmptyCircuitColumn(circuit.columns.length),
    ],
  }
}

export function canRemoveLastColumn(circuit: CircuitEditorState) {
  const lastColumn = circuit.columns[circuit.columns.length - 1]
  return circuit.columns.length > 1 && lastColumn !== undefined && lastColumn.gates.length === 0
}

export function removeLastEmptyColumn(circuit: CircuitEditorState): CircuitEditorState {
  if (!canRemoveLastColumn(circuit)) {
    return circuit
  }

  return {
    ...circuit,
    columns: circuit.columns.slice(0, -1),
  }
}

function clampLogicalQubitCount(logicalQubits: number) {
  const normalized = Math.trunc(logicalQubits)
  return Math.min(MAX_SUPPORTED_LOGICAL_QUBITS, Math.max(MIN_SUPPORTED_LOGICAL_QUBITS, normalized))
}

function isQubitIndexValid(qubitIndex: number, logicalQubits: number) {
  return Number.isInteger(qubitIndex) && qubitIndex >= 0 && qubitIndex < logicalQubits
}

function cloneGate(gate: CircuitGate): CircuitGate {
  return {
    ...gate,
    targets: [...gate.targets],
    ...(gate.controls === undefined ? {} : { controls: [...gate.controls] }),
    ...(gate.params === undefined ? {} : { params: { ...gate.params } }),
    ...(gate.source_id === undefined ? {} : { source_id: gate.source_id }),
  }
}

function isGateValidForLogicalQubits(gate: CircuitGate, logicalQubits: number) {
  if (isControlledGateType(gate.type)) {
    const controls = gate.controls ?? []
    if (controls.length !== 1 || gate.targets.length !== 1) {
      return false
    }

    const control = controls[0]
    const target = gate.targets[0]
    return (
      isQubitIndexValid(control, logicalQubits) &&
      isQubitIndexValid(target, logicalQubits) &&
      control !== target
    )
  }

  if (isPairGateType(gate.type)) {
    return (
      (gate.controls ?? []).length === 0 &&
      gate.targets.length === 2 &&
      gate.targets[0] !== gate.targets[1] &&
      gate.targets.every((target) => isQubitIndexValid(target, logicalQubits))
    )
  }

  if (isMultiControlledGateType(gate.type)) {
    const controls = gate.controls ?? []
    const qubits = [...controls, ...gate.targets]
    return (
      controls.length === 2 &&
      gate.targets.length === 1 &&
      new Set(qubits).size === 3 &&
      qubits.every((qubit) => isQubitIndexValid(qubit, logicalQubits))
    )
  }

  if (gate.targets.length !== 1) {
    return false
  }

  return isQubitIndexValid(gate.targets[0], logicalQubits)
}

function normalizeInitialStates(
  initialStates: InitialQubitState[],
  logicalQubits: number,
): InitialQubitState[] {
  return Array.from({ length: logicalQubits }, (_, index) =>
    initialStates[index] === 1 ? 1 : 0,
  )
}

function normalizeCircuitColumns(
  columns: CircuitEditorState['columns'],
  logicalQubits: number,
) {
  return columns.map((column) => {
    const gates = column.gates
      .filter((gate) => isGateValidForLogicalQubits(gate, logicalQubits))
      .map((gate) => cloneGate(gate))

    return {
      ...column,
      gates: sortCircuitColumnGates(gates),
    }
  })
}

export function resizeCircuitEditorState(
  circuit: CircuitEditorState,
  logicalQubits: number,
): CircuitEditorState {
  const nextLogicalQubits = clampLogicalQubitCount(logicalQubits)
  const nextInitialStates = normalizeInitialStates(
    circuit.initial_states,
    nextLogicalQubits,
  )
  const nextColumns = normalizeCircuitColumns(circuit.columns, nextLogicalQubits)

  const hasChanged =
    circuit.logical_qubits !== nextLogicalQubits ||
    circuit.initial_states.length !== nextLogicalQubits ||
    circuit.initial_states.some((state, index) => nextInitialStates[index] !== state) ||
    circuit.columns.some((column, columnIndex) => {
      const nextColumn = nextColumns[columnIndex]
      if (nextColumn === undefined) {
        return true
      }

      if (column.gates.length !== nextColumn.gates.length) {
        return true
      }

      return column.gates.some((gate, gateIndex) => gate.id !== nextColumn.gates[gateIndex]?.id)
    })

  if (!hasChanged) {
    return circuit
  }

  return {
    ...circuit,
    logical_qubits: nextLogicalQubits,
    initial_states: nextInitialStates,
    columns: nextColumns,
  }
}

export function createPlacedGate(
  gateType: SingleQubitGateType,
  qubitIndex: number,
  durationUs: number,
  gateId: string,
): CircuitGate {
  return {
    id: gateId,
    type: gateType,
    targets: [qubitIndex],
      params: {
      duration_us: durationUs,
      ...(
        gateType === 'RX' || gateType === 'RY' || gateType === 'RZ'
          ? { theta_rad: Math.PI / 2 }
          : gateType === 'MESSAGE'
            ? { animation_parameter_t: 0 }
            : {}
      ),
    },
  }
}

export function createCnotGate(
  controlQubit: number,
  targetQubit: number,
  durationUs: number,
  gateId: string,
  gateType: ControlledGateType = 'CNOT',
): CircuitGate {
  return {
    id: gateId,
    type: gateType,
    controls: [controlQubit],
    targets: [targetQubit],
    params: {
      duration_us: durationUs,
      ...(gateType === 'CP' ? { theta_rad: Math.PI / 2 } : {}),
    },
  }
}

export function createPairGate(
  firstQubit: number,
  secondQubit: number,
  durationUs: number,
  gateId: string,
  gateType: PairGateType = 'SWAP',
): CircuitGate {
  return {
    id: gateId,
    type: gateType,
    targets: [firstQubit, secondQubit],
    params: { duration_us: durationUs },
  }
}

export function createCcxGate(
  controlA: number,
  controlB: number,
  targetQubit: number,
  durationUs: number,
  gateId: string,
  gateType: MultiControlledGateType = 'CCX',
): CircuitGate {
  return {
    id: gateId,
    type: gateType,
    controls: [controlA, controlB],
    targets: [targetQubit],
    params: { duration_us: durationUs },
  }
}

export function resolveCnotDropPlacement(qubitIndex: number, logicalQubits: number) {
  if (logicalQubits < 2) {
    return { controlQubit: 0, targetQubit: 0 }
  }

  if (qubitIndex < logicalQubits - 1) {
    return { controlQubit: qubitIndex, targetQubit: qubitIndex + 1 }
  }

  if (qubitIndex > 0) {
    return { controlQubit: qubitIndex - 1, targetQubit: qubitIndex }
  }

  return { controlQubit: 0, targetQubit: 1 }
}

function findGateLocationById(circuit: CircuitEditorState, gateId: string) {
  for (let columnIndex = 0; columnIndex < circuit.columns.length; columnIndex += 1) {
    const gate = circuit.columns[columnIndex].gates.find((candidate) => candidate.id === gateId)
    if (gate) {
      return {
        columnIndex,
        gate,
      }
    }
  }

  return null
}

export function getOccupiedQubits(gate: CircuitGate): number[] {
  if (isControlledGateType(gate.type) || isMultiControlledGateType(gate.type)) {
    return [...(gate.controls ?? []), ...gate.targets]
  }

  return [...gate.targets]
}

export function findColumnCollision(
  column: CircuitColumn,
  candidate: CircuitGate,
  ignoredGateId?: string,
) {
  const occupiedQubits = new Set(getOccupiedQubits(candidate))
  return column.gates.find((gate) => {
    if (gate.id === ignoredGateId) {
      return false
    }
    if (isAnnotationGateType(gate.type) || isAnnotationGateType(candidate.type)) {
      return false
    }

    return getOccupiedQubits(gate).some((qubit) => occupiedQubits.has(qubit))
  }) ?? null
}

export function formatColumnCollisionMessage(
  columnIndex: number,
  candidate: CircuitGate,
  collision: CircuitGate | null,
) {
  if (collision === null) {
    return null
  }

  const candidateQubits = getOccupiedQubits(candidate)
  const collisionQubits = new Set(getOccupiedQubits(collision))
  const collidedQubit = candidateQubits.find((qubit) => collisionQubits.has(qubit))
  const qubitLabel = collidedQubit === undefined ? 'A qubit' : `q${collidedQubit}`
  return `${qubitLabel} is already occupied in column ${columnIndex + 1}.`
}

export function canPlaceGateInColumn(
  circuit: CircuitEditorState,
  columnIndex: number,
  candidate: CircuitGate,
  ignoredGateId?: string,
) {
  const column = circuit.columns[columnIndex]
  if (!column) {
    return {
      valid: true,
      message: null,
    }
  }

  const collision = findColumnCollision(column, candidate, ignoredGateId)
  return {
    valid: collision === null,
    message: formatColumnCollisionMessage(columnIndex, candidate, collision),
  }
}

export function sortCircuitColumnGates(gates: CircuitGate[]) {
  return [...gates].sort((left, right) => {
    const leftPriority = isMultiQubitGateType(left.type) ? 1 : 0
    const rightPriority = isMultiQubitGateType(right.type) ? 1 : 0
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    const leftQubit = Math.min(...getOccupiedQubits(left))
    const rightQubit = Math.min(...getOccupiedQubits(right))
    return leftQubit - rightQubit || left.type.localeCompare(right.type)
  })
}

export function placeSingleGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  qubitIndex: number,
  gateType: SingleQubitGateType,
  durationUs: number,
  gateId: string,
): CircuitEditorState {
  if (!isQubitIndexValid(qubitIndex, circuit.logical_qubits)) {
    return circuit
  }

  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )

  const candidate = createPlacedGate(gateType, qubitIndex, durationUs, gateId)
  const placement = canPlaceGateInColumn(normalizedCircuit, columnIndex, candidate)
  if (!placement.valid) {
    return circuit
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    if (index !== columnIndex) {
      return column
    }

    const remainingGates = [...column.gates, candidate]

    return {
      ...column,
      gates: sortCircuitColumnGates(remainingGates),
    }
  })

  return {
    ...normalizedCircuit,
    columns: nextColumns,
  }
}

export function moveSingleGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  gateId: string,
  targetColumnIndex: number,
  targetQubitIndex: number,
): CircuitEditorState {
  if (!isQubitIndexValid(targetQubitIndex, circuit.logical_qubits)) {
    return circuit
  }

  const sourceGate = circuit.columns
    .flatMap((column) => column.gates)
    .find((gate) => gate.id === gateId && !isMultiQubitGateType(gate.type))

  if (!sourceGate || isMultiQubitGateType(sourceGate.type)) {
    return circuit
  }

  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, targetColumnIndex + 1),
  )

  const movedGate: CircuitGate = {
    ...sourceGate,
    targets: [targetQubitIndex],
    ...(sourceGate.controls === undefined ? {} : { controls: [] }),
    params: sourceGate.params === undefined ? undefined : { ...sourceGate.params },
  }
  const placement = canPlaceGateInColumn(
    normalizedCircuit,
    targetColumnIndex,
    movedGate,
    gateId,
  )
  if (!placement.valid) {
    return circuit
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    const remainingGates = column.gates.filter((gate) => {
      return gate.id !== gateId
    })

    if (index === targetColumnIndex) {
      remainingGates.push(movedGate)
    }

    return {
      ...column,
      gates: sortCircuitColumnGates(remainingGates),
    }
  })

  return {
    ...normalizedCircuit,
    columns: nextColumns,
  }
}

export function placeCnotGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  controlQubit: number,
  targetQubit: number,
  durationUs: number,
  gateId: string,
  gateType: ControlledGateType = 'CNOT',
): CircuitEditorState {
  if (
    !isQubitIndexValid(controlQubit, circuit.logical_qubits) ||
    !isQubitIndexValid(targetQubit, circuit.logical_qubits) ||
    controlQubit === targetQubit
  ) {
    return circuit
  }

  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )

  const candidate = createCnotGate(controlQubit, targetQubit, durationUs, gateId, gateType)
  const placement = canPlaceGateInColumn(normalizedCircuit, columnIndex, candidate)
  if (!placement.valid) {
    return circuit
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    if (index !== columnIndex) {
      return column
    }

    const remainingGates = [...column.gates, candidate]

    return {
      ...column,
      gates: sortCircuitColumnGates(remainingGates),
    }
  })

  return {
    ...normalizedCircuit,
    columns: nextColumns,
  }
}

export function placeCnotGateFromDropInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  qubitIndex: number,
  durationUs: number,
  gateId: string,
  gateType: ControlledGateType = 'CNOT',
): CircuitEditorState {
  if (!isQubitIndexValid(qubitIndex, circuit.logical_qubits)) {
    return circuit
  }

  const placement = resolveCnotDropPlacement(qubitIndex, circuit.logical_qubits)
  return placeCnotGateInCircuit(
    circuit,
    columnCount,
    columnIndex,
    placement.controlQubit,
    placement.targetQubit,
    durationUs,
    gateId,
    gateType,
  )
}

export function resolveCcxDropPlacement(qubitIndex: number, logicalQubits: number) {
  if (logicalQubits < 3) {
    return { controlA: 0, controlB: 0, targetQubit: 0 }
  }
  const start = Math.min(Math.max(0, qubitIndex), logicalQubits - 3)
  return { controlA: start, controlB: start + 1, targetQubit: start + 2 }
}

export function placePairGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  firstQubit: number,
  secondQubit: number,
  durationUs: number,
  gateId: string,
  gateType: PairGateType = 'SWAP',
): CircuitEditorState {
  if (
    !isQubitIndexValid(firstQubit, circuit.logical_qubits) ||
    !isQubitIndexValid(secondQubit, circuit.logical_qubits) ||
    firstQubit === secondQubit
  ) {
    return circuit
  }
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )
  const candidate = createPairGate(firstQubit, secondQubit, durationUs, gateId, gateType)
  if (!canPlaceGateInColumn(normalizedCircuit, columnIndex, candidate).valid) {
    return circuit
  }
  return {
    ...normalizedCircuit,
    columns: normalizedCircuit.columns.map((column, index) =>
      index === columnIndex
        ? { ...column, gates: sortCircuitColumnGates([...column.gates, candidate]) }
        : column,
    ),
  }
}

export function placePairGateFromDropInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  qubitIndex: number,
  durationUs: number,
  gateId: string,
  gateType: PairGateType = 'SWAP',
): CircuitEditorState {
  const placement = resolveCnotDropPlacement(qubitIndex, circuit.logical_qubits)
  return placePairGateInCircuit(
    circuit,
    columnCount,
    columnIndex,
    placement.controlQubit,
    placement.targetQubit,
    durationUs,
    gateId,
    gateType,
  )
}

export function movePairGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  gateId: string,
  targetColumnIndex: number,
  targetQubitIndex: number,
): CircuitEditorState {
  if (!isQubitIndexValid(targetQubitIndex, circuit.logical_qubits)) {
    return circuit
  }
  const sourceLocation = findGateLocationById(circuit, gateId)
  if (sourceLocation === null || !isPairGateType(sourceLocation.gate.type)) {
    return circuit
  }
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, targetColumnIndex + 1),
  )
  const targetPlacement = resolveCnotDropPlacement(
    targetQubitIndex,
    normalizedCircuit.logical_qubits,
  )
  const movedGate: CircuitGate = {
    ...sourceLocation.gate,
    controls: [],
    targets: [targetPlacement.controlQubit, targetPlacement.targetQubit],
    params: sourceLocation.gate.params === undefined
      ? undefined
      : { ...sourceLocation.gate.params },
  }
  if (!canPlaceGateInColumn(
    normalizedCircuit,
    targetColumnIndex,
    movedGate,
    gateId,
  ).valid) {
    return circuit
  }
  if (
    sourceLocation.columnIndex === targetColumnIndex &&
    sourceLocation.gate.targets[0] === movedGate.targets[0] &&
    sourceLocation.gate.targets[1] === movedGate.targets[1]
  ) {
    return circuit
  }
  return {
    ...normalizedCircuit,
    columns: normalizedCircuit.columns.map((column, index) => {
      const gates = column.gates.filter((gate) => gate.id !== gateId)
      if (index === targetColumnIndex) {
        gates.push(movedGate)
      }
      return { ...column, gates: sortCircuitColumnGates(gates) }
    }),
  }
}

export function placeCcxGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  controlA: number,
  controlB: number,
  targetQubit: number,
  durationUs: number,
  gateId: string,
  gateType: MultiControlledGateType = 'CCX',
): CircuitEditorState {
  const qubits = [controlA, controlB, targetQubit]
  if (
    new Set(qubits).size !== 3 ||
    qubits.some((qubit) => !isQubitIndexValid(qubit, circuit.logical_qubits))
  ) {
    return circuit
  }
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )
  const candidate = createCcxGate(
    controlA, controlB, targetQubit, durationUs, gateId, gateType,
  )
  if (!canPlaceGateInColumn(normalizedCircuit, columnIndex, candidate).valid) {
    return circuit
  }
  return {
    ...normalizedCircuit,
    columns: normalizedCircuit.columns.map((column, index) =>
      index === columnIndex
        ? { ...column, gates: sortCircuitColumnGates([...column.gates, candidate]) }
        : column,
    ),
  }
}

export function placeCcxGateFromDropInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  columnIndex: number,
  qubitIndex: number,
  durationUs: number,
  gateId: string,
): CircuitEditorState {
  const placement = resolveCcxDropPlacement(qubitIndex, circuit.logical_qubits)
  return placeCcxGateInCircuit(
    circuit,
    columnCount,
    columnIndex,
    placement.controlA,
    placement.controlB,
    placement.targetQubit,
    durationUs,
    gateId,
  )
}

export function moveCcxGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  gateId: string,
  targetColumnIndex: number,
  targetQubitIndex: number,
): CircuitEditorState {
  const sourceLocation = findGateLocationById(circuit, gateId)
  if (sourceLocation === null || !isMultiControlledGateType(sourceLocation.gate.type)) {
    return circuit
  }
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, targetColumnIndex + 1),
  )
  const placement = resolveCcxDropPlacement(
    targetQubitIndex,
    normalizedCircuit.logical_qubits,
  )
  if (new Set([placement.controlA, placement.controlB, placement.targetQubit]).size !== 3) {
    return circuit
  }
  const movedGate: CircuitGate = {
    ...sourceLocation.gate,
    controls: [placement.controlA, placement.controlB],
    targets: [placement.targetQubit],
    params: sourceLocation.gate.params === undefined
      ? undefined
      : { ...sourceLocation.gate.params },
  }
  if (!canPlaceGateInColumn(
    normalizedCircuit,
    targetColumnIndex,
    movedGate,
    gateId,
  ).valid) {
    return circuit
  }
  const sourceQubits = [
    ...(sourceLocation.gate.controls ?? []),
    ...sourceLocation.gate.targets,
  ]
  const movedQubits = [...movedGate.controls ?? [], ...movedGate.targets]
  if (
    sourceLocation.columnIndex === targetColumnIndex &&
    sourceQubits.every((qubit, index) => qubit === movedQubits[index])
  ) {
    return circuit
  }
  return {
    ...normalizedCircuit,
    columns: normalizedCircuit.columns.map((column, index) => {
      const gates = column.gates.filter((gate) => gate.id !== gateId)
      if (index === targetColumnIndex) {
        gates.push(movedGate)
      }
      return { ...column, gates: sortCircuitColumnGates(gates) }
    }),
  }
}

export function moveCnotGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  gateId: string,
  targetColumnIndex: number,
  targetQubitIndex: number,
): CircuitEditorState {
  if (!isQubitIndexValid(targetQubitIndex, circuit.logical_qubits)) {
    return circuit
  }

  const sourceLocation = findGateLocationById(circuit, gateId)
  if (sourceLocation === null || !isControlledGateType(sourceLocation.gate.type)) {
    return circuit
  }

  const sourceControls = sourceLocation.gate.controls ?? []
  const sourceTargets = sourceLocation.gate.targets
  if (sourceControls.length !== 1 || sourceTargets.length !== 1) {
    return circuit
  }

  const targetPlacement = resolveCnotDropPlacement(
    targetQubitIndex,
    circuit.logical_qubits,
  )
  if (
    sourceLocation.columnIndex === targetColumnIndex &&
    sourceControls[0] === targetPlacement.controlQubit &&
    sourceTargets[0] === targetPlacement.targetQubit
  ) {
    return circuit
  }

  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, targetColumnIndex + 1),
  )

  const movedTargetPlacement = resolveCnotDropPlacement(
    targetQubitIndex,
    normalizedCircuit.logical_qubits,
  )
  const movedGate: CircuitGate = {
    ...sourceLocation.gate,
    controls: [movedTargetPlacement.controlQubit],
    targets: [movedTargetPlacement.targetQubit],
    params:
      sourceLocation.gate.params === undefined
        ? undefined
        : { ...sourceLocation.gate.params },
  }
  const placement = canPlaceGateInColumn(
    normalizedCircuit,
    targetColumnIndex,
    movedGate,
    gateId,
  )
  if (!placement.valid) {
    return circuit
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    const remainingGates = column.gates.filter((gate) => {
      return gate.id !== gateId
    })

    if (index === targetColumnIndex) {
      remainingGates.push(movedGate)
    }

    return {
      ...column,
      gates: sortCircuitColumnGates(remainingGates),
    }
  })

  return {
    ...normalizedCircuit,
    columns: nextColumns,
  }
}

export function removeGateById(
  circuit: CircuitEditorState,
  gateId: string,
): CircuitEditorState {
  return {
    ...circuit,
    columns: circuit.columns.map((column) => ({
      ...column,
      gates: column.gates.filter((gate) => gate.id !== gateId),
    })),
  }
}

export function updateGateParamsById(
  circuit: CircuitEditorState,
  gateId: string,
  params: CircuitGateParams,
): CircuitEditorState {
  let changed = false
  const columns = circuit.columns.map((column) => ({
    ...column,
    gates: column.gates.map((gate) => {
      if (gate.id !== gateId) {
        return gate
      }
      changed = true
      return {
        ...gate,
        params: { ...(gate.params ?? {}), ...params },
      }
    }),
  }))
  return changed ? { ...circuit, columns } : circuit
}

export function clearCircuit(
  circuit: CircuitEditorState,
  columnCount = Math.max(1, circuit.columns.length),
): CircuitEditorState {
  return {
    ...circuit,
    columns: Array.from({ length: columnCount }, (_, step) => createEmptyCircuitColumn(step)),
  }
}

export function isCircuitEmpty(circuit: CircuitEditorState) {
  return circuit.columns.every((column) => column.gates.length === 0)
}

export function getGateIdAtSlot(
  circuit: CircuitEditorState,
  columnIndex: number,
  qubitIndex: number,
) {
  const column = circuit.columns[columnIndex]
  if (!column) {
    return null
  }

  const singleGate = column.gates.find(
    (gate) => !isMultiQubitGateType(gate.type) && gate.targets.includes(qubitIndex),
  )
  if (singleGate) {
    return singleGate.id
  }

  const cnotGate = column.gates.find(
    (gate) => isMultiQubitGateType(gate.type) && (gate.controls ?? []).concat(gate.targets).includes(qubitIndex),
  )
  return cnotGate ? cnotGate.id : null
}

export function getSelectedGateTypeFromGate(
  circuit: CircuitEditorState,
  gateId: string,
) {
  const gate = circuit.columns
    .flatMap((column) => column.gates)
    .find((candidate) => candidate.id === gateId)

  return gate?.type ?? null
}
