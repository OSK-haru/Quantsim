import { useMemo } from 'react'
import type { CircuitEditorState } from '../types/circuit'
import type { StateSnapshot } from '../types/simulation'
import type { StateTransferMetadata } from '../types/simulation'
import './MessageReceiveStateTransferView.css'

type Props = {
  circuit: CircuitEditorState
  noisySnapshots: StateSnapshot[]
  idealSnapshots: StateSnapshot[]
  stateTransfer?: StateTransferMetadata
}

type Matrix = { real: number[][]; imag: number[][] }
type Role = { column: number; qubit: number }

function reducedSingleQubit(matrix: Matrix | null | undefined, qubit: number, qubitCount: number): Matrix | null {
  if (!matrix) return null
  const dimension = 2 ** qubitCount
  if (matrix.real.length !== dimension || matrix.imag.length !== dimension) return null
  const bit = qubitCount - 1 - qubit
  const real = [[0, 0], [0, 0]]
  const imag = [[0, 0], [0, 0]]
  for (let row = 0; row < dimension; row += 1) {
    for (let column = 0; column < dimension; column += 1) {
      if ((row & ~(1 << bit)) !== (column & ~(1 << bit))) continue
      const rowQ = (row >> bit) & 1
      const columnQ = (column >> bit) & 1
      real[rowQ][columnQ] += matrix.real[row][column]
      imag[rowQ][columnQ] += matrix.imag[row][column]
    }
  }
  return { real, imag }
}

function metric(a: Matrix | null, b: Matrix | null): number | null {
  if (!a || !b) return null
  let distance = 0
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 2; column += 1) {
    distance += Math.hypot(a.real[row][column] - b.real[row][column], a.imag[row][column] - b.imag[row][column]) ** 2
  }
  return Math.sqrt(distance)
}

function boundarySnapshot(snapshots: StateSnapshot[], column: number | null): StateSnapshot | null {
  if (!snapshots.length) return null
  const candidates = column === null ? [] : snapshots.filter((item) => item.column_index === column)
  return candidates.find((item) => item.kind === 'after_circuit' || item.kind === 'column_boundary')
    ?? candidates[0]
    ?? snapshots[snapshots.length - 1]
}

function format(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(4)
}

export function MessageReceiveStateTransferView({ circuit, noisySnapshots, idealSnapshots, stateTransfer }: Props) {
  const roles = useMemo<{ message: Role | null; receive: Role | null }>(() => {
    if (stateTransfer?.available && stateTransfer.message && stateTransfer.receive) {
      return {
        message: { column: stateTransfer.message.column_index, qubit: stateTransfer.message.qubit },
        receive: { column: stateTransfer.receive.column_index, qubit: stateTransfer.receive.qubit ?? 0 },
      }
    }
    let message: { column: number; qubit: number } | null = null
    let receive: { column: number; qubit: number } | null = null
    circuit.columns.forEach((column, columnIndex) => column.gates.forEach((gate) => {
      if (gate.type === 'MESSAGE' && message === null) message = { column: columnIndex, qubit: gate.targets[0] ?? 0 }
      if (gate.type === 'RECEIVED' && receive === null) receive = { column: columnIndex, qubit: gate.targets[0] ?? 0 }
    }))
    return { message, receive }
  }, [circuit, stateTransfer])

  const messageRole = roles.message
  const receiveRole = roles.receive
  if (!messageRole || !receiveRole) return null
  const messageNoisy = boundarySnapshot(noisySnapshots, messageRole.column)
  const receiveNoisy = boundarySnapshot(noisySnapshots, receiveRole.column)
  const messageIdeal = boundarySnapshot(idealSnapshots, messageRole.column)
  const receiveIdeal = boundarySnapshot(idealSnapshots, receiveRole.column)
  const messageState = reducedSingleQubit(messageNoisy?.density_matrix, messageRole.qubit, circuit.logical_qubits)
  const receiveState = reducedSingleQubit(receiveNoisy?.density_matrix, receiveRole.qubit, circuit.logical_qubits)
  const idealReceiveState = reducedSingleQubit(receiveIdeal?.density_matrix, receiveRole.qubit, circuit.logical_qubits)
  const idealMessageState = reducedSingleQubit(messageIdeal?.density_matrix, messageRole.qubit, circuit.logical_qubits)
  const apiMetrics = stateTransfer?.metrics

  return <section className="message-transfer-view" aria-labelledby="message-transfer-title">
    <div className="message-transfer-view__header">
      <div><span className="message-transfer-view__eyebrow">STATE TRANSFER / VERIFIED SNAPSHOTS</span><h2 id="message-transfer-title">Message → Receive</h2></div>
      <span className="message-transfer-view__badge">実回路スナップショット</span>
    </div>
    <p className="message-transfer-view__note">MESSAGE は物理ゲート、RECEIVED は受信位置の注釈です。表示値は各列境界の密度行列からの縮約で、テレポーテーションの自動判定ではありません。</p>
    <div className="message-transfer-view__grid">
      <article><span>送信状態</span><strong>q{messageRole.qubit} · column {messageRole.column + 1}</strong><small>time {messageNoisy && typeof messageNoisy.time_us === 'number' ? `${messageNoisy.time_us.toFixed(3)} us` : '—'}</small><b>ideal/noisy Δρ: {format(metric(idealMessageState, messageState))}</b></article>
      <div className="message-transfer-view__arrow" aria-hidden="true">→</div>
      <article><span>受信状態</span><strong>q{receiveRole.qubit} · column {receiveRole.column + 1}</strong><small>time {receiveNoisy && typeof receiveNoisy.time_us === 'number' ? `${receiveNoisy.time_us.toFixed(3)} us` : '—'}</small><b>ideal/noisy Δρ: {format(metric(idealReceiveState, receiveState))}</b></article>
    </div>
    <div className="message-transfer-view__metrics"><span>送信→受信の縮約差（noisy）</span><strong>{format(apiMetrics?.noisy_message_to_receive_frobenius ?? metric(messageState, receiveState))}</strong><span>理想基準での受信差</span><strong>{format(apiMetrics?.ideal_message_to_receive_frobenius ?? metric(idealMessageState, idealReceiveState))}</strong></div>
  </section>
}
