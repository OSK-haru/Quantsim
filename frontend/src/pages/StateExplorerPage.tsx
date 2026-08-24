import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './StateExplorerPage.css'
import { BlochSphereExplorer } from '../components/BlochSphereExplorer'
import { MessageReceiveStateTransferView } from '../components/MessageReceiveStateTransferView'
import { DensityMatrixViewer } from '../components/DensityMatrixViewer'
import { MetricTimeline } from '../components/MetricTimeline'
import { PhysicalTimelinePlayback } from '../components/PhysicalTimelinePlayback'
import { OutputProbabilities } from '../components/OutputProbabilities'
import { QuantumPet, type QuantumPetPhase } from '../components/QuantumPet'
import { StateProbabilityComparison } from '../components/StateProbabilityComparison'
import { useCircuitContext } from '../context/useCircuitContext'
import { useTutorial } from '../context/useTutorial'
import type { GateDurationDefaults, SimulationResponse } from '../types/simulation'
import { nearestSnapshotIndex } from '../utils/physicalTimeline'
import { stateExplorerTips } from '../utils/quantumPetTips'
import {
  circuitConfigSignature,
  circuitEditorStateToConfig,
  type CircuitConfig,
} from '../utils/circuitConfig'

type StateExplorerPageProps = {
  response: SimulationResponse | null
  executedCircuitConfig: CircuitConfig | null
  gateDurationDefaults: GateDurationDefaults
  onOpenSimulation: () => void
}

type ExplorerPanelKey = 'physical' | 'metrics' | 'probabilities' | 'output' | 'bloch' | 'density' | 'transfer'
const EXPLORER_PANEL_LABELS: Record<ExplorerPanelKey, string> = {
  transfer: 'Message → Receive',
  physical: '物理時間', metrics: '指標タイムライン',
  probabilities: '確率比較', output: '出力確率', bloch: 'Bloch球', density: '密度行列',
}
function CollapsiblePanel({ panelKey, open, onToggle, children }: { panelKey: ExplorerPanelKey; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className={`state-explorer-panel${open ? '' : ' state-explorer-panel--collapsed'}`}>
    <button type="button" className="state-explorer-panel__toggle" aria-expanded={open} onClick={onToggle}>
      <span>{EXPLORER_PANEL_LABELS[panelKey]}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open ? <div className="state-explorer-panel__body">{children}</div> : null}
  </section>
}

