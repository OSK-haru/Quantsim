import { Fragment, useState, type CSSProperties } from 'react'
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
  snapshotIndex?: number
  onSnapshotIndexChange?: (snapshotIndex: number) => void
}

const MODE_OPTIONS: Array<{ label: string; value: DensityMatrixMode }> = [
  { label: '絶対値', value: 'magnitude' },
  { label: '実部', value: 'real' },
  { label: '虚部', value: 'imaginary' },
]

type DensityCellStyle = CSSProperties & {
  '--density-cell-alpha': string
}

type ActiveCellSelection = {
  key: string
  cell: DensityMatrixCell
}

export function DensityMatrixViewer({
  snapshots,
  snapshotIndex: controlledSnapshotIndex,
  onSnapshotIndexChange,
}: DensityMatrixViewerProps) {
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : []
  const [internalSnapshotIndex, setInternalSnapshotIndex] = useState(0)
  const [mode, setMode] = useState<DensityMatrixMode>('magnitude')
  const [activeCellSelection, setActiveCellSelection] = useState<ActiveCellSelection | null>(null)
  const requestedSnapshotIndex = controlledSnapshotIndex ?? internalSnapshotIndex
  const snapshotIndex = clamp(requestedSnapshotIndex, 0, Math.max(safeSnapshots.length - 1, 0))
  const activeCellKey = `${snapshotIndex}:${mode}`
  const activeCell = activeCellSelection?.key === activeCellKey
    ? activeCellSelection.cell
    : null

  if (safeSnapshots.length === 0) {
    return (
      <p className="density-matrix-viewer__empty">
        この実行には密度行列スナップショットがありません。
      </p>
    )
  }

  const activeSnapshot = safeSnapshots[snapshotIndex]
  const validation = validateDensityMatrixSnapshot(activeSnapshot, mode)

  function selectSnapshot(nextSnapshotIndex: number) {
    const clampedIndex = clamp(nextSnapshotIndex, 0, safeSnapshots.length - 1)
    if (onSnapshotIndexChange) {
      onSnapshotIndexChange(clampedIndex)
      return
    }
    setInternalSnapshotIndex(clampedIndex)
  }

  function goToPreviousSnapshot() {
    selectSnapshot(snapshotIndex - 1)
  }

  function goToNextSnapshot() {
    selectSnapshot(snapshotIndex + 1)
  }

  return (
    <div className="density-matrix-viewer">
      <div className="density-matrix-viewer__toolbar">
        <div className="density-matrix-viewer__navigation" aria-label="スナップショットのナビゲーション">
          <button
            className="density-matrix-viewer__button"
            type="button"
            onClick={goToPreviousSnapshot}
            disabled={snapshotIndex === 0}
          >
            前のスナップショット
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
            次のスナップショット
          </button>
        </div>

        <label className="density-matrix-viewer__slider-label">
          <span>スナップショット</span>
          <input
            className="density-matrix-viewer__slider"
            type="range"
            min="0"
            max={Math.max(safeSnapshots.length - 1, 0)}
            step="1"
            value={snapshotIndex}
            onChange={(event) => selectSnapshot(Number(event.currentTarget.value))}
          />
        </label>

        <div className="density-matrix-viewer__modes" aria-label="密度行列の表示モード">
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

      <div className="density-matrix-viewer__metadata" aria-label="スナップショットのメタデータ">
        <span>{snapshotKindLabel(activeSnapshot)}</span>
        <span>{formatSnapshotTimeUs(activeSnapshot.time_us)}</span>
        <span>{formatSnapshotProgress(activeSnapshot.progress)}</span>
        {activeSnapshot?.column_index == null ? null : (
          <span>列 {activeSnapshot.column_index + 1}</span>
        )}
        {activeSnapshot?.requested_time_us == null ? null : (
          <span>指定時刻 {formatSnapshotTimeUs(activeSnapshot.requested_time_us)}</span>
        )}
        {activeSnapshot?.capture_method ? (
          <span>取得方法 {activeSnapshot.capture_method}</span>
        ) : null}
        {activeSnapshot?.event_kind ? (
          <span>イベント {activeSnapshot.event_kind}</span>
        ) : null}
      </div>

      {!validation.valid ? (
        <p className="density-matrix-viewer__empty">{validation.message}</p>
      ) : (
        <>
          <div className="density-matrix-viewer__caption">
            <span>
              {validation.matrix.dimension}x{validation.matrix.dimension} 密度行列 /
              {' '}
              {validation.matrix.qubitCount} qubits
            </span>
            <span>スナップショットごとのスケール: {validation.matrix.scaleLabel}</span>
          </div>

          <div className="density-matrix-viewer__matrix-scroll" tabIndex={0}>
            <div
              className="density-matrix-viewer__matrix"
              style={{
                gridTemplateColumns: `var(--density-label-size) repeat(${validation.matrix.dimension}, var(--density-cell-size))`,
              }}
              role="grid"
              aria-label={`${MODE_OPTIONS.find((option) => option.value === mode)?.label} 密度行列ヒートマップ`}
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
                          onFocus={() => setActiveCellSelection({ key: activeCellKey, cell })}
                          onMouseEnter={() => setActiveCellSelection({ key: activeCellKey, cell })}
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
              <span>セルにカーソルを合わせるかフォーカスすると、正確な値を確認できます。</span>
            ) : (
              <>
                <strong>
                  rho[{activeCell.rowLabel}, {activeCell.columnLabel}]
                </strong>
                <span>実部: {formatDensityValue(activeCell.real)}</span>
                <span>虚部: {formatDensityValue(activeCell.imag)}</span>
                <span>絶対値: {formatDensityValue(activeCell.magnitude)}</span>
              </>
            )}
          </div>

          <p className="density-matrix-viewer__note">
            基底ラベルは QuantaScope の q0 -&gt; qN-1 の順序に従います。
          </p>
        </>
      )}
    </div>
  )
}

function cellTitle(cell: DensityMatrixCell): string {
  return [
    `rho[${cell.rowLabel}, ${cell.columnLabel}]`,
    `実部: ${formatDensityValue(cell.real)}`,
    `虚部: ${formatDensityValue(cell.imag)}`,
    `絶対値: ${formatDensityValue(cell.magnitude)}`,
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
