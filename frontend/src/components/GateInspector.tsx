import './GateInspector.css'
import type { CircuitEditorState, CircuitGate } from '../types/circuit'
import type { GateDurationDefaults } from '../types/simulation'
import {
  isRegisterGateType,
  maxMarkedIndex,
  registerDurationUs,
} from '../utils/circuitEditing'

type GateInspectorProps = {
  circuit: CircuitEditorState
  selectedGateId: string | null
  gateDurationDefaults: GateDurationDefaults
  onDeleteSelected: () => void
  onReveal: () => void
  onThetaChange: (thetaRad: number) => void
  onMarkedIndexChange: (markedIndex: number) => void
  onReverseRegister: () => void
}

type GateLocation = {
  gate: CircuitGate
  columnIndex: number
} | null

function findGateLocation(circuit: CircuitEditorState, selectedGateId: string | null): GateLocation {
  if (!selectedGateId) {
    return null
  }

  for (const [columnIndex, column] of circuit.columns.entries()) {
    const gate = column.gates.find((candidate) => candidate.id === selectedGateId)
    if (gate) {
      return { gate, columnIndex }
    }
  }

  return null
}

function formatQubits(qubits: number[] | undefined) {
  if (!qubits || qubits.length === 0) {
    return 'なし'
  }

  return qubits.map((qubit) => `q${qubit}`).join(', ')
}

function getGateDuration(gate: CircuitGate, gateDurationDefaults: GateDurationDefaults) {
  if (gate.params?.duration_us !== undefined) {
    return gate.params.duration_us
  }

  // Register-gate defaults are declared per spanned qubit, not per gate.
  return isRegisterGateType(gate.type)
    ? registerDurationUs(gateDurationDefaults[gate.type], gate.targets.length)
    : gateDurationDefaults[gate.type]
}

export function GateInspector({
  circuit,
  selectedGateId,
  gateDurationDefaults,
  onDeleteSelected,
  onReveal,
  onThetaChange,
  onMarkedIndexChange,
  onReverseRegister,
}: GateInspectorProps) {
  const location = findGateLocation(circuit, selectedGateId)

  if (!location) {
    return null
  }
  const supportsTheta = (
    location.gate.type === 'RX'
    || location.gate.type === 'RY'
    || location.gate.type === 'RZ'
    || location.gate.type === 'CP'
  )
  const thetaRad = location.gate.params?.theta_rad ?? Math.PI / 2
  const isRegisterGate = isRegisterGateType(location.gate.type)
  const isOracle = location.gate.type === 'ORACLE'
  const registerSize = location.gate.targets.length
  const markedIndex = location.gate.params?.marked_index ?? 0
  const markedLabel = markedIndex.toString(2).padStart(registerSize, '0')

  return (
    <aside className="gate-inspector" aria-label="選択中のゲートインスペクター">
      <div className="gate-inspector__header">
        <span className="gate-inspector__eyebrow">インスペクター</span>
        <h2>{location.gate.type}</h2>
      </div>

      <dl className="gate-inspector__details">
        <div>
          <dt>列</dt>
          <dd>{location.columnIndex + 1}</dd>
        </div>
        <div>
          <dt>{isRegisterGate ? 'レジスタ (ビット0から)' : '対象'}</dt>
          <dd>
            {formatQubits(
              isRegisterGate
                ? [...location.gate.targets].reverse()
                : location.gate.targets,
            )}
          </dd>
        </div>
        {isRegisterGate ? (
          <div>
            <dt>レジスタ幅</dt>
            <dd>
              {registerSize} 量子ビット
              <span className="gate-inspector__note">
                {isOracle
                  ? '盤面の数字は、マークする状態がその量子ビットに要求するビットです。'
                  : '盤面の数字はビット重み k で、その量子ビットが 2^k を担います。'}
                {` q${location.gate.targets[registerSize - 1]} がビット0(最下位)、`}
                {`q${location.gate.targets[0]} が最上位です。Quirk や Qiskit と同じ並びです。`}
              </span>
            </dd>
          </div>
        ) : (
          <div>
            <dt>制御</dt>
            <dd>{formatQubits(location.gate.controls)}</dd>
          </div>
        )}
        <div>
          <dt>操作時間</dt>
          <dd>{getGateDuration(location.gate, gateDurationDefaults).toFixed(3)} us</dd>
        </div>
        {supportsTheta ? (
          <div>
            <dt>角度 θ</dt>
            <dd>
              <input
                key={location.gate.id}
                className="gate-inspector__angle-input"
                type="number"
                step="0.01"
                defaultValue={thetaRad}
                aria-label={`${location.gate.type} angle in radians`}
                onBlur={(event) => {
                  const value = event.currentTarget.valueAsNumber
                  if (Number.isFinite(value)) {
                    onThetaChange(value)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
              />{' '}
              rad
            </dd>
          </div>
        ) : null}
        {isOracle ? (
          <div>
            <dt>マークする状態</dt>
            <dd>
              <input
                key={location.gate.id}
                className="gate-inspector__angle-input"
                type="number"
                step="1"
                min={0}
                max={maxMarkedIndex(registerSize)}
                defaultValue={markedIndex}
                aria-label="Oracle marked basis state index"
                onBlur={(event) => {
                  const value = event.currentTarget.valueAsNumber
                  if (Number.isInteger(value)) {
                    onMarkedIndexChange(value)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
              />{' '}
              = |{markedLabel}⟩
              <span className="gate-inspector__note">
                0〜{maxMarkedIndex(registerSize)} の基底状態を指定します。
                この状態の位相だけが反転します。
              </span>
            </dd>
          </div>
        ) : null}
        <div className="gate-inspector__debug">
          <dt>エディター ID</dt>
          <dd>{location.gate.id}</dd>
        </div>
      </dl>

      <div className="gate-inspector__actions">
        {isRegisterGate && location.gate.targets.length >= 2 ? (
          <button
            className="gate-inspector__reverse"
            type="button"
            onClick={onReverseRegister}
            title="レジスタのビット重みを上下反転します（既定は Quirk / Qiskit と同じく上のワイヤがビット0）"
          >
            ビット順を反転
          </button>
        ) : null}
        <button className="gate-inspector__reveal" type="button" onClick={onReveal}>
          表示位置へ移動
        </button>
        <button className="gate-inspector__delete" type="button" onClick={onDeleteSelected}>
          ゲートを削除
        </button>
      </div>
    </aside>
  )
}
