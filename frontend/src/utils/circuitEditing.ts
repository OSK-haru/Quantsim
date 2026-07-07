import type {
  CircuitColumn,
  CircuitEditorState,
  CircuitGate,
  SingleQubitGateType,
} from '../types/circuit'

export const EDITOR_COLUMN_COUNT = 4

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
    params: { duration_us: durationUs },
  }
}

export function createCnotGate(
  controlQubit: number,
  targetQubit: number,
  durationUs: number,
  gateId: string,
): CircuitGate {
  return {
    id: gateId,
    type: 'CNOT',
    controls: [controlQubit],
    targets: [targetQubit],
    params: { duration_us: durationUs },
  }
}

function resolveCnotDropPlacement(qubitIndex: number) {
  // The editor currently targets a 2-qubit Bell circuit, so the drop rule
  // is intentionally simple and predictable.
  return qubitIndex === 0
    ? { controlQubit: 0, targetQubit: 1 }
    : { controlQubit: 1, targetQubit: 0 }
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

export function sortCircuitColumnGates(gates: CircuitGate[]) {
  return [...gates].sort((left, right) => {
    const leftPriority = left.type === 'CNOT' ? 1 : 0
    const rightPriority = right.type === 'CNOT' ? 1 : 0
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    const leftTarget = left.targets[0] ?? -1
    const rightTarget = right.targets[0] ?? -1
    return leftTarget - rightTarget || left.type.localeCompare(right.type)
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
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    if (index !== columnIndex) {
      return column
    }

    const remainingGates = column.gates.filter((gate) => {
      if (gate.type === 'CNOT') {
        return false
      }

      return !gate.targets.includes(qubitIndex)
    })

    remainingGates.push(
      createPlacedGate(gateType, qubitIndex, durationUs, gateId),
    )

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
  const sourceGate = circuit.columns
    .flatMap((column) => column.gates)
    .find((gate) => gate.id === gateId && gate.type !== 'CNOT')

  if (!sourceGate || sourceGate.type === 'CNOT') {
    return circuit
  }

  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, targetColumnIndex + 1),
  )

  const movedGate: CircuitGate = {
    ...sourceGate,
    targets: [targetQubitIndex],
    controls: [],
    params: sourceGate.params === undefined ? undefined : { ...sourceGate.params },
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    const remainingGates = column.gates.filter((gate) => {
      if (gate.id === gateId) {
        return false
      }

      if (index !== targetColumnIndex) {
        return true
      }

      if (gate.type === 'CNOT') {
        return false
      }

      return !gate.targets.includes(targetQubitIndex)
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
): CircuitEditorState {
  const normalizedCircuit = ensureCircuitColumnCount(
    circuit,
    Math.max(columnCount, columnIndex + 1),
  )

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    if (index !== columnIndex) {
      return column
    }

    const remainingGates = column.gates.filter((gate) => {
      if (gate.type === 'CNOT') {
        return false
      }

      return !gate.targets.includes(controlQubit) && !gate.targets.includes(targetQubit)
    })

    remainingGates.push(
      createCnotGate(controlQubit, targetQubit, durationUs, gateId),
    )

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
): CircuitEditorState {
  const placement = resolveCnotDropPlacement(qubitIndex)
  return placeCnotGateInCircuit(
    circuit,
    columnCount,
    columnIndex,
    placement.controlQubit,
    placement.targetQubit,
    durationUs,
    gateId,
  )
}

export function moveCnotGateInCircuit(
  circuit: CircuitEditorState,
  columnCount: number,
  gateId: string,
  targetColumnIndex: number,
  targetQubitIndex: number,
): CircuitEditorState {
  const sourceLocation = findGateLocationById(circuit, gateId)
  if (sourceLocation === null || sourceLocation.gate.type !== 'CNOT') {
    return circuit
  }

  const sourceControls = sourceLocation.gate.controls ?? []
  const sourceTargets = sourceLocation.gate.targets
  if (sourceControls.length !== 1 || sourceTargets.length !== 1) {
    return circuit
  }

  const targetPlacement = resolveCnotDropPlacement(targetQubitIndex)
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

  const movedGate: CircuitGate = {
    ...sourceLocation.gate,
    controls: [targetPlacement.controlQubit],
    targets: [targetPlacement.targetQubit],
    params:
      sourceLocation.gate.params === undefined
        ? undefined
        : { ...sourceLocation.gate.params },
  }

  const nextColumns = normalizedCircuit.columns.map((column, index) => {
    const remainingGates = column.gates.filter((gate) => {
      if (gate.id === gateId) {
        return false
      }

      if (index !== targetColumnIndex) {
        return true
      }

      if (gate.type === 'CNOT') {
        return false
      }

      return !gate.targets.includes(targetPlacement.controlQubit) &&
        !gate.targets.includes(targetPlacement.targetQubit)
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

export function clearCircuit(
  circuit: CircuitEditorState,
  columnCount = EDITOR_COLUMN_COUNT,
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
    (gate) => gate.type !== 'CNOT' && gate.targets.includes(qubitIndex),
  )
  if (singleGate) {
    return singleGate.id
  }

  const cnotGate = column.gates.find(
    (gate) => gate.type === 'CNOT' && (gate.controls ?? []).concat(gate.targets).includes(qubitIndex),
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
