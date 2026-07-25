import { type FormEvent } from 'react'
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
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = event.currentTarget.elements.namedItem('column')
    if (!(input instanceof HTMLInputElement)) {
      return
    }

    const parsedColumn = Number.parseInt(input.value, 10)
    if (Number.isNaN(parsedColumn)) {
      input.value = String(visibleRange.start)
      return
    }

    const clampedColumn = clampColumn(parsedColumn, columnCount)
    input.value = String(clampedColumn)
    onJumpToColumn(clampedColumn - 1)
  }

  return (
    <form className="circuit-column-navigator" aria-label="列ナビゲーター" onSubmit={handleSubmit}>
      <span className="circuit-workspace__tool-label">列</span>
      <button type="button" onClick={onFirst} title="最初の列 (Home)">
        最初
      </button>
      <button type="button" onClick={onPreviousGroup} title="前の 4 列">
        前へ
      </button>
      <label className="circuit-column-navigator__jump">
        <span>移動</span>
        <input
          key={visibleRange.start}
          name="column"
          type="number"
          min="1"
          max={Math.max(1, columnCount)}
          defaultValue={String(visibleRange.start)}
        />
      </label>
      <button type="submit">移動</button>
      <button type="button" onClick={onNextGroup} title="次の 4 列">
        次へ
      </button>
      <button type="button" onClick={onLast} title="最後の列 (End)">
        最後
      </button>
      <span className="circuit-column-navigator__range">
        {visibleRange.total} 列中 {visibleRange.start}〜{visibleRange.end} を表示
      </span>
    </form>
  )
}
