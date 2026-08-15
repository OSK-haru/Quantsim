import { useMemo } from 'react'
import './CompiledCircuitDiagram.css'
import { formatThetaLabel } from '../utils/circuitEditing'
import type {
  CompiledCircuitData,
  CompiledCircuitGate,
  CompiledSourceMapEntry,
} from '../types/simulation'

type CompiledCircuitDiagramProps = {
  circuit: CompiledCircuitData
  sourceMap?: CompiledSourceMapEntry[]
}

const RAIL_WIDTH = 62
const CELL_WIDTH = 62
const ROW_HEIGHT = 46
const COLUMN_INDEX_HEIGHT = 24
const SOURCE_RAIL_HEIGHT = 28
const BOTTOM_PADDING = 16
const GATE_BOX_HEIGHT = 28
const CONTROL_DOT_RADIUS = 4.5
const TARGET_RING_RADIUS = 10

/** Gate names are drawn inside a cell, so a few of them get a compact form. */
const GATE_LABELS: Record<string, string> = {
  MEASURE: 'M',
  ORACLE: 'ORC',
  MESSAGE: 'MSG',
  RECEIVED: 'RCV',
}

/** Gates whose target is drawn as a symbol on the wire instead of a boxed label. */
function targetSymbol(type: string, hasControls: boolean) {
  if (type === 'SWAP') {
    return 'swap' as const
  }
  if (!hasControls) {
    return 'box' as const
  }
  if (type === 'CNOT' || type === 'CX' || type === 'CCX' || type === 'X') {
    return 'cross' as const
  }
  if (type === 'CZ' || type === 'Z') {
    return 'dot' as const
  }
  return 'box' as const
}

function gateLabel(type: string) {
  return GATE_LABELS[type] ?? type
}

function gateQubits(gate: CompiledCircuitGate) {
  return [...(gate.controls ?? []), ...gate.targets]
}

function boxWidth(label: string) {
  return Math.min(CELL_WIDTH - 10, Math.max(30, label.length * 9 + 12))
}

function thetaLabel(gate: CompiledCircuitGate) {
  const theta = gate.params?.theta_rad
  return theta === undefined || !Number.isFinite(theta) ? null : formatThetaLabel(theta)
}

/**
 * One band per logical column, spanning the compiled columns it expanded into.
 * This is the logical → compiled mapping the source map describes, drawn over
 * the circuit instead of listed as text.
 */
function buildSourceGroups(
  sourceMap: CompiledSourceMapEntry[],
  stepToPosition: Map<number, number>,
) {
  const groups = new Map<number, { labels: string[]; start: number; end: number }>()

  for (const entry of sourceMap) {
    const positions = entry.compiled_operations
      .map((operation) => stepToPosition.get(operation.compiled_column))
      .filter((position): position is number => position !== undefined)
    if (positions.length === 0) {
      continue
    }

    const existing = groups.get(entry.logical_column)
    const start = Math.min(...positions)
    const end = Math.max(...positions)
    if (existing === undefined) {
      groups.set(entry.logical_column, {
        labels: [entry.source_gate],
        start,
        end,
      })
      continue
    }

    if (!existing.labels.includes(entry.source_gate)) {
      existing.labels.push(entry.source_gate)
    }
    existing.start = Math.min(existing.start, start)
    existing.end = Math.max(existing.end, end)
  }

  return [...groups.entries()]
    .map(([logicalColumn, group]) => ({
      logicalColumn,
      label: group.labels.join(' + '),
      start: group.start,
      end: group.end,
    }))
    .sort((left, right) => left.start - right.start)
}

