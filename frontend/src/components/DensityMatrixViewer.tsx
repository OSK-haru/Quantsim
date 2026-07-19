import { Fragment, useEffect, useState, type CSSProperties } from 'react'
import './DensityMatrixViewer.css'
import type { StateSnapshot } from '../types/simulation'
import {
  formatDensityValue,
  formatSnapshotProgress,
  formatSnapshotTimeUs,
  snapshotKindLabel,
  validateDensityMatrixSnapshot,
  type DensityMatrixCell,
  type DensityMatrixMode,
} from '../utils/densityMatrix'

type DensityMatrixViewerProps = {
  snapshots?: StateSnapshot[] | null
}

const MODE_OPTIONS: Array<{ label: string; value: DensityMatrixMode }> = [
  { label: 'Magnitude', value: 'magnitude' },
  { label: 'Real', value: 'real' },
  { label: 'Imaginary', value: 'imaginary' },
]

type DensityCellStyle = CSSProperties & {
  '--density-cell-alpha': string
}

export function DensityMatrixViewer({ snapshots }: DensityMatrixViewerProps) {
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : []
  const [snapshotIndex, setSnapshotIndex] = useState(0)
  const [mode, setMode] = useState<DensityMatrixMode>('magnitude')
  const [activeCell, setActiveCell] = useState<DensityMatrixCell | null>(null)

  useEffect(() => {
    setSnapshotIndex((currentIndex) => {
      if (safeSnapshots.length === 0) {
        return 0
      }
      return Math.min(currentIndex, safeSnapshots.length - 1)
    })
  }, [safeSnapshots.length])

  useEffect(() => {
    setActiveCell(null)
  }, [snapshotIndex, mode])

  if (safeSnapshots.length === 0) {
    return (
      <p className="density-matrix-viewer__empty">
        No density matrix snapshots are available for this run.
      </p>
    )
  }

  const activeSnapshot = safeSnapshots[snapshotIndex]
  const validation = validateDensityMatrixSnapshot(activeSnapshot, mode)

  function goToPreviousSnapshot() {
    setSnapshotIndex((currentIndex) => Math.max(currentIndex - 1, 0))
  }

  function goToNextSnapshot() {
    setSnapshotIndex((currentIndex) => Math.min(currentIndex + 1, safeSnapshots.length - 1))
  }

  return (
    <div className="density-matrix-viewer">
      <div className="density-matrix-viewer__toolbar">
        <div className="density-matrix-viewer__navigation" aria-label="Snapshot navigation">
          <button
            className="density-matrix-viewer__button"
            type="button"
            onClick={goToPreviousSnapshot}
            disabled={snapshotIndex === 0}
          >
            Previous snapshot
          </button>
          <span className="density-matrix-viewer__position" aria-live="polite">
            {snapshotIndex + 1} / {safeSnapshots.length}
          </span>
          <button
            className="density-matrix-viewer__button"
            type="button"
            onClick={goToNextSnapshot}
            disabled={snapshotIndex === safeSnapshots.length - 1}
          >
            Next snapshot
          </button>
        </div>

        <label className="density-matrix-viewer__slider-label">
          <span>Snapshot</span>
          <input
            className="density-matrix-viewer__slider"
            type="range"
            min="0"
            max={Math.max(safeSnapshots.length - 1, 0)}
            step="1"
            value={snapshotIndex}
            onChange={(event) => setSnapshotIndex(Number(event.currentTarget.value))}
          />
        </label>

        <div className="density-matrix-viewer__modes" aria-label="Density matrix view mode">
          {MODE_OPTIONS.map((option) => (
            <button
              className="density-matrix-viewer__mode"
              data-active={mode === option.value}
              type="button"
              aria-pressed={mode === option.value}
              key={option.value}
              onClick={() => setMode(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="density-matrix-viewer__metadata" aria-label="Snapshot metadata">
        <span>{snapshotKindLabel(activeSnapshot)}</span>
        <span>{formatSnapshotTimeUs(activeSnapshot.time_us)}</span>
        <span>{formatSnapshotProgress(activeSnapshot.progress)}</span>
        {activeSnapshot?.column_index == null ? null : (
          <span>Column {activeSnapshot.column_index + 1}</span>
        )}
        {activeSnapshot?.requested_time_us == null ? null : (
          <span>Requested {formatSnapshotTimeUs(activeSnapshot.requested_time_us)}</span>
        )}
        {activeSnapshot?.capture_method ? (
          <span>Capture {activeSnapshot.capture_method}</span>
        ) : null}
        {activeSnapshot?.event_kind ? (
          <span>Event {activeSnapshot.event_kind}</span>
        ) : null}
      </div>

      {!validation.valid ? (
        <p className="density-matrix-viewer__empty">{validation.message}</p>
      ) : (
        <>
          <div className="density-matrix-viewer__caption">
            <span>
              {validation.matrix.dimension}x{validation.matrix.dimension} density matrix /
              {' '}
              {validation.matrix.qubitCount} qubits
            </span>
            <span>Per-snapshot scale: {validation.matrix.scaleLabel}</span>
          </div>

          <div className="density-matrix-viewer__matrix-scroll" tabIndex={0}>
            <div
              className="density-matrix-viewer__matrix"
              style={{
                gridTemplateColumns: `var(--density-label-size) repeat(${validation.matrix.dimension}, var(--density-cell-size))`,
              }}
              role="grid"
              aria-label={`${MODE_OPTIONS.find((option) => option.value === mode)?.label} density matrix heatmap`}
            >
              <div className="density-matrix-viewer__corner" aria-hidden="true" />
              {validation.matrix.labels.map((label) => (
                <div
                  className="density-matrix-viewer__axis-label density-matrix-viewer__axis-label--column"
                  role="columnheader"
                  key={`column-${label}`}
                >
                  {label}
                </div>
              ))}

              {validation.matrix.labels.map((rowLabel, rowIndex) => (
                <Fragment key={`row-${rowLabel}`}>
                  <div
                    className="density-matrix-viewer__axis-label density-matrix-viewer__axis-label--row"
                    role="rowheader"
                    key={`row-label-${rowLabel}`}
                  >
                    {rowLabel}
                  </div>
                  {validation.matrix.cells
                    .filter((cell) => cell.row === rowIndex)
                    .map((cell) => {
                      const cellStyle: DensityCellStyle = {
                        '--density-cell-alpha': `${0.08 + cell.intensity * 0.82}`,
                      }

                      return (
                        <button
                          className="density-matrix-viewer__cell"
                          data-sign={mode === 'magnitude' ? 'positive' : cell.sign}
                          type="button"
                          role="gridcell"
                          key={`${cell.row}-${cell.column}`}
                          style={cellStyle}
                          title={cellTitle(cell)}
                          aria-label={cellTitle(cell)}
                          onFocus={() => setActiveCell(cell)}
                          onMouseEnter={() => setActiveCell(cell)}
                        >
                          <span className="density-matrix-viewer__cell-value">
                            {formatCellValue(cell.value)}
                          </span>
                        </button>
                      )
                    })}
                </Fragment>
              ))}
            </div>
          </div>

          <div className="density-matrix-viewer__details" aria-live="polite">
            {activeCell === null ? (
              <span>Hover or focus a cell to inspect exact values.</span>
            ) : (
              <>
                <strong>
                  rho[{activeCell.rowLabel}, {activeCell.columnLabel}]
                </strong>
                <span>real: {formatDensityValue(activeCell.real)}</span>
                <span>imag: {formatDensityValue(activeCell.imag)}</span>
                <span>magnitude: {formatDensityValue(activeCell.magnitude)}</span>
              </>
            )}
          </div>

          <p className="density-matrix-viewer__note">
            Basis labels follow QuantaScope q0 -&gt; qN-1 ordering.
          </p>
        </>
      )}
    </div>
  )
}

function cellTitle(cell: DensityMatrixCell): string {
  return [
    `rho[${cell.rowLabel}, ${cell.columnLabel}]`,
    `real: ${formatDensityValue(cell.real)}`,
    `imag: ${formatDensityValue(cell.imag)}`,
    `magnitude: ${formatDensityValue(cell.magnitude)}`,
  ].join('\n')
}

function formatCellValue(value: number): string {
  if (Math.abs(value) < 0.0005) {
    return ''
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(1)
  }
  return value.toFixed(2)
}
