import { useMemo, useState } from 'react'
import './CircuitProbeView.css'
import { BlochSphereExplorer } from './BlochSphereExplorer'
import { CircuitPreview } from './CircuitPreview'
import type { CircuitEditorState } from '../types/circuit'
import type { CircuitProbe, GateDurationDefaults, OutputProbabilities, StateSnapshot } from '../types/simulation'
import { probabilitiesFromSnapshot } from '../utils/outputProbabilities'

type CircuitProbeViewProps = {
  circuit: CircuitEditorState
  gateDurationDefaults: GateDurationDefaults
  probes?: CircuitProbe[]
  noisySnapshots: StateSnapshot[]
  idealSnapshots: StateSnapshot[]
}

export function CircuitProbeView({
  circuit,
  gateDurationDefaults,
  probes = [],
  noisySnapshots,
  idealSnapshots,
}: CircuitProbeViewProps) {
  const [selectedProbeId, setSelectedProbeId] = useState(probes[0]?.id ?? '')
  const selectedProbe = probes.find((probe) => probe.id === selectedProbeId) ?? probes[0]
  const noisySnapshot = selectedProbe ? noisySnapshots[selectedProbe.noisy_snapshot_index] : null
  const idealSnapshot = selectedProbe && selectedProbe.ideal_snapshot_index != null
    ? idealSnapshots[selectedProbe.ideal_snapshot_index]
    : null
  const noisyProbabilities = useMemo(
    () => noisySnapshot ? probabilitiesFromSnapshot(noisySnapshot, circuit.logical_qubits) : null,
    [circuit.logical_qubits, noisySnapshot],
  )
  const idealProbabilities = useMemo(
    () => idealSnapshot ? probabilitiesFromSnapshot(idealSnapshot, circuit.logical_qubits) : null,
    [circuit.logical_qubits, idealSnapshot],
  )
  const highlightedColumnIndex = selectedProbe?.circuit_position.column_index ?? null

  if (probes.length === 0) {
    return (
      <section className="circuit-probe-view circuit-probe-view--empty">
        <span>CIRCUIT PROBE VIEW</span>
        <p>この実行結果には利用可能な論理境界スナップショットがありません。</p>
      </section>
    )
  }

  return (
    <section className="circuit-probe-view" aria-labelledby="circuit-probe-title">
      <div className="circuit-probe-view__heading">
        <div><span>CIRCUIT PROBE VIEW</span><h2 id="circuit-probe-title">論理回路位置の状態probe</h2></div>
        <label>
          回路位置
          <select value={selectedProbe?.id ?? ''} onChange={(event) => setSelectedProbeId(event.currentTarget.value)}>
            {probes.map((probe) => <option key={probe.id} value={probe.id}>{probeLabel(probe)}</option>)}
          </select>
        </label>
      </div>
      <p className="circuit-probe-view__description">これは物理時間の再生ではなく、選択した論理回路境界におけるバックエンド状態です。</p>
      <CircuitPreview
        circuit={circuit}
        gateDurationDefaults={gateDurationDefaults}
        highlightedColumnIndex={highlightedColumnIndex}
      />
      <div className="circuit-probe-view__states">
        <ProbeState label="ノイズあり" snapshot={noisySnapshot} probabilities={noisyProbabilities} qubitCount={circuit.logical_qubits} />
        {idealSnapshot ? <ProbeState label="理想" snapshot={idealSnapshot} probabilities={idealProbabilities} qubitCount={circuit.logical_qubits} /> : null}
      </div>
      <div className="circuit-probe-view__bloch">
        {noisySnapshot ? <BlochSphereExplorer snapshots={[noisySnapshot]} snapshotIndex={0} onSnapshotIndexChange={() => undefined} /> : null}
        {idealSnapshot ? <BlochSphereExplorer snapshots={[idealSnapshot]} snapshotIndex={0} onSnapshotIndexChange={() => undefined} /> : null}
      </div>
    </section>
  )
}

function ProbeState({
  label,
  snapshot,
  probabilities,
  qubitCount,
}: {
  label: string
  snapshot: StateSnapshot | null
  probabilities: OutputProbabilities | null
  qubitCount: number
}) {
  const topProbabilities = Object.entries(probabilities ?? {})
    .sort(([, left], [, right]) => right - left)
    .slice(0, 4)
  return (
    <article className="circuit-probe-view__state">
      <strong>{label}</strong>
      <span>{snapshot ? `${(snapshot.time_us ?? 0).toFixed(4)} μs` : '利用不可'}</span>
      <small>{qubitCount}量子ビット · 上位確率</small>
      <div>{topProbabilities.map(([state, value]) => <code key={state}>{state}: {(value * 100).toFixed(2)}%</code>)}</div>
    </article>
  )
}

function probeLabel(probe: CircuitProbe) {
  const column = probe.circuit_position.column_index
  if (probe.circuit_position.boundary === 'before') return '回路開始前'
  if (probe.circuit_position.boundary === 'completion') return '回路完了時'
  if (probe.circuit_position.boundary === 'final') return '最終観測時'
  return `第${(column ?? 0) + 1}列の後`
}
