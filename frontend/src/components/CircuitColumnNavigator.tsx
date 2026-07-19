import { useEffect, useState, type FormEvent } from 'react'
import './CircuitColumnNavigator.css'
import type { VisibleColumnRange } from '../utils/circuitViewport'

type CircuitColumnNavigatorProps = {
  columnCount: number
  visibleRange: VisibleColumnRange
  onJumpToColumn: (columnIndex: number) => void
  onFirst: () => void
  onPreviousGroup: () => void
  onNextGroup: () => void
  onLast: () => void
}

function clampColumn(value: number, columnCount: number) {
  return Math.min(Math.max(1, value), Math.max(1, columnCount))
}

export function CircuitColumnNavigator({
  columnCount,
  visibleRange,
  onJumpToColumn,
  onFirst,
  onPreviousGroup,
  onNextGroup,
  onLast,
}: CircuitColumnNavigatorProps) {
  const [columnInput, setColumnInput] = useState(String(visibleRange.start))

  useEffect(() => {
    setColumnInput(String(visibleRange.start))
  }, [visibleRange.start])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedColumn = Number.parseInt(columnInput, 10)
    if (Number.isNaN(parsedColumn)) {
      setColumnInput(String(visibleRange.start))
      return
    }

    const clampedColumn = clampColumn(parsedColumn, columnCount)
    setColumnInput(String(clampedColumn))
    onJumpToColumn(clampedColumn - 1)
  }

  return (
    <form className="circuit-column-navigator" aria-label="Column navigator" onSubmit={handleSubmit}>
      <span className="circuit-workspace__tool-label">Columns</span>
      <button type="button" onClick={onFirst} title="First column (Home)">
        First
      </button>
      <button type="button" onClick={onPreviousGroup} title="Previous 4 columns">
        Prev
      </button>
      <label className="circuit-column-navigator__jump">
        <span>Jump</span>
        <input
          type="number"
          min="1"
          max={Math.max(1, columnCount)}
          value={columnInput}
          onChange={(event) => setColumnInput(event.target.value)}
        />
      </label>
      <button type="submit">Go</button>
      <button type="button" onClick={onNextGroup} title="Next 4 columns">
        Next
      </button>
      <button type="button" onClick={onLast} title="Last column (End)">
        Last
      </button>
      <span className="circuit-column-navigator__range">
        Showing {visibleRange.start}-{visibleRange.end} of {visibleRange.total}
      </span>
    </form>
  )
}
