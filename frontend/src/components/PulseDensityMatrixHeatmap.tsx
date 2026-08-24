import { Fragment, useState } from 'react'
import type { PulseComplexValue } from '../types/pulse'
import './PulseDensityMatrixHeatmap.css'

type PulseDensityMatrixHeatmapProps = {
  matrix: PulseComplexValue[][]
  basisLabels?: string[]
  /* 状態エクスプローラーはカーソル時刻の行列も出すので、見出しを差し替えられる。 */
  title?: string
  eyebrow?: string
}

/*
 * 4トランズモン・ネットワークは 81 次元まで来る。全体表示はそこまで許すが、
 * 既定で開くのは 27 次元(=3トランズモン)まで。それ以上は要素数が多すぎて
 * 開いた瞬間に何も読めないので、明示的に押してもらう。
 */
const MAX_FULL_MATRIX_DIMENSION = 81
const DEFAULT_FULL_MATRIX_DIMENSION = 27

/* 各セルに数値を書ける限界。これを超えたら色だけのヒートマップに切り替える。 */
const MAX_LABELLED_CELL_COUNT = 9

export function PulseDensityMatrixHeatmap({
  matrix,
  basisLabels,
  title = '最終密度行列',
  eyebrow = 'FULL DENSITY OPERATOR',
}: PulseDensityMatrixHeatmapProps) {
  const labels = basisLabels ?? matrix.map((_, index) => String(index))
  const [selectedRowState, setSelectedRow] = useState(0)
  const [selectedColumnState, setSelectedColumn] = useState(0)
  const [rowQuery, setRowQuery] = useState(labels[0] ?? '0')
  const [columnQuery, setColumnQuery] = useState(labels[0] ?? '0')
  const [radius, setRadius] = useState(1)
  const [showFullMatrix, setShowFullMatrix] = useState(matrix.length <= DEFAULT_FULL_MATRIX_DIMENSION)
  const [searchError, setSearchError] = useState<string | null>(null)

  const selectedRow = Math.min(selectedRowState, Math.max(0, matrix.length - 1))
  const selectedColumn = Math.min(selectedColumnState, Math.max(0, matrix.length - 1))

  const rowIndices = showFullMatrix
    ? allIndices(matrix.length)
    : neighborhoodIndices(selectedRow, radius, matrix.length)
  const columnIndices = showFullMatrix
    ? allIndices(matrix.length)
    : neighborhoodIndices(selectedColumn, radius, matrix.length)
  const selectedValue = matrix[selectedRow]?.[selectedColumn]
  const compact = columnIndices.length > MAX_LABELLED_CELL_COUNT

  function searchElement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const row = resolveMatrixIndex(rowQuery, labels)
    const column = resolveMatrixIndex(columnQuery, labels)
    if (row === null || column === null) {
      setSearchError(
        `基底ラベルまたは #0〜#${Math.max(0, matrix.length - 1)} の要素番号を入力してください。`,
      )
      return
    }
    setSelectedRow(row)
    setSelectedColumn(column)
    setShowFullMatrix(false)
    setSearchError(null)
  }

  function selectCell(rowIndex: number, columnIndex: number) {
    setSelectedRow(rowIndex)
    setSelectedColumn(columnIndex)
    setRowQuery(labels[rowIndex])
    setColumnQuery(labels[columnIndex])
  }

  function cell(rowIndex: number, columnIndex: number) {
    const value = matrix[rowIndex][columnIndex]
    const magnitude = Math.hypot(value.real, value.imag)
    const description = `rho ${labels[rowIndex]},${labels[columnIndex]}: ${formatComplex(value)}`
    return (
      <button
        type="button"
        className="pulse-density__cell"
        data-tone={value.real >= 0 ? 'positive' : 'negative'}
        data-selected={rowIndex === selectedRow && columnIndex === selectedColumn}
        key={`${rowIndex}-${columnIndex}`}
        /* 小さい非対角要素も見えるように、平方根で伸ばした強度を渡す。 */
        style={{ '--cell-strength': Math.sqrt(Math.min(1, magnitude)) } as React.CSSProperties}
        aria-label={description}
        title={compact ? description : undefined}
        onClick={() => selectCell(rowIndex, columnIndex)}
      >
        {compact ? null : (
          <>
            <span>ρ[|{labels[rowIndex]}⟩, |{labels[columnIndex]}⟩]</span>
            <strong>{formatComplex(value)}</strong>
            <small>|ρ| {magnitude.toFixed(4)}</small>
          </>
        )}
      </button>
    )
  }

  return (
    <section className="pulse-density" aria-labelledby="pulse-density-title">
      <div className="pulse-density__heading">
        <div>
          <span>{eyebrow}</span>
          <h2 id="pulse-density-title">{title}</h2>
        </div>
        <p>{matrix.length} × {matrix.length}、基底数 {labels.length}</p>
      </div>

      <form className="pulse-density__search" onSubmit={searchElement}>
        <div>
          <strong>行列要素を検索</strong>
          <small>基底ラベル（例: 010）または要素番号（例: #7）で指定できます。</small>
        </div>
        <label>
          行 |r⟩
          <input value={rowQuery} onChange={(event) => setRowQuery(event.target.value)} aria-invalid={searchError !== null} />
        </label>
        <label>
          列 |c⟩
          <input value={columnQuery} onChange={(event) => setColumnQuery(event.target.value)} aria-invalid={searchError !== null} />
        </label>
        <label>
          周辺幅
          <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
            <option value={1}>±1</option>
            <option value={2}>±2</option>
            <option value={3}>±3</option>
          </select>
        </label>
        <button type="submit">選択セルと周辺を表示</button>
        {matrix.length <= MAX_FULL_MATRIX_DIMENSION ? (
          <button type="button" className="pulse-density__secondary" onClick={() => setShowFullMatrix((current) => !current)}>
            {showFullMatrix ? '周辺表示へ戻る' : `行列全体（${matrix.length}×${matrix.length}）を表示`}
          </button>
        ) : null}
      </form>

      {searchError ? <p className="pulse-density__error" role="alert">{searchError}</p> : null}
      {selectedValue ? (
        <div className="pulse-density__selection" aria-live="polite">
          <span>選択中 ρ[|{labels[selectedRow]}⟩, |{labels[selectedColumn]}⟩]</span>
          <strong>{formatComplex(selectedValue)}</strong>
          <small>|ρ| = {Math.hypot(selectedValue.real, selectedValue.imag).toFixed(6)}</small>
        </div>
      ) : null}

      <p className="pulse-density__window-note">
        {showFullMatrix
          ? `行列全体（${matrix.length} × ${matrix.length} = ${matrix.length * matrix.length} 要素）を表示中`
          : `行 ${rowIndices[0]}〜${rowIndices.at(-1)}、列 ${columnIndices[0]}〜${columnIndices.at(-1)} を表示中`}
        {compact ? '。セルの濃さが |ρ|（√スケール）、赤がRe ρ≥0、青がRe ρ<0。セルを押すと値を表示します。' : ''}
      </p>
      <div
        className="pulse-density__matrix"
        data-compact={compact}
        aria-label={title}
        style={{ '--matrix-dimension': columnIndices.length } as React.CSSProperties}
      >
        {compact ? (
          <>
            <div className="pulse-density__corner" aria-hidden="true">r\c</div>
            {columnIndices.map((columnIndex) => (
              <div className="pulse-density__column-label" aria-hidden="true" key={`c-${columnIndex}`}>
                <span>{labels[columnIndex]}</span>
              </div>
            ))}
            {rowIndices.map((rowIndex) => (
              <Fragment key={`r-${rowIndex}`}>
                <div className="pulse-density__row-label" aria-hidden="true">{labels[rowIndex]}</div>
                {columnIndices.map((columnIndex) => cell(rowIndex, columnIndex))}
              </Fragment>
            ))}
          </>
        ) : (
          rowIndices.flatMap((rowIndex) => columnIndices.map((columnIndex) => cell(rowIndex, columnIndex)))
        )}
      </div>
    </section>
  )
}

function allIndices(dimension: number): number[] {
  return Array.from({ length: dimension }, (_, index) => index)
}

function neighborhoodIndices(center: number, radius: number, dimension: number): number[] {
  const start = Math.max(0, center - radius)
  const end = Math.min(dimension - 1, center + radius)
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset)
}

function resolveMatrixIndex(query: string, labels: string[]): number | null {
  const normalized = query.trim().replace(/^\|/, '').replace(/⟩$|>$/, '')
  if (normalized.startsWith('#')) {
    const index = Number(normalized.slice(1))
    return Number.isInteger(index) && index >= 0 && index < labels.length ? index : null
  }
  const labelIndex = labels.indexOf(normalized)
  return labelIndex >= 0 ? labelIndex : null
}

function formatComplex(value: PulseComplexValue) {
  const sign = value.imag >= 0 ? '+' : '-'
  return `${value.real.toFixed(4)} ${sign} ${Math.abs(value.imag).toFixed(4)}i`
}
