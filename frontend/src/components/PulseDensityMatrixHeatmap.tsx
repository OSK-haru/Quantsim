import type { PulseComplexValue } from '../types/pulse'
import './PulseDensityMatrixHeatmap.css'

type PulseDensityMatrixHeatmapProps = {
  matrix: PulseComplexValue[][]
  basisLabels?: string[]
}

export function PulseDensityMatrixHeatmap({ matrix, basisLabels }: PulseDensityMatrixHeatmapProps) {
  const labels = basisLabels ?? matrix.map((_, index) => String(index))
  return (
    <section className="pulse-density" aria-labelledby="pulse-density-title">
      <div className="pulse-density__heading">
        <div>
          <span>FULL DENSITY OPERATOR</span>
          <h2 id="pulse-density-title">Final density matrix</h2>
        </div>
        <p>{matrix.length} x {matrix.length}, basis {labels.map((label) => `|${label}>`).join(', ')}</p>
      </div>
      <div className="pulse-density__matrix" role="table" aria-label="Final density matrix" style={{ '--matrix-dimension': matrix.length } as React.CSSProperties}>
        {matrix.flatMap((row, rowIndex) =>
          row.map((value, columnIndex) => {
            const magnitude = Math.hypot(value.real, value.imag)
            const tone = value.real >= 0 ? 'positive' : 'negative'
            return (
              <div
                className="pulse-density__cell"
                data-tone={tone}
                key={`${rowIndex}-${columnIndex}`}
                role="cell"
                style={{ '--cell-strength': Math.min(1, magnitude) } as React.CSSProperties}
                aria-label={`rho ${rowIndex}${columnIndex}: ${formatComplex(value)}`}
              >
                <span>rho[{labels[rowIndex]},{labels[columnIndex]}]</span>
                <strong>{formatComplex(value)}</strong>
                <small>|rho| {magnitude.toFixed(4)}</small>
              </div>
            )
          }),
        )}
      </div>
    </section>
  )
}

function formatComplex(value: PulseComplexValue) {
  const sign = value.imag >= 0 ? '+' : '-'
  return `${value.real.toFixed(4)} ${sign} ${Math.abs(value.imag).toFixed(4)}i`
}
