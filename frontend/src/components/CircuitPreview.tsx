import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import './CircuitPreview.css'
import type {
  CircuitEditorState,
  CircuitGate,
  DragGatePayload,
  GateType,
} from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import { getGateIdAtSlot } from '../utils/circuitEditing'
import {
  CIRCUIT_CELL_HEIGHT,
  CIRCUIT_CELL_WIDTH,
  CIRCUIT_LABEL_RAIL_WIDTH,
  CIRCUIT_LEFT_PADDING,
  CIRCUIT_TOP_PADDING,
} from '../utils/circuitViewport'
import { setCircuitDragPreview } from '../utils/dragPreview'

type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
}

type CircuitPreviewProps = {
  circuit: CircuitEditorState
  gateDurationDefaults?: GateDurationDefaults
  selectedGateType?: GateType | null
  selectedGateId?: string | null
  pendingCnotControl?: PendingCnotControl | null
  dragPayload?: DragGatePayload | null
  zoom?: number
  scrollToEndToken?: number
  viewportRef?: RefObject<HTMLDivElement | null>
  highlightedColumnIndex?: number | null
  onViewportScroll?: () => void
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

function formatDurationLabel(duration: number) {
  const fixed = duration < 0.01 && duration > 0 ? duration.toFixed(3) : duration.toFixed(2)
  return `${fixed.replace(/\.?0+$/, '')}us`
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

function getColumnCnotGates(column: CircuitEditorState['columns'][number]) {
  return column.gates.filter((gate) => gate.type === 'CNOT')
}

function getCnotQubits(cnotGate: CircuitGate) {
  return [...(cnotGate.controls ?? []), ...cnotGate.targets]
}

function getCnotGateAtQubit(cnotGates: CircuitGate[], qubitIndex: number) {
  return cnotGates.find((gate) => getCnotQubits(gate).includes(qubitIndex)) ?? null
}

export function CircuitPreview({
  circuit,
  gateDurationDefaults,
  selectedGateType,
  selectedGateId,
  pendingCnotControl,
  dragPayload,
  zoom = 1,
  scrollToEndToken = 0,
  viewportRef,
  highlightedColumnIndex = null,
  onViewportScroll,
  onSlotClick,
  onGateSelect,
  onCircuitGateDragStart,
  onDragEnd,
  onSlotDrop,
}: CircuitPreviewProps) {
  const [dragHoverSlot, setDragHoverSlot] = useState<PendingCnotControl | null>(null)
  const internalViewportRef = useRef<HTMLDivElement | null>(null)
  const activeViewportRef = viewportRef ?? internalViewportRef
  const previousColumnCountRef = useRef<number>(Math.max(1, circuit.columns.length))
  const previousScrollTokenRef = useRef(scrollToEndToken)
  const visibleColumnCount = Math.max(1, circuit.columns.length)
  const wireWidth = visibleColumnCount * CIRCUIT_CELL_WIDTH + CIRCUIT_LEFT_PADDING + 28
  const height = Math.max(220, circuit.logical_qubits * CIRCUIT_CELL_HEIGHT + 48)
  const renderedWireWidth = wireWidth * zoom
  const renderedHeight = height * zoom
  const yForQubit = (qubit: number) => CIRCUIT_TOP_PADDING + qubit * CIRCUIT_CELL_HEIGHT
  const isCircuitDragActive = dragPayload?.source === 'circuit'

  useEffect(() => {
    const previousColumnCount = previousColumnCountRef.current
    const tokenChanged = scrollToEndToken !== previousScrollTokenRef.current

    if (tokenChanged && visibleColumnCount > previousColumnCount) {
      const animationFrameId = window.requestAnimationFrame(() => {
        const viewport = activeViewportRef.current
        if (viewport) {
          viewport.scrollTo({
            left: viewport.scrollWidth,
            behavior: 'smooth',
          })
        }
      })

      previousColumnCountRef.current = visibleColumnCount
      previousScrollTokenRef.current = scrollToEndToken
      return () => window.cancelAnimationFrame(animationFrameId)
    }

    previousScrollTokenRef.current = scrollToEndToken
    previousColumnCountRef.current = visibleColumnCount
  }, [activeViewportRef, scrollToEndToken, visibleColumnCount])

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
    event.stopPropagation()
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
      <div
        className="circuit-preview__viewport"
        ref={activeViewportRef}
        onScroll={onViewportScroll}
      >
        <div
          className="circuit-preview__canvas"
          style={{ width: renderedWireWidth, height: renderedHeight }}
        >
          <div
            className="circuit-preview__label-rail"
            style={{
              width: CIRCUIT_LABEL_RAIL_WIDTH * zoom,
              height: renderedHeight,
            }}
            aria-hidden="true"
          >
            {Array.from({ length: circuit.logical_qubits }).map((_, qubit) => (
              <span
                key={qubit}
                className="circuit-preview__label-rail-item"
                style={{
                  top: (yForQubit(qubit) - 12) * zoom,
                  left: 18 * zoom,
                  height: 24 * zoom,
                  fontSize: 14 * zoom,
                }}
              >
                q{qubit}
              </span>
            ))}
          </div>
          <svg
            className="circuit-preview__svg"
            viewBox={`0 0 ${wireWidth} ${height}`}
            width={renderedWireWidth}
            height={renderedHeight}
            role="img"
            aria-label="Circuit preview from editor state"
          >
            {Array.from({ length: visibleColumnCount }).map((_, columnIndex) => {
              const column = circuit.columns[columnIndex] ?? {
                step: columnIndex,
                gates: [],
              }
              const x = CIRCUIT_LEFT_PADDING + 20 + columnIndex * CIRCUIT_CELL_WIDTH
              const columnLeft = x - CIRCUIT_CELL_WIDTH / 2
              const isHighlightedColumn = highlightedColumnIndex === columnIndex

              return (
                <g key={`column-header-${column.step}-${columnIndex}`}>
                  <rect
                    x={columnLeft}
                    y="4"
                    width={CIRCUIT_CELL_WIDTH}
                    height={height - 12}
                    className={`circuit-preview__column-band${
                      columnIndex % 2 === 1 ? ' circuit-preview__column-band--alternate' : ''
                    }${column.gates.length === 0 ? ' circuit-preview__column-band--empty' : ''}${
                      isHighlightedColumn ? ' circuit-preview__column-band--highlighted' : ''
                    }`}
                  />
                  <line
                    x1={columnLeft + CIRCUIT_CELL_WIDTH}
                    y1="10"
                    x2={columnLeft + CIRCUIT_CELL_WIDTH}
                    y2={height - 14}
                    className={`circuit-preview__column-divider${
                      (columnIndex + 1) % 4 === 0
                        ? ' circuit-preview__column-divider--major'
                        : ''
                    }`}
                  />
                  <text
                    x={x}
                    y="22"
                    textAnchor="middle"
                    className="circuit-preview__column-index"
                  >
                    {columnIndex + 1}
                  </text>
                </g>
              )
            })}
          {Array.from({ length: circuit.logical_qubits }).map((_, qubit) => {
            const y = yForQubit(qubit)
            return (
              <g key={qubit}>
                <line
                  x1={CIRCUIT_LEFT_PADDING}
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
            const x = CIRCUIT_LEFT_PADDING + 20 + columnIndex * CIRCUIT_CELL_WIDTH
            const cnotGates = getColumnCnotGates(column)

            return (
              <g key={`step-${column.step}-${columnIndex}`}>
                {cnotGates.map((cnotGate) => {
                  const cnotQubits = getCnotQubits(cnotGate)
                  // All gates in a column share the same time slot. Keep every
                  // CNOT on the column center so its connector and symbols stay
                  // aligned with the wires and the slot hit areas.
                  const cnotX = x
                  const isSelectedCnot = selectedGateId === cnotGate.id
                  const cnotDuration = getGateDuration(cnotGate, gateDurationDefaults)
                  const cnotDurationY = cnotQubits.length > 0
                    ? Math.max(...cnotQubits.map(yForQubit)) + 28
                    : CIRCUIT_TOP_PADDING + 28

                  return (
                    <g
                      key={cnotGate.id}
                      className={`circuit-preview__cnot-overlay${
                        isSelectedCnot ? ' circuit-preview__cnot-overlay--selected' : ''
                      }`}
                      style={{ pointerEvents: 'none' }}
                    >
                      {cnotQubits.length >= 2 ? (
                        <line
                          x1={cnotX}
                          y1={Math.min(...cnotQubits.map(yForQubit))}
                          x2={cnotX}
                          y2={Math.max(...cnotQubits.map(yForQubit))}
                          className={`circuit-preview__cnot-line${
                            isSelectedCnot ? ' circuit-preview__cnot-line--selected' : ''
                          }`}
                        />
                      ) : null}
                      {(cnotGate.controls ?? []).map((control) => (
                        <circle
                          key={`${cnotGate.id}-control-${control}`}
                          cx={cnotX}
                          cy={yForQubit(control)}
                          r="8"
                          className={`circuit-preview__control-dot${
                            isSelectedCnot ? ' circuit-preview__control-dot--selected' : ''
                          }`}
                        />
                      ))}
                      {cnotGate.targets.map((target) => {
                        const y = yForQubit(target)
                        return (
                          <g key={`${cnotGate.id}-target-${target}`}>
                            <circle
                              cx={cnotX}
                              cy={y}
                              r="16"
                              className={`circuit-preview__target-ring${
                                isSelectedCnot ? ' circuit-preview__target-ring--selected' : ''
                              }`}
                            />
                            <line
                              x1={cnotX - 10}
                              y1={y}
                              x2={cnotX + 10}
                              y2={y}
                              className={`circuit-preview__target-cross${
                                isSelectedCnot ? ' circuit-preview__target-cross--selected' : ''
                              }`}
                            />
                            <line
                              x1={cnotX}
                              y1={y - 10}
                              x2={cnotX}
                              y2={y + 10}
                              className={`circuit-preview__target-cross${
                                isSelectedCnot ? ' circuit-preview__target-cross--selected' : ''
                              }`}
                            />
                          </g>
                        )
                      })}
                      {isSelectedCnot && cnotDuration != null ? (
                        <g className="circuit-preview__duration-badge">
                          <rect
                            x={cnotX - 24}
                            y={cnotDurationY - 10}
                            width="48"
                            height="16"
                            rx="8"
                            className="circuit-preview__duration-badge-bg"
                          />
                          <text
                            x={cnotX}
                            y={cnotDurationY + 2}
                            textAnchor="middle"
                            className="circuit-preview__duration-badge-text"
                          >
                            {formatDurationLabel(cnotDuration)}
                          </text>
                        </g>
                      ) : null}
                    </g>
                  )
                })}

                {Array.from({ length: circuit.logical_qubits }).map((_, qubitIndex) => {
                  const y = yForQubit(qubitIndex)
                  const gate = getColumnSingleGate(column, qubitIndex)
                  const gateIdAtSlot = getGateIdAtSlot(circuit, columnIndex, qubitIndex)
                  const cnotGateAtSlot = getCnotGateAtQubit(cnotGates, qubitIndex)
                  const cnotQubitsAtSlot = cnotGateAtSlot ? getCnotQubits(cnotGateAtSlot) : []
                  const hasCnotOccupancy = cnotGateAtSlot !== null
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
                    dragPayload?.source === 'circuit' && dragPayload.gateId === cnotGateAtSlot?.id
                  const isDropTarget = Boolean(dragPayload && onSlotDrop)
                  const isDropHovered =
                    dragHoverSlot?.columnIndex === columnIndex &&
                    dragHoverSlot.qubitIndex === qubitIndex
                  const isSameDraggedGate =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === gateIdAtSlot
                  const isInvalidDropTarget =
                    isDropTarget && Boolean(gate || hasCnotOccupancy) && !isSameDraggedGate
                  const interactive = Boolean(selectedGateType && onSlotClick)
                  const selectable = Boolean(!selectedGateType && gateIdAtSlot && onGateSelect)
                  const isClickable = interactive || selectable
                  const selectedGateDuration = gate && isSelectedGate
                    ? getGateDuration(gate, gateDurationDefaults)
                    : null
                  const slotLabel = gate
                    ? `${gate.type} gate at q${qubitIndex}, column ${columnIndex}`
                    : hasCnotOccupancy
                      ? `CNOT slot at q${qubitIndex}, column ${columnIndex}`
                      : `Empty slot at q${qubitIndex}, column ${columnIndex}`
                  const dragGate = gate ?? cnotGateAtSlot

                  return (
                    <g
                      key={`${columnIndex}-${qubitIndex}`}
                      className={`circuit-preview__slot-group${
                        interactive ? ' circuit-preview__slot-group--interactive' : ''
                      }${gate || hasCnotOccupancy ? ' circuit-preview__slot-group--occupied' : ''}${
                        isDropTarget ? ' circuit-preview__slot-group--drop-target' : ''
                      }${
                        isInvalidDropTarget ? ' circuit-preview__slot-group--invalid-drop-target' : ''
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
                      {...(dragGate ? { draggable: true } : {})}
                      onDragStart={
                        dragGate
                          ? (event) =>
                              handleCircuitDragStart(
                                event,
                                dragGate.id,
                                dragGate.type,
                                columnIndex,
                                qubitIndex,
                              )
                          : undefined
                      }
                      onDragEnd={
                        dragGate
                          ? () => {
                              setDragHoverSlot(null)
                              onDragEnd?.()
                            }
                          : undefined
                      }
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
                          isInvalidDropTarget ? ' circuit-preview__slot--invalid-drop-target' : ''
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
                      {cnotGateAtSlot && cnotGateAtSlot.controls?.includes(qubitIndex) ? (
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
                              cnotGateAtSlot.id,
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
                      {cnotGateAtSlot && cnotGateAtSlot.targets.includes(qubitIndex) ? (
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
                              cnotGateAtSlot.id,
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
                      {cnotGateAtSlot && cnotQubitsAtSlot.includes(qubitIndex) ? (
                        <rect
                          x={x - 24}
                          y={Math.min(...cnotQubitsAtSlot.map(yForQubit)) - 28}
                          width="48"
                          height={Math.max(...cnotQubitsAtSlot.map(yForQubit)) - Math.min(...cnotQubitsAtSlot.map(yForQubit)) + 56}
                          rx="16"
                          className={`circuit-preview__cnot-hit-area${
                            isDraggedCnot ? ' circuit-preview__cnot-hit-area--dragging' : ''
                          }`}
                          {...{ draggable: true }}
                          onDragStart={(event) =>
                            handleCircuitDragStart(
                              event,
                              cnotGateAtSlot.id,
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
                          y={selectedGateDuration != null ? y - 3 : y + 5}
                          textAnchor="middle"
                          className="circuit-preview__gate-label"
                        >
                          {getGateLabel(gate)}
                        </text>
                      ) : null}
                      {selectedGateDuration != null ? (
                        <text
                          x={x}
                          y={y + 10}
                          textAnchor="middle"
                          className="circuit-preview__gate-duration-label"
                        >
                          {formatDurationLabel(selectedGateDuration)}
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
      </div>
    </section>
  )
}
