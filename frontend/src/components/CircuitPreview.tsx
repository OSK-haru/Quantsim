import { useState, type DragEvent, type KeyboardEvent } from 'react'
import './CircuitPreview.css'
import type {
  CircuitEditorState,
  CircuitGate,
  DragGatePayload,
  GateType,
} from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import { getGateIdAtSlot } from '../utils/circuitEditing'
import { setCircuitDragPreview } from '../utils/dragPreview'

type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
}

type CircuitPreviewProps = {
  circuit: CircuitEditorState
  gateDurationDefaults?: GateDurationDefaults
  columnCount?: number
  selectedGateType?: GateType | null
  selectedGateId?: string | null
  pendingCnotControl?: PendingCnotControl | null
  dragPayload?: DragGatePayload | null
  onSlotClick?: (columnIndex: number, qubitIndex: number) => void
  onGateSelect?: (gateId: string | null) => void
  onCircuitGateDragStart?: (
    gateId: string,
    gateType: GateType,
    columnIndex: number,
    qubitIndex: number,
  ) => void
  onDragEnd?: () => void
  onSlotDrop?: (columnIndex: number, qubitIndex: number) => void
}

const CELL_WIDTH = 136
const CELL_HEIGHT = 84
const LEFT_PADDING = 84
const TOP_PADDING = 56
const SLOT_SIZE = 42

function getGateLabel(gate: CircuitGate) {
  return gate.type === 'MEASURE' ? 'M' : gate.type
}

function getGateDuration(gate: CircuitGate, gateDurationDefaults?: GateDurationDefaults) {
  if (gate.params?.duration_us !== undefined) {
    return gate.params.duration_us
  }

  return gateDurationDefaults?.[gate.type] ?? null
}

function getColumnSingleGate(
  column: CircuitEditorState['columns'][number],
  qubitIndex: number,
) {
  return (
    column.gates.find((gate) => gate.type !== 'CNOT' && gate.targets.includes(qubitIndex)) ??
    null
  )
}

function getColumnCnotGate(column: CircuitEditorState['columns'][number]) {
  return column.gates.find((gate) => gate.type === 'CNOT') ?? null
}

function getCnotQubits(cnotGate: CircuitGate | null) {
  if (cnotGate === null) {
    return []
  }

  return [...(cnotGate.controls ?? []), ...cnotGate.targets]
}

