import type { CircuitEditorState } from '../types/circuit'
import { DEFAULT_EDITOR_COLUMN_COUNT, ensureCircuitColumnCount } from './circuitEditing'

/*
 * 編集を始めるときの回路。
 *
 * 以前はここで Bell 回路（H + CNOT）をあらかじめ組んで渡していた。
 * いまはチュートリアルで利用者自身に Bell 回路を組んでもらうので、
 * 最初から答えが置いてあると練習にならない。空の2量子ビット回路にする。
 */
export function createDefaultCircuit(): CircuitEditorState {
  return ensureCircuitColumnCount({
    logical_qubits: 2,
    initial_states: [0, 0],
    columns: [],
  }, DEFAULT_EDITOR_COLUMN_COUNT)
}
