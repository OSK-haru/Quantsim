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
          <span>全密度演算子</span>
          <h2 id="pulse-density-title">最終密度行列</h2>
        </div>
        <p>{matrix.length} x {matrix.length}、基底 {labels.map((label) => `|${label}>`).join(', ')}</p>
      </div>
      <div className="pulse-density__matrix" role="table" aria-label="最終密度行列" style={{ '--matrix-dimension': matrix.length } as React.CSSProperties}>
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
                aria-label={`ρ${rowIndex}${columnIndex}: ${formatComplex(value)}`}
              >
                <span>ρ[{labels[rowIndex]},{labels[columnIndex]}]</span>
                <strong>{formatComplex(value)}</strong>
                <small>|ρ| {magnitude.toFixed(4)}</small>
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