export function CircuitPreview({
  circuit,
  gateDurationDefaults,
  columnCount,
  selectedGateType,
  selectedGateId,
  pendingCnotControl,
  dragPayload,
  onSlotClick,
  onGateSelect,
  onCircuitGateDragStart,
  onDragEnd,
  onSlotDrop,
}: CircuitPreviewProps) {
  const [dragHoverSlot, setDragHoverSlot] = useState<PendingCnotControl | null>(null)
  const visibleColumnCount = Math.max(columnCount ?? circuit.columns.length, circuit.columns.length)
  const wireWidth = visibleColumnCount * CELL_WIDTH + LEFT_PADDING + 28
  const height = Math.max(220, circuit.logical_qubits * CELL_HEIGHT + 48)
  const yForQubit = (qubit: number) => TOP_PADDING + qubit * CELL_HEIGHT
  const isCircuitDragActive = dragPayload?.source === 'circuit'
  const dragStatusLabel = dragPayload ? `Dragging ${dragPayload.gateType}` : null

  function handleSlotClick(columnIndex: number, qubitIndex: number) {
    if (!selectedGateType || !onSlotClick) {
      return
    }

    onSlotClick(columnIndex, qubitIndex)
  }

  function handleSlotKeyDown(
    event: KeyboardEvent<SVGGElement>,
    columnIndex: number,
    qubitIndex: number,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleSlotClick(columnIndex, qubitIndex)
    }
  }

  function handleSlotDragOver(event: DragEvent<SVGGElement>) {
    if (!dragPayload || !onSlotDrop) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = dragPayload.source === 'palette' ? 'copy' : 'move'
  }

  function handleSlotDrop(
    event: DragEvent<SVGGElement>,
    columnIndex: number,
    qubitIndex: number,
  ) {
    if (!dragPayload || !onSlotDrop) {
      return
    }

    event.preventDefault()
    setDragHoverSlot(null)
    onSlotDrop(columnIndex, qubitIndex)
  }

  function handleCircuitDragStart(
    event: DragEvent<SVGElement>,
    gateId: string,
    gateType: GateType,
    columnIndex: number,
    qubitIndex: number,
  ) {
    if (!onCircuitGateDragStart) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', `circuit:${gateId}`)
    setCircuitDragPreview(event, gateType, gateType === 'CNOT' ? 'cnot' : 'gate')
    onCircuitGateDragStart(gateId, gateType, columnIndex, qubitIndex)
  }

  return (
    <section
      className={`circuit-preview${isCircuitDragActive ? ' circuit-preview--dragging' : ''}`}
      aria-label="Circuit preview"
    >
      <div className="circuit-preview__header">
        <div>
          <div className="circuit-preview__eyebrow">Preview</div>
          <h2 className="circuit-preview__title">Circuit preview</h2>
          <p className="circuit-preview__subtitle">
            Bell circuit represented by React editor state.
            {dragStatusLabel ? (
              <span className="circuit-preview__drag-note">
                <strong>{dragStatusLabel}</strong>
                {isCircuitDragActive
                  ? ' - drop on a slot to move, or release outside to delete.'
                  : ' - drop on a circuit slot to place.'}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="circuit-preview__viewport">
        <svg
          className="circuit-preview__svg"
          viewBox={`0 0 ${wireWidth} ${height}`}
          role="img"
          aria-label="Bell circuit preview from editor state"
        >
          {Array.from({ length: circuit.logical_qubits }).map((_, qubit) => {
            const y = yForQubit(qubit)
            return (
              <g key={qubit}>
                <text x="20" y={y + 6} className="circuit-preview__qubit-label">
                  q{qubit}
                </text>
                <line
                  x1={LEFT_PADDING}
                  y1={y}
                  x2={wireWidth - 20}
                  y2={y}
                  className="circuit-preview__wire"
                />
              </g>
            )
          })}

          {Array.from({ length: visibleColumnCount }).map((_, columnIndex) => {
            const column = circuit.columns[columnIndex] ?? {
              step: columnIndex,
              gates: [],
            }
            const x = LEFT_PADDING + 20 + columnIndex * CELL_WIDTH
            const cnotGate = getColumnCnotGate(column)
            const cnotQubits = getCnotQubits(cnotGate)
            const firstDuration = column.gates
              .map((gate) => getGateDuration(gate, gateDurationDefaults))
              .find((duration) => duration !== null)

            return (
              <g key={`step-${column.step}-${columnIndex}`}>
                {firstDuration != null ? (
                  <text x={x + 6} y="24" className="circuit-preview__duration">
                    {firstDuration.toFixed(2)} us
                  </text>
                ) : null}

                {cnotGate !== null ? (
                  <g
                    className={`circuit-preview__cnot-overlay${
                      selectedGateId === cnotGate.id ? ' circuit-preview__cnot-overlay--selected' : ''
                    }`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {cnotQubits.length >= 2 ? (
                      <line
                        x1={x}
                        y1={Math.min(...cnotQubits.map(yForQubit))}
                        x2={x}
                        y2={Math.max(...cnotQubits.map(yForQubit))}
                        className={`circuit-preview__cnot-line${
                          selectedGateId === cnotGate.id
                            ? ' circuit-preview__cnot-line--selected'
                            : ''
                        }`}
                      />
                    ) : null}
                    {(cnotGate.controls ?? []).map((control) => (
                      <circle
                        key={`${cnotGate.id}-control-${control}`}
                        cx={x}
                        cy={yForQubit(control)}
                        r="8"
                        className={`circuit-preview__control-dot${
                          selectedGateId === cnotGate.id
                            ? ' circuit-preview__control-dot--selected'
                            : ''
                        }`}
                      />
                    ))}
                    {cnotGate.targets.map((target) => {
                      const y = yForQubit(target)
                      return (
                        <g key={`${cnotGate.id}-target-${target}`}>
                          <circle
                            cx={x}
                            cy={y}
                            r="16"
                            className={`circuit-preview__target-ring${
                              selectedGateId === cnotGate.id
                                ? ' circuit-preview__target-ring--selected'
                                : ''
                            }`}
                          />
                          <line
                            x1={x - 10}
                            y1={y}
                            x2={x + 10}
                            y2={y}
                            className={`circuit-preview__target-cross${
                              selectedGateId === cnotGate.id
                                ? ' circuit-preview__target-cross--selected'
                                : ''
                            }`}
                          />
                          <line
                            x1={x}
                            y1={y - 10}
                            x2={x}
                            y2={y + 10}
                            className={`circuit-preview__target-cross${
                              selectedGateId === cnotGate.id
                                ? ' circuit-preview__target-cross--selected'
                                : ''
                            }`}
                          />
                        </g>
                      )
                    })}
                  </g>
                ) : null}

                {Array.from({ length: circuit.logical_qubits }).map((_, qubitIndex) => {
                  const y = yForQubit(qubitIndex)
                  const gate = getColumnSingleGate(column, qubitIndex)
                  const gateIdAtSlot = getGateIdAtSlot(circuit, columnIndex, qubitIndex)
                  const hasCnotOccupancy = cnotQubits.includes(qubitIndex)
                  const isPendingControl =
                    pendingCnotControl?.columnIndex === columnIndex &&
                    pendingCnotControl.qubitIndex === qubitIndex
                  const isPendingTargetCandidate =
                    selectedGateType === 'CNOT' &&
                    pendingCnotControl?.columnIndex === columnIndex &&
                    pendingCnotControl.qubitIndex !== qubitIndex
                  const isSelectedGate = selectedGateId === gateIdAtSlot
                  const isDraggedGate =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === gateIdAtSlot
                  const isDraggedCnot =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === cnotGate?.id
                  const isDropTarget = Boolean(dragPayload && onSlotDrop)
                  const isDropHovered =
                    dragHoverSlot?.columnIndex === columnIndex &&
                    dragHoverSlot.qubitIndex === qubitIndex
                  const interactive = Boolean(selectedGateType && onSlotClick)
                  const selectable = Boolean(!selectedGateType && gateIdAtSlot && onGateSelect)
                  const isClickable = interactive || selectable
                  const slotLabel = gate
                    ? `${gate.type} gate at q${qubitIndex}, column ${columnIndex}`
                    : hasCnotOccupancy
                      ? `CNOT slot at q${qubitIndex}, column ${columnIndex}`
                      : `Empty slot at q${qubitIndex}, column ${columnIndex}`

                  return (
                    <g
                      key={`${columnIndex}-${qubitIndex}`}
                      className={`circuit-preview__slot-group${
                        interactive ? ' circuit-preview__slot-group--interactive' : ''
                      }${gate || hasCnotOccupancy ? ' circuit-preview__slot-group--occupied' : ''}${
                        isDropTarget ? ' circuit-preview__slot-group--drop-target' : ''
                      }${
                        isDropHovered ? ' circuit-preview__slot-group--drop-hovered' : ''
                      }${
                        isSelectedGate ? ' circuit-preview__slot-group--selected' : ''
                      }${
                        isPendingControl ? ' circuit-preview__slot-group--pending-control' : ''
                      }${
                        isPendingTargetCandidate
                          ? ' circuit-preview__slot-group--pending-target'
                          : ''
                      }${isDraggedGate || isDraggedCnot ? ' circuit-preview__slot-group--dragging' : ''}`}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={slotLabel}
                      onClick={
                        interactive
                          ? () => handleSlotClick(columnIndex, qubitIndex)
                          : selectable && gateIdAtSlot && onGateSelect
                            ? () => onGateSelect(gateIdAtSlot)
                            : undefined
                      }
                      onKeyDown={
                        interactive
                          ? (event) => handleSlotKeyDown(event, columnIndex, qubitIndex)
                          : selectable && gateIdAtSlot && onGateSelect
                            ? (event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  onGateSelect(gateIdAtSlot)
                                }
                              }
                            : undefined
                      }
                      onDragOver={handleSlotDragOver}
                      onDragEnter={() => {
                        if (isDropTarget) {
                          setDragHoverSlot({ columnIndex, qubitIndex })
                        }
                      }}
                      onDragLeave={() => {
                        if (isDropHovered) {
                          setDragHoverSlot(null)
                        }
                      }}
                      onDrop={(event) => handleSlotDrop(event, columnIndex, qubitIndex)}
                    >
                      <rect
                        x={x - SLOT_SIZE / 2}
                        y={y - SLOT_SIZE / 2}
                        width={SLOT_SIZE}
                        height={SLOT_SIZE}
                        rx="8"
                        className={`circuit-preview__slot${
                          gate || hasCnotOccupancy ? ' circuit-preview__slot--occupied' : ''
                        }${interactive ? ' circuit-preview__slot--interactive' : ''}${
                          isDropTarget ? ' circuit-preview__slot--drop-target' : ''
                        }${
                          isDropHovered ? ' circuit-preview__slot--drop-hovered' : ''
                        }${
                          isSelectedGate ? ' circuit-preview__slot--selected' : ''
                        }${
                          isPendingControl ? ' circuit-preview__slot--pending-control' : ''
                        }${
                          isPendingTargetCandidate
                            ? ' circuit-preview__slot--pending-target'
                            : ''
                        }`}
                      />
                      {gate ? (
                        <rect
                          x={x - 18}
                          y={y - 22}
                          width="36"
                          height="36"
                          rx="8"
                          className={`circuit-preview__gate${
                            gate.type === 'MEASURE' ? ' circuit-preview__gate--measure' : ''
                          }${isDraggedGate ? ' circuit-preview__gate--dragging' : ''}`}
                          {...(gate.type !== 'CNOT' ? { draggable: true } : {})}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              gate.id,
                              gate.type,
                              columnIndex,
                              qubitIndex,
                            )
                          }
                          onDragEnd={() => {
                            setDragHoverSlot(null)
                            onDragEnd?.()
                          }}
                        />
                      ) : null}
                      {gate ? (
                        <rect
                          x={x - 24}
                          y={y - 28}
                          width="48"
                          height="48"
                          rx="12"
                          className={`circuit-preview__gate-hit-area${
                            gate.type === 'MEASURE'
                              ? ' circuit-preview__gate-hit-area--measure'
                              : ''
                          }${isDraggedGate ? ' circuit-preview__gate-hit-area--dragging' : ''}`}
                          {...(gate.type !== 'CNOT' ? { draggable: true } : {})}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              gate.id,
                              gate.type,
                              columnIndex,
                              qubitIndex,
                            )
                          }
                          onDragEnd={() => {
                            setDragHoverSlot(null)
                            onDragEnd?.()
                          }}
                        />
                      ) : null}
                      {cnotGate && cnotGate.controls?.includes(qubitIndex) ? (
                        <circle
                          cx={x}
                          cy={y}
                          r="14"
                          className={`circuit-preview__cnot-drag-handle${
                            isDraggedCnot ? ' circuit-preview__cnot-drag-handle--dragging' : ''
                          }`}
                          {...{ draggable: true }}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              cnotGate.id,
                              'CNOT',
                              columnIndex,
                              qubitIndex,
                            )
                          }
                          onDragEnd={() => {
                            setDragHoverSlot(null)
                            onDragEnd?.()
                          }}
                        />
                      ) : null}
                      {cnotGate && cnotGate.targets.includes(qubitIndex) ? (
                        <circle
                          cx={x}
                          cy={y}
                          r="18"
                          className={`circuit-preview__cnot-drag-handle${
                            isDraggedCnot ? ' circuit-preview__cnot-drag-handle--dragging' : ''
                          }`}
                          {...{ draggable: true }}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              cnotGate.id,
                              'CNOT',
                              columnIndex,
                              qubitIndex,
                            )
                          }
                          onDragEnd={() => {
                            setDragHoverSlot(null)
                            onDragEnd?.()
                          }}
                        />
                      ) : null}
                      {cnotGate && cnotQubits.includes(qubitIndex) ? (
                        <rect
                          x={x - 24}
                          y={Math.min(...cnotQubits.map(yForQubit)) - 28}
                          width="48"
                          height={Math.max(...cnotQubits.map(yForQubit)) - Math.min(...cnotQubits.map(yForQubit)) + 56}
                          rx="16"
                          className={`circuit-preview__cnot-hit-area${
                            isDraggedCnot ? ' circuit-preview__cnot-hit-area--dragging' : ''
                          }`}
                          {...{ draggable: true }}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              cnotGate.id,
                              'CNOT',
                              columnIndex,
                              qubitIndex,
                            )
                          }
                          onDragEnd={() => {
                            setDragHoverSlot(null)
                            onDragEnd?.()
                          }}
                        />
                      ) : null}
                      {gate ? (
                        <text
                          x={x}
                          y={y + 5}
                          textAnchor="middle"
                          className="circuit-preview__gate-label"
                        >
                          {getGateLabel(gate)}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
