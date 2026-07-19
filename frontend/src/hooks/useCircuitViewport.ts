import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CIRCUIT_NAV_GROUP_SIZE,
  CIRCUIT_ZOOM_STEP,
  clampZoom,
  getColumnScrollLeft,
  getFitZoom,
  getVisibleColumnRange,
  isColumnVisible,
  type VisibleColumnRange,
} from '../utils/circuitViewport'

type UseCircuitViewportArgs = {
  columnCount: number
  selectedColumnIndex: number | null
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useCircuitViewport({
  columnCount,
  selectedColumnIndex,
}: UseCircuitViewportArgs) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [visibleRange, setVisibleRange] = useState<VisibleColumnRange>({
    start: 1,
    end: Math.max(1, columnCount),
    total: Math.max(1, columnCount),
  })
  const [highlightedColumnIndex, setHighlightedColumnIndex] = useState<number | null>(null)

  const updateVisibleRange = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      setVisibleRange({ start: 1, end: Math.max(1, columnCount), total: Math.max(1, columnCount) })
      return
    }

    setVisibleRange(
      getVisibleColumnRange({
        columnCount,
        scrollLeft: viewport.scrollLeft,
        viewportWidth: viewport.clientWidth,
        zoom,
      }),
    )
  }, [columnCount, zoom])

  const markColumn = useCallback((columnIndex: number) => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
    }

    setHighlightedColumnIndex(columnIndex)
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedColumnIndex(null)
      highlightTimeoutRef.current = null
    }, 1100)
  }, [])

  const scrollToColumn = useCallback(
    (columnIndex: number, options: { highlight?: boolean } = {}) => {
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }

      const clampedColumn = Math.min(Math.max(0, columnIndex), Math.max(0, columnCount - 1))
      viewport.scrollTo({
        left: getColumnScrollLeft(clampedColumn, viewport.clientWidth, zoom),
        behavior: 'smooth',
      })

      if (options.highlight) {
        markColumn(clampedColumn)
      }

      window.requestAnimationFrame(updateVisibleRange)
    },
    [columnCount, markColumn, updateVisibleRange, zoom],
  )

  const revealColumnIfNeeded = useCallback(
    (columnIndex: number) => {
      if (isColumnVisible(columnIndex, visibleRange)) {
        return
      }

      scrollToColumn(columnIndex, { highlight: true })
    },
    [scrollToColumn, visibleRange],
  )

  const setZoomValue = useCallback(
    (nextZoom: number) => {
      setZoom(clampZoom(nextZoom))
      window.requestAnimationFrame(updateVisibleRange)
    },
    [updateVisibleRange],
  )

  const zoomIn = useCallback(() => {
    setZoomValue(zoom + CIRCUIT_ZOOM_STEP)
  }, [setZoomValue, zoom])

  const zoomOut = useCallback(() => {
    setZoomValue(zoom - CIRCUIT_ZOOM_STEP)
  }, [setZoomValue, zoom])

  const resetZoom = useCallback(() => {
    setZoomValue(1)
  }, [setZoomValue])

  const fitCircuit = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    setZoomValue(getFitZoom(columnCount, viewport.clientWidth))
    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: 0, behavior: 'smooth' })
      updateVisibleRange()
    })
  }, [columnCount, setZoomValue, updateVisibleRange])

  const goFirst = useCallback(() => {
    scrollToColumn(0, { highlight: true })
  }, [scrollToColumn])

  const goLast = useCallback(() => {
    scrollToColumn(Math.max(0, columnCount - 1), { highlight: true })
  }, [columnCount, scrollToColumn])

  const goPreviousGroup = useCallback(() => {
    scrollToColumn(Math.max(0, visibleRange.start - 1 - CIRCUIT_NAV_GROUP_SIZE), { highlight: true })
  }, [scrollToColumn, visibleRange.start])

  const goNextGroup = useCallback(() => {
    scrollToColumn(Math.min(columnCount - 1, visibleRange.start - 1 + CIRCUIT_NAV_GROUP_SIZE), {
      highlight: true,
    })
  }, [columnCount, scrollToColumn, visibleRange.start])

  useEffect(() => {
    updateVisibleRange()
  }, [updateVisibleRange])

  useEffect(() => {
    if (selectedColumnIndex === null) {
      return
    }

    revealColumnIfNeeded(selectedColumnIndex)
  }, [revealColumnIfNeeded, selectedColumnIndex])

  useEffect(() => {
    function handleWindowKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) {
        return
      }

      if (event.metaKey || event.ctrlKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          zoomIn()
        } else if (event.key === '-') {
          event.preventDefault()
          zoomOut()
        } else if (event.key === '0') {
          event.preventDefault()
          resetZoom()
        }
        return
      }

      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        fitCircuit()
      } else if (event.key === 'Home') {
        event.preventDefault()
        goFirst()
      } else if (event.key === 'End') {
        event.preventDefault()
        goLast()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [fitCircuit, goFirst, goLast, resetZoom, zoomIn, zoomOut])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
    }
  }, [])

  return {
    viewportRef,
    zoom,
    visibleRange,
    highlightedColumnIndex,
    updateVisibleRange,
    setZoomValue,
    zoomIn,
    zoomOut,
    resetZoom,
    fitCircuit,
    scrollToColumn,
    revealSelectedColumn: () => {
      if (selectedColumnIndex !== null) {
        scrollToColumn(selectedColumnIndex, { highlight: true })
      }
    },
    goFirst,
    goPreviousGroup,
    goNextGroup,
    goLast,
  }
}
