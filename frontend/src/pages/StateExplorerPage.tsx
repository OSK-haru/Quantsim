import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './StateExplorerPage.css'
import { BlochSphereExplorer } from '../components/BlochSphereExplorer'
import { MessageReceiveStateTransferView } from '../components/MessageReceiveStateTransferView'
import { DensityMatrixViewer } from '../components/DensityMatrixViewer'
import { MetricTimeline } from '../components/MetricTimeline'
import { PhysicalTimelinePlayback } from '../components/PhysicalTimelinePlayback'
import { OutputProbabilities } from '../components/OutputProbabilities'
import { QuantumPet, type QuantumPetPhase } from '../components/QuantumPet'
import { RunComparisonBar } from '../components/RunComparisonBar'
import { StateProbabilityComparison } from '../components/StateProbabilityComparison'
import { useCircuitContext } from '../context/useCircuitContext'
import { useTutorial } from '../context/useTutorial'
import type { GateDurationDefaults, SimulationResponse } from '../types/simulation'
import { nearestSnapshotIndex } from '../utils/physicalTimeline'
import { stateExplorerTips } from '../utils/quantumPetTips'
import { coherenceTimeRows, decayRateRows } from '../utils/rateRows'
import { useInternalInfoVisible } from '../context/useAdminMode'
import {
  circuitConfigSignature,
  circuitEditorStateToConfig,
  type CircuitConfig,
} from '../utils/circuitConfig'
import type { GateAwareComparisonState } from '../utils/simulateSettings'
import {
  buildGateAwareResultBundle,
  downloadJson,
  resultFileName,
} from '../utils/resultExport'

type StateExplorerPageProps = {
  response: SimulationResponse | null
  executedCircuitConfig: CircuitConfig | null
  gateDurationDefaults: GateDurationDefaults
  /*
   * 保持した実行と比較表示の状態。ページを移っても消えないよう App が持つ。
   * ここで useState すると、シミュレーションへ戻っただけで保持が捨てられる。
   */
  comparison: GateAwareComparisonState
  onComparisonChange: (comparison: GateAwareComparisonState) => void
  onOpenSimulation: () => void
}

type ExplorerPanelKey = 'playback' | 'physical' | 'metrics' | 'probabilities' | 'output' | 'bloch' | 'density' | 'transfer' | 'rates'
const EXPLORER_PANEL_LABELS: Record<ExplorerPanelKey, string> = {
  transfer: 'Message → Receive',
  playback: '再生バー',
  physical: '物理時間', metrics: '指標タイムライン',
  probabilities: '確率比較', output: '出力確率', bloch: 'Bloch球', density: '密度行列',
  rates: '環境レート',
}
/*
 * 非表示にした項目は畳んだ見出しも残さず、まるごと消す。並んだ空バーは
 * 中身がないぶん読み飛ばす対象にしかならないので、出す・出さないの管理は
 * 「表示項目」メニュー一箇所に寄せる。見出しの × はそこへの近道。
 */
