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
import {
  formatThetaLabel,
  controlValuesForGate,
  gateThetaRad,
  getGateIdAtSlot,
  isControlledGateType,
  isMultiQubitGateType,
  isPairGateType,
  isRegisterGateType,
  markedBitAt,
  registerDurationUs,
  registerBitWeight,
} from '../utils/circuitEditing'
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
  controlValue?: 0 | 1
  additionalQubits?: number[]
  additionalControlValues?: Array<0 | 1>
}

type CircuitPreviewProps = {
  circuit: CircuitEditorState
  gateDurationDefaults?: GateDurationDefaults
  selectedGateType?: GateType | null
  selectedControlValue?: 0 | 1 | null
  selectedGateId?: string | null
  pendingCnotControl?: PendingCnotControl | null
  dragPayload?: DragGatePayload | null
  zoom?: number
  scrollToEndToken?: number
  viewportRef?: RefObject<HTMLDivElement | null>
  highlightedColumnIndex?: number | null
  highlightedGateSignatures?: string[]
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

  const gateDefault = gateDurationDefaults?.[gate.type]
  if (gateDefault === undefined) {
    return null
  }

  // The QFT default is declared per spanned qubit, not per gate.
  return isRegisterGateType(gate.type)
    ? registerDurationUs(gateDefault, gate.targets.length)
    : gateDefault
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
    column.gates.find((gate) => !isMultiQubitGateType(gate.type) && gate.targets.includes(qubitIndex)) ??
    null
  )
}

function getColumnCnotGates(column: CircuitEditorState['columns'][number]) {
  return column.gates.filter((gate) => isMultiQubitGateType(gate.type))
}

function getCnotQubits(cnotGate: CircuitGate) {
  return [...(cnotGate.controls ?? []), ...cnotGate.targets]
}

function getCnotGateAtQubit(cnotGates: CircuitGate[], qubitIndex: number) {
  return cnotGates.find((gate) => getCnotQubits(gate).includes(qubitIndex)) ?? null
}

function isInsideCnotControlLine(cnotGates: CircuitGate[], qubitIndex: number) {
  return cnotGates.some((gate) => {
    if (gate.type !== 'CNOT') return false
    const qubits = getCnotQubits(gate)
    return (
      qubits.length >= 2 &&
      qubitIndex > Math.min(...qubits) &&
      qubitIndex < Math.max(...qubits) &&
      !qubits.includes(qubitIndex)
    )
  })
}

