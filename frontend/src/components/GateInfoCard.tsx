import './GateInfoCard.css'
import type { GateReferenceEntry } from '../utils/gateReference'

type GateInfoCardProps = {
  gateLabel: string
  entry: GateReferenceEntry
}

export function GateInfoCard({ gateLabel, entry }: GateInfoCardProps) {
  return (
    <div className="gate-info-card" role="tooltip">
      <div className="gate-info-card__header">
        <strong>{gateLabel}</strong>
        <span className={`gate-info-card__family gate-info-card__family--${entry.family}`}>
          {familyLabel(entry.family)}
        </span>
      </div>
      <p className="gate-info-card__description">{entry.description}</p>
      {entry.matrix ? (
        <div className="gate-info-card__matrix-row">
          {entry.matrix.prefix ? (
            <span className="gate-info-card__matrix-prefix">{entry.matrix.prefix}</span>
          ) : null}
          <div
            className="gate-info-card__matrix"
            style={{ gridTemplateColumns: `repeat(${entry.matrix.rows[0]?.length ?? 1}, auto)` }}
          >
            {entry.matrix.rows.map((row, rowIndex) =>
              row.map((cell, columnIndex) => (
                <span className="gate-info-card__matrix-cell" key={`${rowIndex}-${columnIndex}`}>
                  {cell}
                </span>
              )),
            )}
          </div>
        </div>
      ) : null}
      {entry.note ? <p className="gate-info-card__note">{entry.note}</p> : null}
    </div>
  )
}

function familyLabel(family: GateReferenceEntry['family']) {
  switch (family) {
    case 'rotation':
      return '回転ゲート'
    case 'phase':
      return '位相ゲート'
    case 'control':
      return '複数量子ビット'
    case 'measurement':
      return '測定'
    case 'annotation':
      return '表示専用'
    default:
      return family
  }
}
