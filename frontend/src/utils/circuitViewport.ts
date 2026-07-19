export const CIRCUIT_CELL_WIDTH = 136
export const CIRCUIT_CELL_HEIGHT = 84
export const CIRCUIT_LEFT_PADDING = 84
export const CIRCUIT_LABEL_RAIL_WIDTH = 76
export const CIRCUIT_TOP_PADDING = 56
export const CIRCUIT_MIN_ZOOM = 0.5
export const CIRCUIT_MAX_ZOOM = 1.8
export const CIRCUIT_ZOOM_STEP = 0.1
export const CIRCUIT_NAV_GROUP_SIZE = 4

export type VisibleColumnRange = {
  start: number
  end: number
  total: number
}

export function clampZoom(value: number) {
  return Math.min(CIRCUIT_MAX_ZOOM, Math.max(CIRCUIT_MIN_ZOOM, value))
}

export function getCircuitLogicalWidth(columnCount: number) {
  return Math.max(1, columnCount) * CIRCUIT_CELL_WIDTH + CIRCUIT_LEFT_PADDING + 28
}

export function getColumnCenterX(columnIndex: number) {
  return CIRCUIT_LEFT_PADDING + 20 + columnIndex * CIRCUIT_CELL_WIDTH
}

export function getColumnScrollLeft(columnIndex: number, viewportWidth: number, zoom: number) {
  return Math.max(0, getColumnCenterX(columnIndex) * zoom - viewportWidth / 2)
}

export function getFitZoom(columnCount: number, viewportWidth: number) {
  const logicalWidth = getCircuitLogicalWidth(columnCount)
  const availableWidth = Math.max(1, viewportWidth - CIRCUIT_LABEL_RAIL_WIDTH)
  return clampZoom(Math.min(1, availableWidth / Math.max(1, logicalWidth - CIRCUIT_LABEL_RAIL_WIDTH)))
}

export function getVisibleColumnRange({
  columnCount,
  scrollLeft,
  viewportWidth,
  zoom,
}: {
  columnCount: number
  scrollLeft: number
  viewportWidth: number
  zoom: number
}): VisibleColumnRange {
  const total = Math.max(1, columnCount)
  const logicalLeft = scrollLeft / zoom
  const logicalRight = (scrollLeft + viewportWidth) / zoom
  const firstColumnLeft = getColumnCenterX(0) - CIRCUIT_CELL_WIDTH / 2
  const start = Math.min(
    total,
    Math.max(1, Math.floor((logicalLeft - firstColumnLeft) / CIRCUIT_CELL_WIDTH) + 1),
  )
  const end = Math.min(
    total,
    Math.max(start, Math.ceil((logicalRight - firstColumnLeft) / CIRCUIT_CELL_WIDTH)),
  )

  return { start, end, total }
}

export function isColumnVisible(columnIndex: number, range: VisibleColumnRange) {
  const oneBasedColumn = columnIndex + 1
  return oneBasedColumn >= range.start && oneBasedColumn <= range.end
}
