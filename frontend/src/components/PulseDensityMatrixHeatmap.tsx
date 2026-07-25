import type { PulseComplexValue } from '../types/pulse'
import './PulseDensityMatrixHeatmap.css'

type PulseDensityMatrixHeatmapProps = {
  matrix: PulseComplexValue[][]
}

export function PulseDensityMatrixHeatmap({ matrix }: PulseDensityMatrixHeatmapProps) {
  return (
    <section className="pulse-density" aria-labelledby="pulse-density-title">
      <div className="pulse-density__heading">
        <div>
          <span>FULL QUTRIT STATE</span>
          <h2 id="pulse-density-title">Final density matrix</h2>
        </div>
        <p>3 x 3, basis |0&gt;, |1&gt;, |2&gt;</p>
      </div>
      <div className="pulse-density__matrix" role="table" aria-label="Final qutrit density matrix">
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
                <span>rho{rowIndex}{columnIndex}</span>
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
