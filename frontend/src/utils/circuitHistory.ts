import type { CircuitEditorState } from '../types/circuit'

export type CircuitHistoryState = {
  past: CircuitEditorState[]
  present: CircuitEditorState
  future: CircuitEditorState[]
}

export const CIRCUIT_HISTORY_LIMIT = 50

export function createCircuitHistory(present: CircuitEditorState): CircuitHistoryState {
  return {
    past: [],
    present,
    future: [],
  }
}

export function canUndo(history: CircuitHistoryState) {
  return history.past.length > 0
}

export function canRedo(history: CircuitHistoryState) {
  return history.future.length > 0
}

export function commitCircuitChange(
  history: CircuitHistoryState,
  nextPresent: CircuitEditorState,
): CircuitHistoryState {
  if (history.present === nextPresent) {
    return history
  }

  const past = [...history.past, history.present]
  const boundedPast =
    past.length > CIRCUIT_HISTORY_LIMIT
      ? past.slice(past.length - CIRCUIT_HISTORY_LIMIT)
      : past

  return {
    past: boundedPast,
    present: nextPresent,
    future: [],
  }
}

export function undoCircuitChange(history: CircuitHistoryState): CircuitHistoryState {
  if (history.past.length === 0) {
    return history
  }

  const nextPast = history.past.slice(0, -1)
  const nextPresent = history.past[history.past.length - 1]
  return {
    past: nextPast,
    present: nextPresent,
    future: [history.present, ...history.future],
  }
}

export function redoCircuitChange(history: CircuitHistoryState): CircuitHistoryState {
  if (history.future.length === 0) {
    return history
  }

  const [nextPresent, ...nextFuture] = history.future
  return {
    past: [...history.past, history.present],
    present: nextPresent,
    future: nextFuture,
  }
}
