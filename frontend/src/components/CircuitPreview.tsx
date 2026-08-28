import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import './CircuitPreview.css'
import { spawnGatePlacementEffect } from '../utils/gatePlacementEffect'
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
type PendingCnotControl = {
  columnIndex: number
  qubitIndex: number
  controlValue?: 0 | 1
  additionalQubits?: number[]
  additionalControlValues?: Array<0 | 1>
}

type PointerDropTarget =
  | { kind: 'slot'; columnIndex: number; qubitIndex: number }
  | { kind: 'insert'; insertIndex: number; qubitIndex: number }

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
  /** 列と列のあいだへのドロップ。新しい列を割り込ませてそこへ置く。 */
  onColumnInsertDrop?: (insertIndex: number, qubitIndex: number) => void
  onDeleteGate?: (gateId: string) => void
  onDuplicateGate?: (gateId: string) => void
  onShiftGateColumn?: (gateId: string, offset: -1 | 1) => void
}

const SLOT_SIZE = 42
/*
 * 列と列のあいだの当たり判定の幅。スロット(42px)と重ならないよう、
 * 列ピッチ136pxの隙間(片側47px)に収める。
 */
const COLUMN_INSERT_HIT_WIDTH = 26
/* これ以上動いたら「掴んだ」と見なす。下回るあいだはクリック（選択）のまま。 */
const POINTER_DRAG_THRESHOLD = 4
const GATE_ACTION_SIZE = 19
const GATE_ACTION_GAP = 3

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
  onColumnInsertDrop,
  onDeleteGate,
  onDuplicateGate,
  onShiftGateColumn,
}: CircuitPreviewProps) {
  const [dragHoverSlot, setDragHoverSlot] = useState<PendingCnotControl | null>(null)
  const [insertHoverSlot, setInsertHoverSlot] = useState<
    { insertIndex: number; qubitIndex: number } | null
  >(null)
  const [hoveredQubitSlot, setHoveredQubitSlot] = useState<{ columnIndex: number; qubitIndex: number } | null>(null)
  /* ポインタで移動中のゲートの見た目（カーソルに付いてくる分身）。 */
  const [pointerDragVisual, setPointerDragVisual] = useState<
    { x: number; y: number; label: string } | null
  >(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  /*
   * ドロップ用のコールバックは pointerdown 時点の render のものを掴んでしまうと、
   * そこではまだ dragPayload が null なので、離した瞬間に何も起きない。
   * 常に最新の render のものを呼べるようにしておく。
   */
  const dropHandlersRef = useRef({ onSlotDrop, onColumnInsertDrop, onDragEnd })
  const pointerDragTeardownRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef(false)
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
  /*
   * ホバー表示はドラッグ中だけの話。パレットの外で放されたときなど、
   * onDragLeave が来ないまま終わる経路があるので、掴んでいないあいだは
   * 残った値を読まないようにして消し忘れを断つ。
   */
  const dragHover = dragPayload ? dragHoverSlot : null
  const insertHover = dragPayload ? insertHoverSlot : null
  const addColumnCenterX = CIRCUIT_LEFT_PADDING + 20 + newColumnIndex * CIRCUIT_CELL_WIDTH
  const addColumnLeft = addColumnCenterX - CIRCUIT_CELL_WIDTH / 2
  const isAddColumnHovered = dragHover?.columnIndex === newColumnIndex
  const isDrawableGateType = Boolean(
    selectedGateType && (
      isControlledGateType(selectedGateType) ||
      isPairGateType(selectedGateType) ||
      isRegisterGateType(selectedGateType)
    ),
  )
  const isControlMarkerTool = selectedControlValue !== null

  /*
   * 選択中のゲートに付ける操作バー。Pulseタイムラインのブロックが持つ
   * ← → ⧉ × と同じ並びにして、両モードで同じ手つきが通るようにする。
   * スロットとは別のレイヤーに描くので、ボタンを押してもドラッグが始まらない。
   */
  const selectedGateActionBar = (() => {
    if (!selectedGateId) {
      return null
    }

    let found: { gate: CircuitGate; columnIndex: number } | null = null
    for (const [columnIndex, column] of circuit.columns.entries()) {
      const gate = column.gates.find((candidate) => candidate.id === selectedGateId)
      if (gate) {
        found = { gate, columnIndex }
        break
      }
    }
    if (!found) {
      return null
    }

    const { gate, columnIndex } = found
    const actions: Array<{
      key: string
      label: string
      title: string
      disabled: boolean
      danger?: boolean
      run: () => void
    }> = []

    if (onShiftGateColumn) {
      actions.push({
        key: 'left',
        label: '←',
        title: `${gate.type} を左の列へ移動`,
        disabled: columnIndex === 0,
        run: () => onShiftGateColumn(gate.id, -1),
      })
      actions.push({
        key: 'right',
        label: '→',
        title: `${gate.type} を右の列へ移動`,
        disabled: false,
        run: () => onShiftGateColumn(gate.id, 1),
      })
    }
    if (onDuplicateGate) {
      actions.push({
        key: 'duplicate',
        label: '⧉',
        title: `${gate.type} を右隣の新しい列へ複製`,
        disabled: false,
        run: () => onDuplicateGate(gate.id),
      })
    }
    if (onDeleteGate) {
      actions.push({
        key: 'delete',
        label: '×',
        title: `${gate.type} を削除（Deleteキーでも消せます）`,
        disabled: false,
        danger: true,
        run: () => onDeleteGate(gate.id),
      })
    }
    if (actions.length === 0) {
      return null
    }

    const spannedQubits = [...(gate.controls ?? []), ...gate.targets]
    const bottomY = Math.max(...spannedQubits.map(yForQubit))
    /* 複数量子ビットゲートは真下に所要時間バッジが出るので、その分だけ下げる。 */
    const centerY = bottomY + (isMultiQubitGateType(gate.type) ? 46 : 30)
    const totalWidth =
      actions.length * GATE_ACTION_SIZE + (actions.length - 1) * GATE_ACTION_GAP
    /*
     * 量子ビット名のレールは左端に貼り付いたまま回路の上に乗るので、
     * 先頭列のゲートではバーがその下に潜る。レールの右端まで押し出す。
     */
    const startX = Math.max(
      CIRCUIT_LEFT_PADDING + 20 + columnIndex * CIRCUIT_CELL_WIDTH - totalWidth / 2,
      CIRCUIT_LABEL_RAIL_WIDTH + 4,
    )

    return { actions, centerY, startX }
  })()

  const isHighlightedGate = (gate: CircuitGate) => {
    const qubits = [...(gate.controls ?? []), ...gate.targets].sort((left, right) => left - right)
    return highlightedGateSignatures.includes(`${gate.type}:${qubits.join(',')}`)
  }

  /*
   * 配置エフェクトは「置こうとした瞬間」ではなく「実際に置けたとき」だけ出す。
   *
   * クリック配置はCNOTのように1回目では何も置かない操作があり、ドロップも
   * 埋まっているスロットなら弾かれる。押した時点で光らせると、置けていない
   * のに置けたように見えてしまう。そこでカーソル位置だけ控えておき、
   * 回路が実際に書き換わったのを見てから焚く。
   *
   * 編集が通った場合だけ新しい state が作られるので、参照が変わったかどうかが
   * そのまま成否になる。置き直し（移動）も手応えとしては配置なので、ここに含める。
   */
  const pendingPlacementEffectRef = useRef<{ x: number; y: number } | null>(null)
  const lastCircuitRef = useRef(circuit)

  function armPlacementEffect(clientX: number, clientY: number) {
    pendingPlacementEffectRef.current = { x: clientX, y: clientY }
  }

  useEffect(() => {
    const circuitChanged = lastCircuitRef.current !== circuit
    lastCircuitRef.current = circuit

    const pending = pendingPlacementEffectRef.current
    pendingPlacementEffectRef.current = null
    if (pending && circuitChanged) {
      spawnGatePlacementEffect(pending.x, pending.y)
    }
  }, [circuit])

  useEffect(() => {
    dropHandlersRef.current = { onSlotDrop, onColumnInsertDrop, onDragEnd }
  })

  useEffect(() => () => pointerDragTeardownRef.current?.(), [])

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

  function handleInsertDragOver(event: DragEvent<SVGElement>) {
    if (!dragPayload || !onColumnInsertDrop) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = dragPayload.source === 'circuit' ? 'move' : 'copy'
  }

  function handleSlotClick(
    columnIndex: number,
    qubitIndex: number,
    effectOrigin?: { clientX: number; clientY: number },
  ) {
    if (!selectedGateType || !onSlotClick) {
      return
    }

    if (effectOrigin) {
      armPlacementEffect(effectOrigin.clientX, effectOrigin.clientY)
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
      /* キーボード操作にはカーソルが無いので、対象スロットの中心から出す。 */
      const bounds = event.currentTarget.getBoundingClientRect()
      handleSlotClick(columnIndex, qubitIndex, {
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
      })
    }
  }

  function handleSlotDragOver(event: DragEvent<SVGElement>) {
    if (!dragPayload || !onSlotDrop) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = dragPayload.source === 'circuit' ? 'move' : 'copy'
  }

  function handleSlotDrop(
    event: DragEvent<SVGElement>,
    columnIndex: number,
    qubitIndex: number,
  ) {
    if (!dragPayload || !onSlotDrop) {
      return
    }

    event.preventDefault()
    setDragHoverSlot(null)
    armPlacementEffect(event.clientX, event.clientY)
    onSlotDrop(columnIndex, qubitIndex)
  }

  /*
   * 置いたゲートの移動は HTML5 の drag&drop ではなく Pointer Events で行う。
   * draggable は HTMLElement の属性で、SVG要素に付けても dragstart が発火しない
   * （パレットのボタンはHTMLなので効くが、回路図の中は効かない）。
   * ポインタで直接追うことで、掴んだゲートがカーソルに付いてくる手応えも出る。
   */
  function toSvgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current
    const screenMatrix = svg?.getScreenCTM()
    if (!svg || !screenMatrix) {
      return null
    }

    const point = new DOMPoint(clientX, clientY).matrixTransform(screenMatrix.inverse())
    return { x: point.x, y: point.y }
  }

  /*
   * ドロップ先は座標から直接求める。列の境目から ±COLUMN_INSERT_HIT_WIDTH/2 は
   * 「あいだに割り込む」、それ以外は最寄りの列のスロット。DOMの当たり判定と同じ分け方。
   */
  function resolvePointerDropTarget(x: number, y: number): PointerDropTarget | null {
    /* 量子ビット名のレールの下は見えないので、そこで放したら「行き先なし」にする。 */
    if (x < CIRCUIT_LABEL_RAIL_WIDTH) {
      return null
    }

    const qubitIndex = Math.round((y - CIRCUIT_TOP_PADDING) / CIRCUIT_CELL_HEIGHT)
    if (
      qubitIndex < 0 ||
      qubitIndex >= circuit.logical_qubits ||
      Math.abs(y - yForQubit(qubitIndex)) > CIRCUIT_CELL_HEIGHT / 2
    ) {
      return null
    }

    const firstCenterX = CIRCUIT_LEFT_PADDING + 20
    const boundaryIndex = Math.round((x - firstCenterX + CIRCUIT_CELL_WIDTH / 2) / CIRCUIT_CELL_WIDTH)
    const boundaryX = firstCenterX + boundaryIndex * CIRCUIT_CELL_WIDTH - CIRCUIT_CELL_WIDTH / 2
    if (
      onColumnInsertDrop &&
      boundaryIndex >= 1 &&
      boundaryIndex <= circuit.columns.length - 1 &&
      Math.abs(x - boundaryX) <= COLUMN_INSERT_HIT_WIDTH / 2
    ) {
      return { kind: 'insert', insertIndex: boundaryIndex, qubitIndex }
    }

    const columnIndex = Math.round((x - firstCenterX) / CIRCUIT_CELL_WIDTH)
    if (
      columnIndex < 0 ||
      columnIndex > circuit.columns.length ||
      Math.abs(x - (firstCenterX + columnIndex * CIRCUIT_CELL_WIDTH)) > CIRCUIT_CELL_WIDTH / 2
    ) {
      return null
    }

    return { kind: 'slot', columnIndex, qubitIndex }
  }

  function beginPointerDrag(
    event: ReactPointerEvent<SVGGElement>,
    gate: CircuitGate,
    columnIndex: number,
    qubitIndex: number,
  ) {
    if (event.button !== 0 || !onCircuitGateDragStart || !onSlotDrop) {
      return
    }

    const start = toSvgPoint(event.clientX, event.clientY)
    if (!start) {
      return
    }

    const startX = start.x
    const startY = start.y
    const { pointerId } = event

    /* 先に掴んでおくだけ。しきい値を超えるまではクリック（選択）のまま。 */
    let started = false
    let target: PointerDropTarget | null = null

    function clearHover() {
      setDragHoverSlot(null)
      setInsertHoverSlot(null)
    }

    function applyTarget(next: PointerDropTarget | null) {
      target = next
      if (next === null) {
        clearHover()
        return
      }
      if (next.kind === 'insert') {
        setDragHoverSlot(null)
        setInsertHoverSlot({ insertIndex: next.insertIndex, qubitIndex: next.qubitIndex })
        return
      }
      setInsertHoverSlot(null)
      setDragHoverSlot({ columnIndex: next.columnIndex, qubitIndex: next.qubitIndex })
    }

    function teardown() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('keydown', handleKeyDown)
      pointerDragTeardownRef.current = null
      setPointerDragVisual(null)
      clearHover()
    }

    function handleMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) {
        return
      }

      const point = toSvgPoint(moveEvent.clientX, moveEvent.clientY)
      if (!point) {
        return
      }

      if (!started) {
        const travelled = Math.hypot(point.x - startX, point.y - startY)
        if (travelled < POINTER_DRAG_THRESHOLD) {
          return
        }
        started = true
        onCircuitGateDragStart?.(gate.id, gate.type, columnIndex, qubitIndex)
      }

      moveEvent.preventDefault()
      setPointerDragVisual({ x: point.x, y: point.y, label: getGateLabel(gate) })
      applyTarget(resolvePointerDropTarget(point.x, point.y))
    }

    function handleUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) {
        return
      }

      const dropTarget = target
      const wasDragging = started
      teardown()

      if (!wasDragging) {
        return
      }

      markClickSuppressed()

      const handlers = dropHandlersRef.current
      if (dropTarget?.kind === 'insert') {
        armPlacementEffect(upEvent.clientX, upEvent.clientY)
        handlers.onColumnInsertDrop?.(dropTarget.insertIndex, dropTarget.qubitIndex)
      } else if (dropTarget?.kind === 'slot') {
        armPlacementEffect(upEvent.clientX, upEvent.clientY)
        handlers.onSlotDrop?.(dropTarget.columnIndex, dropTarget.qubitIndex)
      }
      handlers.onDragEnd?.()
    }

    function handleCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId !== pointerId) {
        return
      }
      const wasDragging = started
      teardown()
      if (wasDragging) {
        markClickSuppressed()
        dropHandlersRef.current.onDragEnd?.()
      }
    }

    function handleKeyDown(keyEvent: globalThis.KeyboardEvent) {
      if (keyEvent.key !== 'Escape') {
        return
      }
      keyEvent.preventDefault()
      const wasDragging = started
      teardown()
      if (wasDragging) {
        markClickSuppressed()
        dropHandlersRef.current.onDragEnd?.()
      }
    }

    pointerDragTeardownRef.current = teardown
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('keydown', handleKeyDown)
  }

  function markClickSuppressed() {
    suppressClickRef.current = true
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  function consumeClickSuppression() {
    if (!suppressClickRef.current) {
      return false
    }
    suppressClickRef.current = false
    return true
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
            ref={svgRef}
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
              /* Pulseのレーンと同じで、ドラッグ中は落ちる先の列そのものを光らせる。 */
              const isDropColumn = dragHover?.columnIndex === columnIndex

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
                    }${isDropColumn ? ' circuit-preview__column-band--drop' : ''}`}
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
                    dragHover?.columnIndex === columnIndex &&
                    dragHover.qubitIndex === qubitIndex
                  const isSameDraggedGate =
                    dragPayload?.source === 'circuit' && dragPayload.gateId === gateIdAtSlot
                  const isInvalidDropTarget =
                    isDropTarget && Boolean(gate || hasCnotOccupancy) &&
                    !isSameDraggedGate && !isControlLineInsertionTarget
                  // パレットで何か選んでいれば、どのゲートでもクリックで置ける。
                  // CNOT/CZ/CP/SWAP/QFT/ORACLE は2回クリックの「引き伸ばし」、
                  // それ以外は1回のクリックでそのスロットに確定する。
                  const interactive = Boolean(
                    onSlotClick && (isControlMarkerTool || selectedGateType),
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
                  /* 読み取り専用のプレビューでは掴めない。タッチのスクロールも殺さない。 */
                  const isGrabbable = Boolean(dragGate && onCircuitGateDragStart && onSlotDrop)

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
                      }${isGrabbable ? ' circuit-preview__slot-group--grabbable' : ''}`}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={slotLabel}
                      onPointerDown={
                        isGrabbable && dragGate
                          ? (event) => beginPointerDrag(event, dragGate, columnIndex, qubitIndex)
                          : undefined
                      }
                      onClick={
                        isClickable
                          ? (event) => {
                              /* 直前がドラッグだったときは、選択し直さない。 */
                              if (consumeClickSuppression()) {
                                return
                              }
                              const origin = { clientX: event.clientX, clientY: event.clientY }
                              if (isControlMarkerTool && interactive) {
                                handleSlotClick(columnIndex, qubitIndex, origin)
                                return
                              }
                              if (selectable && gateIdAtSlot && onGateSelect) {
                                onGateSelect(gateIdAtSlot)
                                return
                              }
                              if (interactive) {
                                handleSlotClick(columnIndex, qubitIndex, origin)
                              }
                            }
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
                  dragHover?.columnIndex === newColumnIndex && dragHover.qubitIndex === qubitIndex

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

          {/* 掴んでいるゲートの分身。カーソルに付いてくるので、どこへ落ちるか迷わない。 */}
          {pointerDragVisual ? (
            <g className="circuit-preview__drag-ghost" style={{ pointerEvents: 'none' }}>
              <rect
                x={pointerDragVisual.x - 21}
                y={pointerDragVisual.y - 17}
                width="42"
                height="34"
                rx="9"
                className="circuit-preview__drag-ghost-box"
              />
              <text
                x={pointerDragVisual.x}
                y={pointerDragVisual.y + 6}
                textAnchor="middle"
                className="circuit-preview__drag-ghost-label"
              >
                {pointerDragVisual.label}
              </text>
            </g>
          ) : null}

          {selectedGateActionBar && !dragPayload ? (
            <g className="circuit-preview__gate-actions" aria-label="選択中のゲートの操作">
              {selectedGateActionBar.actions.map((action, actionIndex) => {
                const left =
                  selectedGateActionBar.startX +
                  actionIndex * (GATE_ACTION_SIZE + GATE_ACTION_GAP)
                const top = selectedGateActionBar.centerY - GATE_ACTION_SIZE / 2

                return (
                  <g
                    key={action.key}
                    className={`circuit-preview__gate-action${
                      action.danger ? ' circuit-preview__gate-action--danger' : ''
                    }${action.disabled ? ' circuit-preview__gate-action--disabled' : ''}`}
                    role="button"
                    tabIndex={action.disabled ? undefined : 0}
                    aria-label={action.title}
                    aria-disabled={action.disabled}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!action.disabled) {
                        action.run()
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') {
                        return
                      }
                      event.preventDefault()
                      event.stopPropagation()
                      if (!action.disabled) {
                        action.run()
                      }
                    }}
                  >
                    <title>{action.title}</title>
                    <rect
                      x={left}
                      y={top}
                      width={GATE_ACTION_SIZE}
                      height={GATE_ACTION_SIZE}
                      rx="5"
                      className="circuit-preview__gate-action-bg"
                    />
                    <text
                      x={left + GATE_ACTION_SIZE / 2}
                      y={selectedGateActionBar.centerY + 4}
                      textAnchor="middle"
                      className="circuit-preview__gate-action-label"
                    >
                      {action.label}
                    </text>
                  </g>
                )
              })}
            </g>
          ) : null}

          {/*
            Pulseタイムラインのドロップマーカーと同じ役割。列と列のあいだへ落とすと
            そこに新しい列が割り込む。既存のスロット(42px)とは重ならない幅なので、
            列の中央に落とす従来の操作はそのまま使える。
          */}
          {dragPayload && onColumnInsertDrop ? (
            <g className="circuit-preview__insert-layer">
              {Array.from({ length: Math.max(0, visibleColumnCount - 1) }).map((_, gapIndex) => {
                /*
                 * 先頭列の左端は量子ビット名のレールの下に隠れて掴めないので、
                 * 割り込み位置は列と列のあいだ（1〜最終列）だけにする。
                 * 末尾への追加は右端の「+ 列を追加」が受け持つ。
                 */
                const insertIndex = gapIndex + 1
                const boundaryX =
                  CIRCUIT_LEFT_PADDING + 20 + insertIndex * CIRCUIT_CELL_WIDTH - CIRCUIT_CELL_WIDTH / 2
                const activeInsert =
                  insertHover?.insertIndex === insertIndex ? insertHover : null

                return (
                  <g
                    key={`column-insert-${insertIndex}`}
                    className={`circuit-preview__insert-marker${
                      activeInsert ? ' circuit-preview__insert-marker--active' : ''
                    }`}
                  >
                    <rect
                      x={boundaryX - COLUMN_INSERT_HIT_WIDTH / 2}
                      y="8"
                      width={COLUMN_INSERT_HIT_WIDTH}
                      height={height - 20}
                      rx="7"
                      className="circuit-preview__insert-band"
                    />
                    <line
                      x1={boundaryX}
                      y1={14}
                      x2={boundaryX}
                      y2={height - 18}
                      className="circuit-preview__insert-line"
                    />
                    {activeInsert ? (
                      <>
                        <circle
                          cx={boundaryX}
                          cy={yForQubit(activeInsert.qubitIndex)}
                          r="6"
                          className="circuit-preview__insert-dot"
                        />
                        <text
                          x={boundaryX}
                          y={height - 4}
                          textAnchor="middle"
                          className="circuit-preview__insert-label"
                        >
                          ＋列 {insertIndex + 1}
                        </text>
                      </>
                    ) : null}
                    {Array.from({ length: circuit.logical_qubits }).map((_, qubitIndex) => (
                      <rect
                        key={`column-insert-${insertIndex}-${qubitIndex}`}
                        x={boundaryX - COLUMN_INSERT_HIT_WIDTH / 2}
                        y={yForQubit(qubitIndex) - CIRCUIT_CELL_HEIGHT / 2}
                        width={COLUMN_INSERT_HIT_WIDTH}
                        height={CIRCUIT_CELL_HEIGHT}
                        className="circuit-preview__insert-hit"
                        aria-label={`列 ${insertIndex + 1} の手前に新しい列を作って q${qubitIndex} に置く`}
                        onDragOver={handleInsertDragOver}
                        onDragEnter={() => {
                          setDragHoverSlot(null)
                          setInsertHoverSlot({ insertIndex, qubitIndex })
                        }}
                        onDragLeave={() =>
                          setInsertHoverSlot((current) =>
                            current?.insertIndex === insertIndex && current.qubitIndex === qubitIndex
                              ? null
                              : current,
                          )
                        }
                        onDrop={(event) => {
                          event.preventDefault()
                          setInsertHoverSlot(null)
                          setDragHoverSlot(null)
                          armPlacementEffect(event.clientX, event.clientY)
                          onColumnInsertDrop(insertIndex, qubitIndex)
                        }}
                      />
                    ))}
                  </g>
                )
              })}
            </g>
          ) : null}
          </svg>
        </div>
      </div>
    </section>
  )
}