export function CompiledCircuitDiagram({ circuit, sourceMap = [] }: CompiledCircuitDiagramProps) {
  const columns = useMemo(() => circuit.columns ?? [], [circuit.columns])

  const qubitCount = useMemo(() => {
    const declared = circuit.logical_qubits ?? 0
    const used = columns.reduce((maximum, column) => {
      const columnMaximum = column.gates.reduce(
        (gateMaximum, gate) => Math.max(gateMaximum, ...gateQubits(gate)),
        -1,
      )
      return Math.max(maximum, columnMaximum)
    }, -1)
    return Math.max(declared, used + 1, 1)
  }, [circuit.logical_qubits, columns])

  const sourceGroups = useMemo(() => {
    const stepToPosition = new Map(columns.map((column, index) => [column.step, index]))
    const groups = buildSourceGroups(sourceMap, stepToPosition)
    // With a 1:1 mapping the band would only repeat the column ruler, so the
    // rail is worth its vertical space only once something actually expanded.
    return groups.some((group) => group.end > group.start) ? groups : []
  }, [columns, sourceMap])

  if (columns.length === 0) {
    return <p className="compiled-circuit__empty">分解後の回路に列がありません。</p>
  }

  const railHeight = sourceGroups.length > 0 ? SOURCE_RAIL_HEIGHT : 0
  const wiresTop = railHeight + COLUMN_INDEX_HEIGHT
  const width = RAIL_WIDTH + columns.length * CELL_WIDTH + 12
  const height = wiresTop + qubitCount * ROW_HEIGHT + BOTTOM_PADDING
  const xForColumn = (index: number) => RAIL_WIDTH + index * CELL_WIDTH + CELL_WIDTH / 2
  const yForQubit = (qubit: number) => wiresTop + qubit * ROW_HEIGHT + ROW_HEIGHT / 2

  return (
    <div className="compiled-circuit">
      <div className="compiled-circuit__viewport">
        <svg
          className="compiled-circuit__svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`分解後の回路図: ${qubitCount} qubits, ${columns.length} columns`}
        >
          {columns.map((column, index) => (
            <g key={`band-${column.step}-${index}`}>
              <rect
                className={`compiled-circuit__band${
                  index % 2 === 1 ? ' compiled-circuit__band--alternate' : ''
                }`}
                x={RAIL_WIDTH + index * CELL_WIDTH}
                y={wiresTop - COLUMN_INDEX_HEIGHT}
                width={CELL_WIDTH}
                height={height - (wiresTop - COLUMN_INDEX_HEIGHT) - 4}
              />
              <text
                className="compiled-circuit__column-index"
                x={xForColumn(index)}
                y={wiresTop - 8}
                textAnchor="middle"
              >
                {index + 1}
              </text>
            </g>
          ))}

          {sourceGroups.map((group) => {
            const left = RAIL_WIDTH + group.start * CELL_WIDTH + 4
            const right = RAIL_WIDTH + (group.end + 1) * CELL_WIDTH - 4
            return (
              <g key={`source-${group.logicalColumn}`}>
                <rect
                  className="compiled-circuit__source-band"
                  x={left}
                  y={4}
                  width={right - left}
                  height={SOURCE_RAIL_HEIGHT - 10}
                  rx="4"
                />
                <text
                  className="compiled-circuit__source-label"
                  x={(left + right) / 2}
                  y={SOURCE_RAIL_HEIGHT - 12}
                  textAnchor="middle"
                >
                  {`L${group.logicalColumn + 1} ${group.label}`}
                </text>
              </g>
            )
          })}

          {Array.from({ length: qubitCount }).map((_, qubit) => {
            const y = yForQubit(qubit)
            const initialState = circuit.initial_states?.[qubit]
            return (
              <g key={`wire-${qubit}`}>
                <text className="compiled-circuit__qubit-label" x={8} y={y + 4}>
                  {`q${qubit}`}
                </text>
                {initialState ? (
                  <text
                    className="compiled-circuit__qubit-state"
                    x={RAIL_WIDTH - 8}
                    y={y + 4}
                    textAnchor="end"
                  >
                    {`|${initialState}⟩`}
                  </text>
                ) : null}
                <line
                  className="compiled-circuit__wire"
                  x1={RAIL_WIDTH}
                  y1={y}
                  x2={width - 8}
                  y2={y}
                />
              </g>
            )
          })}

          {columns.map((column, columnIndex) => {
            const x = xForColumn(columnIndex)

            return (
              <g key={`column-${column.step}-${columnIndex}`}>
                {column.gates.map((gate, gateIndex) => {
                  const key = `${column.step}-${gateIndex}-${gate.type}`
                  const controls = gate.controls ?? []
                  const qubits = gateQubits(gate)
                  if (qubits.length === 0) {
                    return null
                  }

                  const symbol = targetSymbol(gate.type, controls.length > 0)
                  const topY = Math.min(...qubits.map(yForQubit))
                  const bottomY = Math.max(...qubits.map(yForQubit))
                  const label = gateLabel(gate.type)
                  const theta = thetaLabel(gate)

                  return (
                    <g className="compiled-circuit__gate-group" key={key}>
                      <title>
                        {`${gate.type}${
                          controls.length > 0
                            ? ` control ${controls.map((control) => `q${control}`).join(',')}`
                            : ''
                        } target ${gate.targets.map((target) => `q${target}`).join(',')}${
                          theta === null ? '' : ` θ=${theta}`
                        }`}
                      </title>

                      {bottomY > topY ? (
                        <line
                          className="compiled-circuit__link"
                          x1={x}
                          y1={topY}
                          x2={x}
                          y2={bottomY}
                        />
                      ) : null}

                      {controls.map((control) => (
                        <circle
                          className="compiled-circuit__control"
                          key={`${key}-control-${control}`}
                          cx={x}
                          cy={yForQubit(control)}
                          r={CONTROL_DOT_RADIUS}
                        />
                      ))}

                      {gate.targets.map((target) => {
                        const y = yForQubit(target)

                        if (symbol === 'cross') {
                          return (
                            <g key={`${key}-target-${target}`}>
                              <circle
                                className="compiled-circuit__target-ring"
                                cx={x}
                                cy={y}
                                r={TARGET_RING_RADIUS}
                              />
                              <line
                                className="compiled-circuit__target-cross"
                                x1={x - TARGET_RING_RADIUS}
                                y1={y}
                                x2={x + TARGET_RING_RADIUS}
                                y2={y}
                              />
                              <line
                                className="compiled-circuit__target-cross"
                                x1={x}
                                y1={y - TARGET_RING_RADIUS}
                                x2={x}
                                y2={y + TARGET_RING_RADIUS}
                              />
                            </g>
                          )
                        }

                        if (symbol === 'dot') {
                          return (
                            <circle
                              className="compiled-circuit__control"
                              key={`${key}-target-${target}`}
                              cx={x}
                              cy={y}
                              r={CONTROL_DOT_RADIUS}
                            />
                          )
                        }

                        if (symbol === 'swap') {
                          return (
                            <g key={`${key}-target-${target}`}>
                              <line
                                className="compiled-circuit__target-cross"
                                x1={x - 7}
                                y1={y - 7}
                                x2={x + 7}
                                y2={y + 7}
                              />
                              <line
                                className="compiled-circuit__target-cross"
                                x1={x + 7}
                                y1={y - 7}
                                x2={x - 7}
                                y2={y + 7}
                              />
                            </g>
                          )
                        }

                        const currentBoxWidth = boxWidth(label)
                        return (
                          <g key={`${key}-target-${target}`}>
                            <rect
                              className={`compiled-circuit__box${
                                gate.type === 'MEASURE' ? ' compiled-circuit__box--measure' : ''
                              }`}
                              x={x - currentBoxWidth / 2}
                              y={y - GATE_BOX_HEIGHT / 2}
                              width={currentBoxWidth}
                              height={GATE_BOX_HEIGHT}
                              rx="4"
                            />
                            <text
                              className="compiled-circuit__box-label"
                              x={x}
                              y={y + 4}
                              textAnchor="middle"
                            >
                              {label}
                            </text>
                            {theta === null ? null : (
                              <text
                                className="compiled-circuit__theta"
                                x={x}
                                y={y + GATE_BOX_HEIGHT / 2 + 11}
                                textAnchor="middle"
                              >
                                {`θ=${theta}`}
                              </text>
                            )}
                          </g>
                        )
                      })}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="compiled-circuit__legend">
        <span>
          <code>●</code> 制御ビット
        </span>
        <span>
          <code>⊕</code> CNOT / X の標的
        </span>
        <span>
          <code>1, 2, …</code> 実行される列（コンパイル後の深さ）
        </span>
        {sourceGroups.length > 0 ? <span>赤帯: 展開元の論理列と論理ゲート</span> : null}
      </div>
    </div>
  )
}