function PanelVisibilityMenu({
  panels,
  openPanels,
  onToggle,
  onShowAll,
  onHideAll,
}: {
  panels: ExplorerPanelKey[]
  openPanels: Record<ExplorerPanelKey, boolean>
  onToggle: (panelKey: ExplorerPanelKey) => void
  onShowAll: () => void
  onHideAll: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleCount = panels.filter((panelKey) => openPanels[panelKey]).length

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      className="state-explorer-page__panel-menu"
      ref={containerRef}
      data-tutorial-anchor="explorer-panel-menu"
    >
      <button
        type="button"
        className="state-explorer-page__panel-menu-toggle"
        aria-expanded={isOpen}
        aria-controls="state-explorer-panel-menu-list"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="state-explorer-page__panel-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>表示項目</span>
        <span className="state-explorer-page__panel-menu-count">
          {visibleCount}/{panels.length}
        </span>
      </button>
      {isOpen ? (
        <div
          id="state-explorer-panel-menu-list"
          className="state-explorer-page__panel-menu-list"
          role="menu"
          aria-label="表示項目の選択"
        >
          <div className="state-explorer-page__panel-menu-actions">
            <button type="button" onClick={onShowAll}>すべて表示</button>
            <button type="button" onClick={onHideAll}>すべて非表示</button>
          </div>
          {panels.map((panelKey) => (
            <label key={panelKey} className="state-explorer-page__panel-menu-item">
              <input
                type="checkbox"
                checked={openPanels[panelKey]}
                onChange={() => onToggle(panelKey)}
              />
              {EXPLORER_PANEL_LABELS[panelKey]}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function StateExplorerPage({
  response,
  executedCircuitConfig,
  gateDurationDefaults,
  onOpenSimulation,
}: StateExplorerPageProps) {
  const { circuitState } = useCircuitContext()
  const currentCircuitConfig = circuitEditorStateToConfig(circuitState)
  const resultMatchesCurrentCircuit = response !== null
    && executedCircuitConfig !== null
    && circuitConfigSignature(currentCircuitConfig) === circuitConfigSignature(executedCircuitConfig)
  const activeResponse = resultMatchesCurrentCircuit ? response : null
  const staleResult = response !== null && !resultMatchesCurrentCircuit
  const snapshots = useMemo(
    () => activeResponse && Array.isArray(activeResponse.state_snapshots)
      ? activeResponse.state_snapshots
      : [],
    [activeResponse],
  )
  const [snapshotIndex, setSnapshotIndex] = useState(() => preferredSnapshotIndex(snapshots))
  const [playbackSimulationTimeUs, setPlaybackSimulationTimeUs] = useState(0)
  const [openPanels, setOpenPanels] = useState<Record<ExplorerPanelKey, boolean>>({
    physical: false, metrics: false, probabilities: true, output: false, bloch: true, density: false, transfer: false,
  })
  const togglePanel = useCallback((panelKey: ExplorerPanelKey) => {
    setOpenPanels((current) => ({ ...current, [panelKey]: !current[panelKey] }))
  }, [])
  const setAllPanels = useCallback((visible: boolean) => {
    setOpenPanels((current) => {
      const next = { ...current }
      for (const panelKey of Object.keys(EXPLORER_PANEL_LABELS) as ExplorerPanelKey[]) {
        next[panelKey] = visible
      }
      return next
    })
  }, [])
  const showAllPanels = useCallback(() => setAllPanels(true), [setAllPanels])
  const hideAllPanels = useCallback(() => setAllPanels(false), [setAllPanels])

  /*
   * チュートリアルの結果解説の章のあいだは、指標タイムラインを開いた扱いにする。
   * 「まず自分で開いて」と言うと話の腰が折れるので、状態は書き換えず、
   * 表示だけを上書きする。章を抜ければ利用者の設定がそのまま戻る。
   */
  const tutorial = useTutorial()
  const forcesMetricsOpen = tutorial.beat?.opensPanel === 'metric-timeline'
  const visiblePanels = forcesMetricsOpen && !openPanels.metrics
    ? { ...openPanels, metrics: true }
    : openPanels
  const idealSnapshots = activeResponse && Array.isArray(activeResponse.run.comparison?.ideal_state_snapshots)
    ? activeResponse.run.comparison.ideal_state_snapshots
    : []
  const idealTimeline = activeResponse && Array.isArray(activeResponse.run.comparison?.ideal_timeline)
    ? activeResponse.run.comparison.ideal_timeline
    : []
  const activeSnapshotIndex = Math.min(snapshotIndex, Math.max(snapshots.length - 1, 0))
  const qubitCount = activeResponse && activeResponse.circuit && Number.isInteger(activeResponse.circuit.qubit_count)
    ? activeResponse.circuit.qubit_count
    : null
  const matrixDimension = qubitCount === null ? null : 2 ** qubitCount
  const hasTransfer = circuitState.columns.some((column) => column.gates.some((gate) => gate.type === 'MESSAGE'))
    && circuitState.columns.some((column) => column.gates.some((gate) => gate.type === 'RECEIVED'))
  const availablePanelKeys = useMemo(
    () => (Object.keys(EXPLORER_PANEL_LABELS) as ExplorerPanelKey[]).filter((panelKey) => {
      if (panelKey === 'transfer') return hasTransfer
      if (panelKey === 'probabilities') return qubitCount !== null
      if (panelKey === 'bloch' || panelKey === 'density') return snapshots.length > 0
      return true
    }),
    [hasTransfer, qubitCount, snapshots.length],
  )
  const handlePlaybackSimulationTimeChange = useCallback((simulationTimeUs: number) => {
    setPlaybackSimulationTimeUs(simulationTimeUs)
    const nextSnapshotIndex = nearestSnapshotIndex(snapshots, simulationTimeUs)
    if (nextSnapshotIndex >= 0) setSnapshotIndex(nextSnapshotIndex)
  }, [snapshots])
  const handleSnapshotIndexChange = useCallback((nextSnapshotIndex: number) => {
    setSnapshotIndex(nextSnapshotIndex)
    const snapshotTimeUs = snapshots[nextSnapshotIndex]?.time_us
    if (typeof snapshotTimeUs === 'number' && Number.isFinite(snapshotTimeUs)) {
      setPlaybackSimulationTimeUs(snapshotTimeUs)
    }
  }, [snapshots])

  /*
   * ここは計算をしないページなので、黄（計算中）は出てこない。
   * 完了した結果を見ている状態を菫、結果がない状態を緑とする。
   */
  const petPhase: QuantumPetPhase = activeResponse === null ? 'idle' : 'done'
  const petMessage = activeResponse !== null
    ? null
    : staleResult
      ? '回路が変わったみたい。もう一度実行すると、ここに結果が戻ってくるよ。'
      : 'まだ結果がないよ。先にGate-awareシミュレーションを実行してね。'

  return (
    <main className="state-explorer-page">
      <header className="state-explorer-page__header">
        <div>
          <span className="state-explorer-page__eyebrow">Yuragi-Strider / Gate-aware results</span>
          <h1>Gate-aware 状態エクスプローラー</h1>
          <p className="state-explorer-page__scope">
            Gate-awareシミュレーションの回路スナップショット専用です。Pulseラボの結果は
            ここには読み込まれません。Pulseの軌跡には専用のPulse 状態エクスプローラーがあります。
          </p>
        </div>
      </header>

      {activeResponse === null ? (
        <section className="state-explorer-page__empty" aria-labelledby="state-explorer-empty-title">
          <span className="state-explorer-page__eyebrow">
            {staleResult ? '再実行が必要' : '結果なし'}
          </span>
          <h2 id="state-explorer-empty-title">
            {staleResult
              ? '表示中の回路に対応するシミュレーション結果がありません。'
              : 'Gate-aware シミュレーション結果がありません。'}
          </h2>
          <p>
            {staleResult
              ? `現在は${currentCircuitConfig.logical_qubits}量子ビット回路ですが、保存済み結果は${response?.circuit.qubit_count ?? '不明'}量子ビットです。現在の回路を再実行してください。`
              : '先にGate-awareシミュレーションを実行してください。'}
          </p>
          <button type="button" onClick={onOpenSimulation}>Gate-aware シミュレーションを開く</button>
        </section>
      ) : (
        <>
          <PanelVisibilityMenu
            panels={availablePanelKeys}
            openPanels={visiblePanels}
            onToggle={togglePanel}
            onShowAll={showAllPanels}
            onHideAll={hideAllPanels}
          />
          {hasTransfer ? (
            <CollapsiblePanel panelKey="transfer" open={visiblePanels.transfer} onToggle={() => togglePanel('transfer')}>
              <MessageReceiveStateTransferView circuit={circuitState} noisySnapshots={snapshots} idealSnapshots={idealSnapshots} stateTransfer={activeResponse.state_transfer} />
            </CollapsiblePanel>
          ) : null}
          <CollapsiblePanel panelKey="physical" open={visiblePanels.physical} onToggle={() => togglePanel('physical')}>
          <PhysicalTimelinePlayback
            circuit={circuitState}
            gateDurationDefaults={gateDurationDefaults}
            physicalTimeline={activeResponse.physical_timeline}
            measurement={activeResponse.measurement}
              simulationTimeUs={playbackSimulationTimeUs}
              onSimulationTimeChange={handlePlaybackSimulationTimeChange}
              noisySnapshots={snapshots}
              idealSnapshots={idealSnapshots}
            />
          </CollapsiblePanel>
          <CollapsiblePanel panelKey="metrics" open={visiblePanels.metrics} onToggle={() => togglePanel('metrics')}>
          <MetricTimeline
            timeline={activeResponse.timeline}
            idealTimeline={idealTimeline}
            stateSnapshots={snapshots}
            cursorSimulationTimeUs={playbackSimulationTimeUs}
            fidelityThreshold={activeResponse.parameters.fidelity_threshold}
            effectiveTimeUs={activeResponse.summary.effective_time_us}
          />
          </CollapsiblePanel>
          {qubitCount === null ? null : (
            <CollapsiblePanel panelKey="probabilities" open={visiblePanels.probabilities} onToggle={() => togglePanel('probabilities')}>
            <StateProbabilityComparison
              qubitCount={qubitCount}
              idealSnapshots={idealSnapshots}
              noisySnapshots={snapshots}
              finalProbabilities={activeResponse.output_probabilities}
              cursorSimulationTimeUs={playbackSimulationTimeUs}
            />
            </CollapsiblePanel>
          )}
          <CollapsiblePanel panelKey="output" open={visiblePanels.output} onToggle={() => togglePanel('output')}>
            <OutputProbabilities
              outputProbabilities={activeResponse.output_probabilities}
              qubitCount={qubitCount}
              snapshots={snapshots}
              snapshotIndex={activeSnapshotIndex}
              onSnapshotIndexChange={handleSnapshotIndexChange}
              defaultOpen
            />
          </CollapsiblePanel>
          <section className="state-explorer-page__summary" aria-label="シミュレーション結果の概要">
            <span>{qubitCount === null ? '量子ビット数不明' : `量子ビット ${qubitCount}`}</span>
            {matrixDimension === null ? null : <span>{matrixDimension} x {matrixDimension}</span>}
            <span>スナップショット {snapshots.length} 個</span>
          </section>
          <section className="state-explorer-page__workspace" aria-label="密度行列ワークスペース">
            {snapshots.length === 0 ? (
              <div className="state-explorer-page__unavailable">
                この結果には密度行列スナップショットがありません。
              </div>
            ) : (
              <div className="state-explorer-page__explorers">
                <CollapsiblePanel panelKey="bloch" open={visiblePanels.bloch} onToggle={() => togglePanel('bloch')}>
                <div className="state-explorer-page__comparison-grid">
                  <section className="state-explorer-page__comparison-panel">
                    <h2>Gate-aware 状態</h2>
                    <BlochSphereExplorer
                      snapshots={snapshots}
                      snapshotIndex={activeSnapshotIndex}
                      onSnapshotIndexChange={handleSnapshotIndexChange}
                    />
                  </section>
                  {idealSnapshots.length > 0 ? (
                    <section className="state-explorer-page__comparison-panel state-explorer-page__comparison-panel--ideal">
                      <h2>理想状態（ノイズなし）</h2>
                      <BlochSphereExplorer
                        snapshots={idealSnapshots}
                        snapshotIndex={activeSnapshotIndex}
                        onSnapshotIndexChange={handleSnapshotIndexChange}
                      />
                    </section>
                  ) : null}
                </div>
                </CollapsiblePanel>
                <section
                  className="state-explorer-page__density-section"
                  aria-labelledby="density-matrix-title"
                >
                <CollapsiblePanel panelKey="density" open={visiblePanels.density} onToggle={() => togglePanel('density')}>
                  <div className="state-explorer-page__section-heading">
                    <div>
                      <span className="state-explorer-page__eyebrow">Full quantum state</span>
                      <h2 id="density-matrix-title">密度行列</h2>
                    </div>
                    <p>
                      Bloch球と同じスナップショットの完全な多量子ビット状態を表示します。
                      RZによる位相変化は絶対値に出ない場合があるため、実部・虚部・位相を切り替えて確認してください。
                    </p>
                  </div>
                  <div className="state-explorer-page__comparison-grid">
                    <section className="state-explorer-page__comparison-panel">
                      <h3>Gate-aware 密度行列</h3>
                      <DensityMatrixViewer
                        snapshots={snapshots}
                        snapshotIndex={activeSnapshotIndex}
                        onSnapshotIndexChange={handleSnapshotIndexChange}
                      />
                    </section>
                    {idealSnapshots.length > 0 ? (
                      <section className="state-explorer-page__comparison-panel state-explorer-page__comparison-panel--ideal">
                        <h3>理想状態の密度行列</h3>
                        <DensityMatrixViewer
                          snapshots={idealSnapshots}
                          snapshotIndex={activeSnapshotIndex}
                          onSnapshotIndexChange={handleSnapshotIndexChange}
                        />
                      </section>
                    ) : null}
                  </div>
                </CollapsiblePanel>
                </section>
              </div>
            )}
          </section>
        </>
      )}
      <QuantumPet phase={petPhase} message={petMessage} tips={stateExplorerTips} />
    </main>
  )
}

function preferredSnapshotIndex(snapshots: SimulationResponse['state_snapshots']): number {
  const afterCircuitIndex = snapshots.map((snapshot) => snapshot.kind).lastIndexOf('after_circuit')
  if (afterCircuitIndex >= 0) {
    return afterCircuitIndex
  }

  const finalColumnIndex = snapshots.map((snapshot) => snapshot.kind).lastIndexOf('column_boundary')
  if (finalColumnIndex >= 0) {
    return finalColumnIndex
  }

  return Math.max(snapshots.length - 1, 0)
}