export function CircuitPreview({
  circuit,
  gateDurationDefaults,
  selectedGateType,
  selectedControlValue = null,
  selectedGateId,
  pendingCnotControl,
  dragPayload,
  zoom = 1,
  scrollToEndToken = 0,
  viewportRef,
  highlightedColumnIndex = null,
  highlightedGateSignatures = [],
  onViewportScroll,
  onSlotClick,
  onGateSelect,
  onCircuitGateDragStart,
  onDragEnd,
  onSlotDrop,
}: CircuitPreviewProps) {
  const [dragHoverSlot, setDragHoverSlot] = useState<PendingCnotControl | null>(null)
  const [hoveredQubitSlot, setHoveredQubitSlot] = useState<{ columnIndex: number; qubitIndex: number } | null>(null)
  const internalViewportRef = useRef<HTMLDivElement | null>(null)
  const activeViewportRef = viewportRef ?? internalViewportRef
  const previousColumnCountRef = useRef<number>(Math.max(1, circuit.columns.length))
  const previousScrollTokenRef = useRef(scrollToEndToken)
  const visibleColumnCount = Math.max(1, circuit.columns.length)
  // While a gate is being dragged, reserve one extra column past the last one so it
  // can be dropped there to grow the circuit instead of only reordering within it.
  const isAddColumnDropVisible = Boolean(dragPayload && onSlotDrop)
  const newColumnIndex = circuit.columns.length
  const wireWidth =
    (visibleColumnCount + (isAddColumnDropVisible ? 1 : 0)) * CIRCUIT_CELL_WIDTH +
    CIRCUIT_LEFT_PADDING +
    28
  const height = Math.max(220, circuit.logical_qubits * CIRCUIT_CELL_HEIGHT + 48)
  const renderedWireWidth = wireWidth * zoom
  const renderedHeight = height * zoom
  const yForQubit = (qubit: number) => CIRCUIT_TOP_PADDING + qubit * CIRCUIT_CELL_HEIGHT
  const isCircuitDragActive = dragPayload?.source === 'circuit'
  const addColumnCenterX = CIRCUIT_LEFT_PADDING + 20 + newColumnIndex * CIRCUIT_CELL_WIDTH
  const addColumnLeft = addColumnCenterX - CIRCUIT_CELL_WIDTH / 2
  const isAddColumnHovered = dragHoverSlot?.columnIndex === newColumnIndex
  const isDrawableGateType = Boolean(
    selectedGateType && (
      isControlledGateType(selectedGateType) ||
      isPairGateType(selectedGateType) ||
      isRegisterGateType(selectedGateType)
    ),
  )
  const isControlMarkerTool = selectedControlValue !== null
  const isHighlightedGate = (gate: CircuitGate) => {
    const qubits = [...(gate.controls ?? []), ...gate.targets].sort((left, right) => left - right)
    return highlightedGateSignatures.includes(`${gate.type}:${qubits.join(',')}`)
  }

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
    event.dataTransfer.dropEffect = dragPayload.source === 'circuit' ? 'move' : 'copy'
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
    setCircuitDragPreview(event, gateType, isMultiQubitGateType(gateType) ? 'cnot' : 'gate')
    onCircuitGateDragStart(gateId, gateType, columnIndex, qubitIndex)
  }

  return (
    <section
      className={`circuit-preview${isCircuitDragActive ? ' circuit-preview--dragging' : ''}`}
      aria-label="Circuit preview"
      data-tutorial-anchor="circuit-canvas"
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
          {isAddColumnDropVisible ? (
            <g key="add-column-zone">
              <rect
                x={addColumnLeft}
                y="4"
                width={CIRCUIT_CELL_WIDTH}
                height={height - 12}
                rx="10"
                className={`circuit-preview__add-column-band${
                  isAddColumnHovered ? ' circuit-preview__add-column-band--hovered' : ''
                }`}
              />
              <text
                x={addColumnCenterX}
                y="22"
                textAnchor="middle"
                className="circuit-preview__add-column-label"
              >
                + 列を追加
              </text>
            </g>
          ) : null}
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

                  // A register gate can skip qubits, so it is drawn as one boxed
                  // cell per member instead of a solid block over the whole
                  // span. QFT cells carry the bit weight k (the qubit holds
                  // 2**k); ORACLE cells carry the bit the marked state needs on
                  // that qubit, which is how an oracle is actually read.
                  if (isRegisterGateType(cnotGate.type)) {
                    const topY = Math.min(...cnotGate.targets.map(yForQubit))
                    const isOracle = cnotGate.type === 'ORACLE'
                    const markedIndex = cnotGate.params?.marked_index ?? 0
                    const registerLabel = isOracle
                      ? `ORACLE |${markedIndex
                          .toString(2)
                          .padStart(cnotGate.targets.length, '0')}⟩`
                      : cnotGate.type
                    return (
                      <g
                        key={cnotGate.id}
                        className={`circuit-preview__cnot-overlay${
                          isSelectedCnot ? ' circuit-preview__cnot-overlay--selected' : ''
                        }`}
                        style={{ pointerEvents: 'none' }}
                      >
                        {cnotGate.targets.length >= 2 ? (
                          <line
                            x1={cnotX}
                            y1={topY}
                            x2={cnotX}
                            y2={Math.max(...cnotGate.targets.map(yForQubit))}
                            className={`circuit-preview__register-line${
                              isSelectedCnot ? ' circuit-preview__register-line--selected' : ''
                            }`}
                          />
                        ) : null}
                        {cnotGate.targets.map((target, position) => {
                          const y = yForQubit(target)
                          return (
                            <g key={`${cnotGate.id}-register-${target}`}>
                              <rect
                                x={cnotX - 17}
                                y={y - 14}
                                width="34"
                                height="28"
                                rx="8"
                                className={`circuit-preview__register-box${
                                  isOracle ? ' circuit-preview__register-box--oracle' : ''
                                }${
                                  isSelectedCnot ? ' circuit-preview__register-box--selected' : ''
                                }`}
                              />
                              <text
                                x={cnotX}
                                y={y + 5}
                                textAnchor="middle"
                                className="circuit-preview__gate-label"
                              >
                                {isOracle
                                  ? markedBitAt(markedIndex, position, cnotGate.targets.length)
                                  : registerBitWeight(position, cnotGate.targets.length)}
                              </text>
                            </g>
                          )
                        })}
                        <text
                          x={cnotX}
                          y={topY - 20}
                          textAnchor="middle"
                          className={`circuit-preview__register-label${
                            isSelectedCnot ? ' circuit-preview__register-label--selected' : ''
                          }`}
                        >
                          {registerLabel}
                        </text>
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
                  }

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
                      {(cnotGate.controls ?? []).map((control, index) => (
                        <circle
                          key={`${cnotGate.id}-control-${control}`}
                          cx={cnotX}
                          cy={yForQubit(control)}
                          r="8"
                          className={`circuit-preview__control-dot${
                            cnotGate.type === 'CNOT' && controlValuesForGate(cnotGate)[index] === 0
                              ? ' circuit-preview__control-dot--open'
                              : ''
                          }${
                            isSelectedCnot ? ' circuit-preview__control-dot--selected' : ''
                          }`}
                        />
                      ))}
                      {cnotGate.targets.map((target) => {
                        const y = yForQubit(target)
                        if (cnotGate.type === 'CZ') {
                          return (
                            <circle
                              key={`${cnotGate.id}-target-${target}`}
                              cx={cnotX}
                              cy={y}
                              r="8"
                              className={`circuit-preview__control-dot${
                                isSelectedCnot ? ' circuit-preview__control-dot--selected' : ''
                              }`}
                            />
                          )
                        }
                        if (cnotGate.type === 'CP') {
                          return (
                            <g key={`${cnotGate.id}-cp-${target}`}>
                              <circle
                                cx={cnotX}
                                cy={y}
                                r="16"
                                className={`circuit-preview__target-ring${
                                  isSelectedCnot ? ' circuit-preview__target-ring--selected' : ''
                                }`}
                              />
                              <text
                                x={cnotX}
                                y={y - 2}
                                textAnchor="middle"
                                className="circuit-preview__gate-label"
                              >
                                P
                              </text>
                              <text
                                x={cnotX}
                                y={y + 10}
                                textAnchor="middle"
                                className="circuit-preview__gate-theta-label"
                              >
                                {formatThetaLabel(gateThetaRad(cnotGate) ?? 0)}
                              </text>
                            </g>
                          )
                        }
                        if (cnotGate.type === 'SWAP') {
                          return (
                            <g key={`${cnotGate.id}-swap-${target}`}>
                              <line
                                x1={cnotX - 9}
                                y1={y - 9}
                                x2={cnotX + 9}
                                y2={y + 9}
                                className={`circuit-preview__target-cross${
                                  isSelectedCnot ? ' circuit-preview__target-cross--selected' : ''
                                }`}
                              />
                              <line
                                x1={cnotX + 9}
                                y1={y - 9}
                                x2={cnotX - 9}
                                y2={y + 9}
                                className={`circuit-preview__target-cross${
                                  isSelectedCnot ? ' circuit-preview__target-cross--selected' : ''
                                }`}
                              />
                            </g>
                          )
                        }
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

                {pendingCnotControl &&
                pendingCnotControl.columnIndex === columnIndex &&
                (
                  isControlMarkerTool ||
                  (selectedGateType && (
                    isControlledGateType(selectedGateType) ||
                    isPairGateType(selectedGateType) ||
                    isRegisterGateType(selectedGateType)
                  ))
                ) &&
                hoveredQubitSlot &&
                hoveredQubitSlot.columnIndex === columnIndex &&
                ![pendingCnotControl.qubitIndex, ...(pendingCnotControl.additionalQubits ?? [])]
                  .includes(hoveredQubitSlot.qubitIndex) ? (
                  <line
                    x1={x}
                    y1={Math.min(...[
                      pendingCnotControl.qubitIndex,
                      ...(pendingCnotControl.additionalQubits ?? []),
                      hoveredQubitSlot.qubitIndex,
                    ].map(yForQubit))}
                    x2={x}
                    y2={Math.max(...[
                      pendingCnotControl.qubitIndex,
                      ...(pendingCnotControl.additionalQubits ?? []),
                      hoveredQubitSlot.qubitIndex,
                    ].map(yForQubit))}
                    className="circuit-preview__draw-preview-line"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : null}

                {pendingCnotControl?.columnIndex === columnIndex && isControlMarkerTool ? (
                  <g style={{ pointerEvents: 'none' }}>
                    {[pendingCnotControl.qubitIndex, ...(pendingCnotControl.additionalQubits ?? [])]
                      .map((control, index) => (
                        <circle
                          key={`pending-control-${control}`}
                          cx={x}
                          cy={yForQubit(control)}
                          r="8"
                          className={`circuit-preview__control-dot${[
                            pendingCnotControl.controlValue ?? 1,
                            ...(pendingCnotControl.additionalControlValues ?? []),
                          ][index] === 0 ? ' circuit-preview__control-dot--open' : ''}`}
                        />
                      ))}
                  </g>
                ) : null}

                {Array.from({ length: circuit.logical_qubits }).map((_, qubitIndex) => {
                  const y = yForQubit(qubitIndex)
                  const gate = getColumnSingleGate(column, qubitIndex)
                  const gateIdAtSlot = getGateIdAtSlot(circuit, columnIndex, qubitIndex)
                  const cnotGateAtSlot = getCnotGateAtQubit(cnotGates, qubitIndex)
                  const cnotQubitsAtSlot = cnotGateAtSlot ? getCnotQubits(cnotGateAtSlot) : []
                  const hasCnotOccupancy = cnotGateAtSlot !== null
                  const isPendingControl =
                    pendingCnotControl?.columnIndex === columnIndex &&
                    (
                      pendingCnotControl.qubitIndex === qubitIndex ||
                      (pendingCnotControl.additionalQubits ?? []).includes(qubitIndex)
                    )
                  const isPendingTargetCandidate =
                    selectedGateType !== undefined &&
                    selectedGateType !== null &&
                    isMultiQubitGateType(selectedGateType) &&
                    pendingCnotControl?.columnIndex === columnIndex &&
                    pendingCnotControl.qubitIndex !== qubitIndex &&
                    !(pendingCnotControl.additionalQubits ?? []).includes(qubitIndex)
                  const isSelectedGate = selectedGateId === gateIdAtSlot
                  const isDraggedGate =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === gateIdAtSlot
                  const isDraggedCnot =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === cnotGateAtSlot?.id
                  const isDropTarget = Boolean(dragPayload && onSlotDrop)
                  const isControlMarkerDrop =
                    dragPayload?.source === 'palette' && dragPayload.controlValue !== undefined
                  const isControlLineInsertionTarget =
                    isControlMarkerDrop && !gate && isInsideCnotControlLine(cnotGates, qubitIndex)
                  const isDropHovered =
                    dragHoverSlot?.columnIndex === columnIndex &&
                    dragHoverSlot.qubitIndex === qubitIndex
                  const isSameDraggedGate =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === gateIdAtSlot
                  const isInvalidDropTarget =
                    isDropTarget && Boolean(gate || hasCnotOccupancy) &&
                    !isSameDraggedGate && !isControlLineInsertionTarget
                  // Only CNOT/CZ/CP/SWAP place gates by clicking the grid (the
                  // two-click "stretch" flow); every other gate type is
                  // drag-only, so clicking their empty slots does nothing.
                  const interactive = Boolean(
                    onSlotClick && (isControlMarkerTool || (selectedGateType && isDrawableGateType)),
                  )
                  const isStretchEligible =
                    !gate &&
                    !hasCnotOccupancy &&
                    isDrawableGateType &&
                    !isPendingControl &&
                    !isPendingTargetCandidate
                  // Selecting an existing gate always works by clicking it,
                  // regardless of which tool is currently active in the palette.
                  const selectable = Boolean(gateIdAtSlot && onGateSelect)
                  const isClickable = interactive || selectable
                  const selectedGateDuration = gate && isSelectedGate
                    ? getGateDuration(gate, gateDurationDefaults)
                    : null
                  const gateTheta = gate ? gateThetaRad(gate) : null
                  // Angle first: it changes what the gate does, the duration only when selected.
                  const gateSubLabels: Array<{ text: string; className: string }> = [
                    ...(gateTheta === null
                      ? []
                      : [{
                          text: `θ=${formatThetaLabel(gateTheta)}`,
                          className: 'circuit-preview__gate-theta-label',
                        }]),
                    ...(selectedGateDuration === null
                      ? []
                      : [{
                          text: formatDurationLabel(selectedGateDuration),
                          className: 'circuit-preview__gate-duration-label',
                        }]),
                  ]
                  const gateLabelY = gateSubLabels.length === 0
                    ? y + 5
                    : gateSubLabels.length === 1
                      ? y - 3
                      : y - 7
                  const slotLabel = gate
                    ? `${gate.type} gate at q${qubitIndex}, column ${columnIndex}`
                    : hasCnotOccupancy
                      ? `${cnotGateAtSlot?.type ?? 'controlled'} slot at q${qubitIndex}, column ${columnIndex}`
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
                        isControlLineInsertionTarget ? ' circuit-preview__slot-group--control-line-drop' : ''
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
                      }${isDraggedGate || isDraggedCnot ? ' circuit-preview__slot-group--dragging' : ''}${
                        isStretchEligible ? ' circuit-preview__slot-group--draw-start' : ''
                      }`}
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
                        isControlMarkerTool && interactive
                          ? () => handleSlotClick(columnIndex, qubitIndex)
                          : selectable && gateIdAtSlot && onGateSelect
                          ? () => onGateSelect(gateIdAtSlot)
                          : interactive
                            ? () => handleSlotClick(columnIndex, qubitIndex)
                            : undefined
                      }
                      onKeyDown={
                        isControlMarkerTool && interactive
                          ? (event) => handleSlotKeyDown(event, columnIndex, qubitIndex)
                          : selectable && gateIdAtSlot && onGateSelect
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                onGateSelect(gateIdAtSlot)
                              }
                            }
                          : interactive
                            ? (event) => handleSlotKeyDown(event, columnIndex, qubitIndex)
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
                      onMouseEnter={
                        interactive ? () => setHoveredQubitSlot({ columnIndex, qubitIndex }) : undefined
                      }
                      onMouseLeave={
                        interactive
                          ? () =>
                              setHoveredQubitSlot((current) =>
                                current?.columnIndex === columnIndex && current.qubitIndex === qubitIndex
                                  ? null
                                  : current,
                              )
                          : undefined
                      }
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
                          isControlLineInsertionTarget ? ' circuit-preview__slot--control-line-drop' : ''
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
                          }${
                            gate.type === 'MESSAGE' || gate.type === 'RECEIVED'
                              ? ' circuit-preview__gate--annotation'
                              : ''
                          }${isHighlightedGate(gate) ? ' circuit-preview__gate--active-operation' : ''
                          }${isDraggedGate ? ' circuit-preview__gate--dragging' : ''}`}
                          {...(!isMultiQubitGateType(gate.type) ? { draggable: true } : {})}
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
                          }${
                            gate.type === 'MESSAGE' || gate.type === 'RECEIVED'
                              ? ' circuit-preview__gate-hit-area--annotation'
                              : ''
                          }${isHighlightedGate(gate) ? ' circuit-preview__gate-hit-area--active-operation' : ''
                          }${isDraggedGate ? ' circuit-preview__gate-hit-area--dragging' : ''}`}
                          {...(!isMultiQubitGateType(gate.type) ? { draggable: true } : {})}
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
                              cnotGateAtSlot.type,
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
                              cnotGateAtSlot.type,
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
                              cnotGateAtSlot.type,
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
                          y={gateLabelY}
                          textAnchor="middle"
                          className="circuit-preview__gate-label"
                        >
                          {getGateLabel(gate)}
                        </text>
                      ) : null}
                      {gate
                        ? gateSubLabels.map((subLabel, subLabelIndex) => (
                            <text
                              key={subLabel.className}
                              x={x}
                              y={gateSubLabels.length === 1
                                ? y + 10
                                : y + 3 + subLabelIndex * 10}
                              textAnchor="middle"
                              className={subLabel.className}
                            >
                              {subLabel.text}
                            </text>
                          ))
                        : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {isAddColumnDropVisible
            ? Array.from({ length: circuit.logical_qubits }).map((_, qubitIndex) => {
                const y = yForQubit(qubitIndex)
                const isHovered =
                  dragHoverSlot?.columnIndex === newColumnIndex && dragHoverSlot.qubitIndex === qubitIndex

                return (
                  <g
                    key={`add-column-slot-${qubitIndex}`}
                    className={`circuit-preview__slot-group circuit-preview__slot-group--add-column circuit-preview__slot-group--drop-target${
                      isHovered ? ' circuit-preview__slot-group--drop-hovered' : ''
                    }`}
                    aria-label={`Drop here to add column ${newColumnIndex + 1} at q${qubitIndex}`}
                    onDragOver={handleSlotDragOver}
                    onDragEnter={() => setDragHoverSlot({ columnIndex: newColumnIndex, qubitIndex })}
                    onDragLeave={() =>
                      setDragHoverSlot((current) =>
                        current?.columnIndex === newColumnIndex && current.qubitIndex === qubitIndex
                          ? null
                          : current,
                      )
                    }
                    onDrop={(event) => handleSlotDrop(event, newColumnIndex, qubitIndex)}
                  >
                    <rect
                      x={addColumnCenterX - SLOT_SIZE / 2}
                      y={y - SLOT_SIZE / 2}
                      width={SLOT_SIZE}
                      height={SLOT_SIZE}
                      rx="8"
                      className={`circuit-preview__slot circuit-preview__slot--drop-target${
                        isHovered ? ' circuit-preview__slot--drop-hovered' : ''
                      }`}
                    />
                  </g>
                )
              })
            : null}
          </svg>
        </div>
      </div>
    </section>
  )
}
