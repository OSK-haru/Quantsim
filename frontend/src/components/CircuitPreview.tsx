import './CircuitPreview.css'
import type { CircuitPreviewData } from '../types/circuit'

type CircuitPreviewProps = {
  circuit: CircuitPreviewData
}

export function CircuitPreview({ circuit }: CircuitPreviewProps) {
  const rowHeight = 84
  const leftPadding = 84
  const columnWidth = 136
  const wireWidth = circuit.columns.length * columnWidth + leftPadding + 28
  const height = Math.max(220, circuit.qubit_count * rowHeight + 48)

  return (
    <section className="circuit-preview" aria-label="Circuit preview">
      <div className="circuit-preview__header">
        <div>
          <div className="circuit-preview__eyebrow">Preview</div>
          <h2 className="circuit-preview__title">Circuit preview</h2>
          <p className="circuit-preview__subtitle">
            Static mock circuit, backend connection not enabled yet.
          </p>
        </div>
      </div>

      <div className="circuit-preview__viewport">
        <svg
          className="circuit-preview__svg"
          viewBox={`0 0 ${wireWidth} ${height}`}
          role="img"
          aria-label="Static mock quantum circuit"
        >
          {Array.from({ length: circuit.qubit_count }).map((_, qubit) => {
            const y = 56 + qubit * rowHeight
            return (
              <g key={qubit}>
                <text x="20" y={y + 6} className="circuit-preview__qubit-label">
                  q{qubit}
                </text>
                <line x1={leftPadding} y1={y} x2={wireWidth - 20} y2={y} className="circuit-preview__wire" />
              </g>
            )
          })}

          {circuit.columns.map((column, columnIndex) => {
            const x = leftPadding + 20 + columnIndex * columnWidth
            return (
              <g key={column.id}>
                {column.duration_us != null ? (
                  <text x={x + 6} y="24" className="circuit-preview__duration">
                    {column.duration_us.toFixed(2)} us
                  </text>
                ) : null}

                {column.gates.map((gate) => {
                  const y = 56 + gate.qubits[0] * rowHeight

                  if (gate.kind === 'idle') {
                    return null
                  }

                  if (gate.kind === 'measure') {
                    return (
                      <g key={`${column.id}-${gate.label}-${gate.qubits[0]}`}>
                        <rect x={x - 18} y={y - 22} width="36" height="36" rx="8" className="circuit-preview__gate circuit-preview__gate--measure" />
                        <text x={x} y={y + 5} textAnchor="middle" className="circuit-preview__gate-label">
                          M
                        </text>
                      </g>
                    )
                  }

                  if (gate.kind === 'single') {
                    return (
                      <g key={`${column.id}-${gate.label}-${gate.qubits[0]}`}>
                        <rect x={x - 18} y={y - 22} width="36" height="36" rx="8" className="circuit-preview__gate" />
                        <text x={x} y={y + 5} textAnchor="middle" className="circuit-preview__gate-label">
                          {gate.label}
                        </text>
                      </g>
                    )
                  }

                  if (gate.kind === 'control') {
                    return (
                      <g key={`${column.id}-${gate.label}-${gate.qubits[0]}`}>
                        <circle cx={x} cy={y} r="8" className="circuit-preview__control-dot" />
                      </g>
                    )
                  }

                  if (gate.kind === 'target') {
                    return (
                      <g key={`${column.id}-${gate.label}-${gate.qubits[0]}`}>
                        <circle cx={x} cy={y} r="16" className="circuit-preview__target-ring" />
                        <line x1={x - 10} y1={y} x2={x + 10} y2={y} className="circuit-preview__target-cross" />
                        <line x1={x} y1={y - 10} x2={x} y2={y + 10} className="circuit-preview__target-cross" />
                      </g>
                    )
                  }

                  return null
                })}

                {column.gates.some((gate) => gate.kind === 'control') &&
                column.gates.some((gate) => gate.kind === 'target') ? (
                  <line
                    x1={x}
                    y1={56}
                    x2={x}
                    y2={56 + (circuit.qubit_count - 1) * rowHeight}
                    className="circuit-preview__cnot-line"
                  />
                ) : null}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