function CollapsiblePanel({ panelKey, open, onToggle, children }: { panelKey: ExplorerPanelKey; open: boolean; onToggle: () => void; children: ReactNode }) {
  if (!open) return null
  return <section className="state-explorer-panel">
    <div className="state-explorer-panel__toggle">
      <span>{EXPLORER_PANEL_LABELS[panelKey]}</span>
      <button
        type="button"
        className="state-explorer-panel__hide"
        onClick={onToggle}
        aria-label={`${EXPLORER_PANEL_LABELS[panelKey]}を非表示`}
      >
        ×
      </button>
    </div>
    <div className="state-explorer-panel__body">{children}</div>
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
  comparison,
  onComparisonChange,
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
  /* Bloch球・密度行列・確率比較は同じスナップショット位置を共有して動く。 */
  /*
   * 見比べるために取っておいた実行。保持は1件・ページ単位にする。
   * パネルは全部で1つのスナップショット位置を共有しているので、パネルごとに
   * 別の実行を保持できると、隣り合う図が別々の条件を指してしまう。
   */
  const { heldResult, comparing } = comparison
  const [openPanels, setOpenPanels] = useState<Record<ExplorerPanelKey, boolean>>({
    playback: true,
    physical: false, metrics: false, probabilities: true, output: false, bloch: true, density: false, transfer: false,
    rates: false,
  })
  /*
   * 比較線を描くのは指標タイムラインと確率比較の2枚だけ。指標タイムラインは
   * 既定で閉じているので、比較を入れたのに線がどこにも見えない、という状態に
   * なりうる。比較を入れたときは、線が出るパネルを開いておく。
   */
  const openComparisonPanels = useCallback(() => {
    setOpenPanels((current) => (
      current.metrics && current.probabilities
        ? current
        : { ...current, metrics: true, probabilities: true }
    ))
  }, [])
  const setComparing = useCallback(
    (nextComparing: boolean) => {
      if (nextComparing) {
        openComparisonPanels()
      }
      onComparisonChange({ ...comparison, comparing: nextComparing })
    },
    [comparison, onComparisonChange, openComparisonPanels],
  )
  const holdCurrentRun = useCallback(() => {
    if (activeResponse === null || executedCircuitConfig === null) {
      return
    }
    onComparisonChange({
      heldResult: {
        response: activeResponse,
        circuitConfig: executedCircuitConfig,
        heldAt: new Date().toISOString(),
        comparability: comparabilitySignature(executedCircuitConfig, activeResponse.parameters),
      },
      comparing: true,
    })
    openComparisonPanels()
  }, [activeResponse, executedCircuitConfig, onComparisonChange, openComparisonPanels])
  const releaseHeldRun = useCallback(() => {
    onComparisonChange({ heldResult: null, comparing: false })
  }, [onComparisonChange])
  /*
   * 表示中の結果を、それを生んだ入力ごと書き出す。
   *
   * Gate-awareの応答は実行時刻をISO形式で持っていない（run.last_run_label は
   * 表示用の文字列）ため、ファイル名の時刻は書き出した時刻を使う。
   */
  /*
   * 書き出し済みの表示は「どの実行を書き出したか」とセットで持つ。
   *
   * 実行が切り替わったときに effect で消す手もあるが、それは表示の更新を
   * 1描画ぶん遅らせるだけで、消す理由（表示中の実行と一致しない）を状態が
   * 持っていない。書き出した対象そのものを覚えておけば、いま表示している
   * 結果と違った時点で自動的に「書き出していない」扱いになる。
   */
  const [exportedResponse, setExportedResponse] = useState<SimulationResponse | null>(null)
  const exportStatus = exportedResponse !== null && exportedResponse === activeResponse
    ? '結果を書き出しました'
    : ''
  const exportCurrentRun = useCallback(() => {
    if (activeResponse === null) {
      return
    }
    const now = new Date()
    const bundle = buildGateAwareResultBundle(
      activeResponse,
      executedCircuitConfig,
      gateDurationDefaults,
      now,
    )
    downloadJson(
      JSON.stringify(bundle, null, 2),
      resultFileName('gate-aware結果', now.toISOString()),
    )
    setExportedResponse(activeResponse)
  }, [activeResponse, executedCircuitConfig, gateDurationDefaults])
  /*
   * 直接比較できなくなった保持は、その場で捨てる。
   *
   * 重ねて意味があるのは「回路も観測窓も同じまま、環境だけ変えた」場合だけ。
   * 回路を編集したり観測窓を変えたりすると、差が環境由来なのか回路由来なのか
   * 分けられない。読めない比較を残すより、履歴ごと消して保持し直してもらう。
   */
  const currentComparability = activeResponse !== null && executedCircuitConfig !== null
    ? comparabilitySignature(executedCircuitConfig, activeResponse.parameters)
    : null
  if (
    heldResult !== null
    && currentComparability !== null
    && heldResult.comparability !== currentComparability
  ) {
    onComparisonChange({ heldResult: null, comparing: false })
  }
  /* 比較を出しているあいだだけ、保持側の系列を各パネルへ流す。 */
  const heldForComparison = comparing ? heldResult : null
  const heldSnapshots = heldForComparison !== null
    && Array.isArray(heldForComparison.response.state_snapshots)
    ? heldForComparison.response.state_snapshots
    : []
  const heldTimeline = heldForComparison !== null
    && Array.isArray(heldForComparison.response.timeline)
    ? heldForComparison.response.timeline
    : []
  /*
   * 比較を出しているのに線が引けない理由を、黙って飲み込まずに言う。
   * スナップショットを切って実行した結果を保持すると、保持側の系列が
   * 空になって線が引けないが、画面上は「比較表示ON・線なし」に見える。
   */
  const comparisonNotice = !comparing || heldResult === null
    ? null
    : heldSnapshots.length === 0 && heldTimeline.length === 0
      ? '保持した実行にはスナップショットも指標もないため、比較線を引けません。'
      : null
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
  const activeSnapshotIndex = Math.min(snapshotIndex, Math.max(snapshots.length - 1, 0))
  const qubitCount = activeResponse && activeResponse.circuit && Number.isInteger(activeResponse.circuit.qubit_count)
    ? activeResponse.circuit.qubit_count
    : null
  /*
   * 緩和時間は通常モードでも見せ、γ 系の生レートは詳細モードでだけ添える。
   * 診断カードは詳細モード専用になったので、通常モードで T1・T2 を確認できる
   * 場所はここだけになる。
   */
  const internalInfoVisible = useInternalInfoVisible()
  const coherenceRows = useMemo(
    () => (activeResponse ? coherenceTimeRows(activeResponse.rates) : []),
    [activeResponse],
  )
  const decayRows = useMemo(
    () => (activeResponse && internalInfoVisible ? decayRateRows(activeResponse.rates) : []),
    [activeResponse, internalInfoVisible],
  )
  const hasTransfer = circuitState.columns.some((column) => column.gates.some((gate) => gate.type === 'MESSAGE'))
    && circuitState.columns.some((column) => column.gates.some((gate) => gate.type === 'RECEIVED'))
  const availablePanelKeys = useMemo(
    () => (Object.keys(EXPLORER_PANEL_LABELS) as ExplorerPanelKey[]).filter((panelKey) => {
      if (panelKey === 'transfer') return hasTransfer
      if (panelKey === 'probabilities') return qubitCount !== null
      if (panelKey === 'bloch' || panelKey === 'density') return snapshots.length > 0
      if (panelKey === 'rates') return coherenceRows.length > 0 || decayRows.length > 0
      return true
    }),
    [hasTransfer, qubitCount, snapshots.length, coherenceRows.length, decayRows.length],
  )
  const handlePlaybackSimulationTimeChange = useCallback((simulationTimeUs: number) => {
    setPlaybackSimulationTimeUs(simulationTimeUs)
    const nextSnapshotIndex = nearestSnapshotIndex(snapshots, simulationTimeUs)
    if (nextSnapshotIndex >= 0) setSnapshotIndex(nextSnapshotIndex)
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
          <RunComparisonBar
            heldLabel={heldResult === null
              ? null
              : `${new Date(heldResult.heldAt).toLocaleTimeString()} に保存`}
            canHold={activeResponse !== null && heldResult?.response !== activeResponse}
            comparing={comparing}
            onHold={holdCurrentRun}
            onRelease={releaseHeldRun}
            onComparingChange={setComparing}
            onExport={exportCurrentRun}
            exportStatus={exportStatus}
          />
          {comparisonNotice === null ? null : (
            <p className="state-explorer-page__compare-note">{comparisonNotice}</p>
          )}
          {hasTransfer ? (
            <CollapsiblePanel panelKey="transfer" open={visiblePanels.transfer} onToggle={() => togglePanel('transfer')}>
              <MessageReceiveStateTransferView circuit={circuitState} noisySnapshots={snapshots} idealSnapshots={idealSnapshots} stateTransfer={activeResponse.state_transfer} />
            </CollapsiblePanel>
          ) : null}
          {/*
            * 時刻カーソルは Bloch球・確率比較・密度行列が共有している。操作系を
            * 折りたたみパネルの中に置くと、下のパネルだけ開いている状態で
            * 動かす手段が消えるので、再生バーはパネルの外に常に出す。
            */}
          {visiblePanels.playback ? (
            <PhysicalTimelinePlayback
              circuit={circuitState}
              gateDurationDefaults={gateDurationDefaults}
              physicalTimeline={activeResponse.physical_timeline}
              measurement={activeResponse.measurement}
              simulationTimeUs={playbackSimulationTimeUs}
              onSimulationTimeChange={handlePlaybackSimulationTimeChange}
              variant="controls"
            />
          ) : null}
          <CollapsiblePanel panelKey="physical" open={visiblePanels.physical} onToggle={() => togglePanel('physical')}>
            <PhysicalTimelinePlayback
              circuit={circuitState}
              gateDurationDefaults={gateDurationDefaults}
              physicalTimeline={activeResponse.physical_timeline}
              measurement={activeResponse.measurement}
              simulationTimeUs={playbackSimulationTimeUs}
              onSimulationTimeChange={handlePlaybackSimulationTimeChange}
              variant="circuit"
            />
          </CollapsiblePanel>
          <CollapsiblePanel panelKey="metrics" open={visiblePanels.metrics} onToggle={() => togglePanel('metrics')}>
          <MetricTimeline
            timeline={activeResponse.timeline}
            heldTimeline={heldTimeline}
            heldSnapshots={heldSnapshots}
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
              heldSnapshots={heldSnapshots}
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
              defaultOpen
            />
          </CollapsiblePanel>
          {snapshots.length === 0 ? (
            <div className="state-explorer-page__unavailable">
              この結果には密度行列スナップショットがありません。
            </div>
          ) : (
            <>
              <CollapsiblePanel panelKey="bloch" open={visiblePanels.bloch} onToggle={() => togglePanel('bloch')}>
              <div className="state-explorer-page__comparison-grid">
                <section className="state-explorer-page__comparison-panel">
                  <h2>Gate-aware 状態</h2>
                  <BlochSphereExplorer snapshots={snapshots} snapshotIndex={activeSnapshotIndex} />
                </section>
                {idealSnapshots.length > 0 ? (
                  <section className="state-explorer-page__comparison-panel state-explorer-page__comparison-panel--ideal">
                    <h2>理想状態（ノイズなし）</h2>
                    <BlochSphereExplorer snapshots={idealSnapshots} snapshotIndex={activeSnapshotIndex} />
                  </section>
                ) : null}
              </div>
              </CollapsiblePanel>
            <CollapsiblePanel panelKey="density" open={visiblePanels.density} onToggle={() => togglePanel('density')}>
                <div className="state-explorer-page__section-heading">
                  <div>
                    <span className="state-explorer-page__eyebrow">Full quantum state</span>
                    <h2 id="density-matrix-title">密度行列</h2>
                  </div>
                  <p>
                    Bloch球と同じスナップショットの完全な多量子ビット状態を表示します。
                  </p>
                </div>
                <div className="state-explorer-page__comparison-grid">
                  <section className="state-explorer-page__comparison-panel">
                    <h3>Gate-aware 密度行列</h3>
                    <DensityMatrixViewer snapshots={snapshots} snapshotIndex={activeSnapshotIndex} />
                  </section>
                  {idealSnapshots.length > 0 ? (
                    <section className="state-explorer-page__comparison-panel state-explorer-page__comparison-panel--ideal">
                      <h3>理想状態の密度行列</h3>
                      <DensityMatrixViewer snapshots={idealSnapshots} snapshotIndex={activeSnapshotIndex} />
                    </section>
                  ) : null}
                </div>
            </CollapsiblePanel>
            </>
          )}
          {coherenceRows.length > 0 || decayRows.length > 0 ? (
            <CollapsiblePanel panelKey="rates" open={visiblePanels.rates} onToggle={() => togglePanel('rates')}>
              <div className="state-explorer-page__section-heading">
                <div>
                  <span className="state-explorer-page__eyebrow">Environment</span>
                  <h2>環境レート</h2>
                </div>
                <p>
                  この実行で使われた緩和時間です。T1 は占有数の緩和、T2 は位相の緩和にかかる
                  時間の目安で、回路の長さがこれらに近づくほど忠実度が落ちていきます。
                </p>
              </div>
              <div className="state-explorer-page__rates-grid">
                {coherenceRows.map((row) => (
                  <div className="state-explorer-page__rate-item" key={row.label}>
                    <span className="state-explorer-page__rate-label">{row.label}</span>
                    <strong className="state-explorer-page__rate-value">{row.value}</strong>
                  </div>
                ))}
              </div>
              {decayRows.length > 0 ? (
                <>
                  <h3 className="state-explorer-page__rate-subtitle">緩和レート（生値）</h3>
                  <div className="state-explorer-page__rates-grid">
                    {decayRows.map((row) => (
                      <div className="state-explorer-page__rate-item" key={row.label}>
                        <span className="state-explorer-page__rate-label">{row.label}</span>
                        <strong className="state-explorer-page__rate-value">{row.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
            ) : null}
            </CollapsiblePanel>
          ) : null}
        </>
      )}
      <QuantumPet phase={petPhase} message={petMessage} tips={stateExplorerTips} />
    </main>
  )
}

/*
 * 「保持した実行と重ねてよいか」を決める指紋。
 *
 * 重ねて意味があるのは、回路と観測条件が同じまま環境だけを変えた場合に限る。
 * そのとき2本の差はそのまま環境の寄与になる。回路や観測窓まで変わると、
 * 差がどこから来たのか分けられず、重ねた図は誤読を生む。
 *
 * なので温度・デバイス品質・磁束ノイズ・T1/Tphi といった環境側は入れない。
 * 回路の構造（circuitConfigSignature）と、観測窓・ゲート長だけを見る。
 */
function comparabilitySignature(
  circuitConfig: CircuitConfig,
  parameters: SimulationResponse['parameters'],
): string {
  return JSON.stringify({
    circuit: circuitConfigSignature(circuitConfig),
    /* 観測窓。時間軸が違うと同じ物理時刻で並べられない。 */
    duration_us: parameters.duration_us,
    time_steps: parameters.time_steps,
    /* 入力の与え方が変わると、そもそも同じ実験ではない。 */
    input_mode: parameters.input_mode,
  })
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
