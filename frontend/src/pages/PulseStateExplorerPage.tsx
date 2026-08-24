import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import './PulseStateExplorerPage.css'
import { PulseDensityMatrixHeatmap } from '../components/PulseDensityMatrixHeatmap'
import { PulseMetricTimeline } from '../components/PulseMetricTimeline'
import { PulseOutputProbabilities } from '../components/PulseOutputProbabilities'
import { PulsePopulationTimeline } from '../components/PulsePopulationTimeline'
import { PulseStateProbabilityComparison } from '../components/PulseStateProbabilityComparison'
import { PulseTimelinePlayback } from '../components/PulseTimelinePlayback'
import { QuantumPet, type QuantumPetPhase } from '../components/QuantumPet'
import { useInternalInfoVisible } from '../context/useAdminMode'
import type { PulseRunRecord } from '../types/pulse'
import {
  buildPulseExplorerView,
  nearestPulsePointIndex,
} from '../utils/pulseStateExplorer'
import { pulseStateExplorerTips } from '../utils/quantumPetTips'

type PulseStateExplorerPageProps = {
  run: PulseRunRecord | null
  /* いまPulseラボに入っている設定の指紋。実行時のものと違えば結果は古い。 */
  currentSignature: string
  onOpenPulseLab: () => void
}

type PulseExplorerPanelKey =
  | 'physical'
  | 'metrics'
  | 'populations'
  | 'probabilities'
  | 'output'
  | 'density'

const PULSE_EXPLORER_PANEL_LABELS: Record<PulseExplorerPanelKey, string> = {
  physical: '物理時間',
  metrics: '指標タイムライン',
  populations: '占有数タイムライン',
  probabilities: '確率比較',
  output: '占有確率',
  density: '密度行列',
}

function CollapsiblePanel({
  panelKey,
  open,
  onToggle,
  children,
}: {
  panelKey: PulseExplorerPanelKey
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`pulse-explorer-panel${open ? '' : ' pulse-explorer-panel--collapsed'}`}>
      <button
        type="button"
        className="pulse-explorer-panel__toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span>{PULSE_EXPLORER_PANEL_LABELS[panelKey]}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="pulse-explorer-panel__body">{children}</div> : null}
    </section>
  )
}

function PanelVisibilityMenu({
  panels,
  openPanels,
  onToggle,
  onShowAll,
  onHideAll,
}: {
  panels: PulseExplorerPanelKey[]
  openPanels: Record<PulseExplorerPanelKey, boolean>
  onToggle: (panelKey: PulseExplorerPanelKey) => void
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
    <div className="pulse-explorer-page__panel-menu" ref={containerRef}>
      <button
        type="button"
        className="pulse-explorer-page__panel-menu-toggle"
        aria-expanded={isOpen}
        aria-controls="pulse-explorer-panel-menu-list"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="pulse-explorer-page__panel-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>表示項目</span>
        <span className="pulse-explorer-page__panel-menu-count">
          {visibleCount}/{panels.length}
        </span>
      </button>
      {isOpen ? (
        <div
          id="pulse-explorer-panel-menu-list"
          className="pulse-explorer-page__panel-menu-list"
          role="menu"
          aria-label="表示項目の選択"
        >
          <div className="pulse-explorer-page__panel-menu-actions">
            <button type="button" onClick={onShowAll}>すべて表示</button>
            <button type="button" onClick={onHideAll}>すべて非表示</button>
          </div>
          {panels.map((panelKey) => (
            <label key={panelKey} className="pulse-explorer-page__panel-menu-item">
              <input
                type="checkbox"
                checked={openPanels[panelKey]}
                onChange={() => onToggle(panelKey)}
              />
              {PULSE_EXPLORER_PANEL_LABELS[panelKey]}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/*
 * Pulse-level専用の状態エクスプローラー。
 * Gate-awareの状態エクスプローラーと同じ読み方（時刻カーソルを1本共有し、
 * 指標・確率・密度行列を同じ瞬間で並べる）をPulseの軌跡へ移したもの。
 * Bloch球は置かない。qutritも結合トランズモンも2準位に縮約できず、
 * 縮約して描いた球はリーケージを隠してしまうため。
 */
export function PulseStateExplorerPage({
  run,
  currentSignature,
  onOpenPulseLab,
}: PulseStateExplorerPageProps) {
  const internalInfoVisible = useInternalInfoVisible()
  const staleResult = run !== null && run.signature !== currentSignature
  const view = useMemo(
    () => (run === null ? null : buildPulseExplorerView(run.response, run.formAtRun)),
    [run],
  )
  const [cursorTimeUs, setCursorTimeUs] = useState(0)
  const [cursorRunKey, setCursorRunKey] = useState<string | null>(null)
  const [openPanels, setOpenPanels] = useState<Record<PulseExplorerPanelKey, boolean>>({
    physical: false,
    metrics: true,
    populations: false,
    probabilities: true,
    output: false,
    density: false,
  })

  /*
   * 新しい実行が入ったら、まずPulse終了時刻へカーソルを置く。
   * Gate-awareが「回路の後」のスナップショットを初期表示にするのと同じ理由で、
   * 駆動を切った直後の状態が最初に知りたい状態だから。
   * 実行が替わったことは描画中に分かるので、効果ではなくここで合わせる。
   */
  const runKey = run === null ? null : `${run.completedAt}/${run.signature}`
  if (cursorRunKey !== runKey) {
    setCursorRunKey(runKey)
    setCursorTimeUs(view?.pulseEndTimeUs ?? 0)
  }

  const togglePanel = useCallback((panelKey: PulseExplorerPanelKey) => {
    setOpenPanels((current) => ({ ...current, [panelKey]: !current[panelKey] }))
  }, [])
  const setAllPanels = useCallback((visible: boolean) => {
    setOpenPanels((current) => {
      const next = { ...current }
      for (const panelKey of Object.keys(PULSE_EXPLORER_PANEL_LABELS) as PulseExplorerPanelKey[]) {
        next[panelKey] = visible
      }
      return next
    })
  }, [])
  const showAllPanels = useCallback(() => setAllPanels(true), [setAllPanels])
  const hideAllPanels = useCallback(() => setAllPanels(false), [setAllPanels])

  const availablePanelKeys = useMemo(
    () => (Object.keys(PULSE_EXPLORER_PANEL_LABELS) as PulseExplorerPanelKey[]).filter((panelKey) => {
      if (view === null) {
        return false
      }
      if (panelKey === 'density') {
        return view.finalDensityMatrix !== null
      }
      return view.points.length > 0
    }),
    [view],
  )

  const petPhase: QuantumPetPhase = run === null ? 'idle' : 'done'
  const petMessage = run === null
    ? 'まだPulseの結果がないよ。先にPulseラボで実行してね。'
    : staleResult
      ? 'Pulseの設定が変わったみたい。いま見ているのは変更前の条件の結果だよ。'
      : null

  if (run === null || view === null) {
    return (
      <main className="pulse-explorer-page">
        <ExplorerHeader />
        <section className="pulse-explorer-page__empty" aria-labelledby="pulse-explorer-empty-title">
          <span className="pulse-explorer-page__eyebrow">結果なし</span>
          <h2 id="pulse-explorer-empty-title">Pulseシミュレーション結果がありません。</h2>
          <p>先にPulseラボでPulseシミュレーションを実行してください。</p>
          <button type="button" onClick={onOpenPulseLab}>Pulseラボを開く</button>
        </section>
        <QuantumPet phase={petPhase} message={petMessage} tips={pulseStateExplorerTips} />
      </main>
    )
  }

  const cursorIndex = nearestPulsePointIndex(view.points, cursorTimeUs)
  const cursorPoint = cursorIndex >= 0 ? view.points[cursorIndex] : null
  const cursorDensityMatrix = view.hasPerPointDensityMatrix
    ? cursorPoint?.densityMatrix ?? view.finalDensityMatrix
    : view.finalDensityMatrix

  return (
    <main className="pulse-explorer-page">
      <ExplorerHeader />

      {staleResult ? (
        <aside className="pulse-explorer-page__stale" role="status">
          <strong>再実行が必要</strong>
          <span>
            この結果を出したあとにPulseの設定または回路が変更されています。
            表示中の数値は変更前の条件のものです。現在の設定でもう一度実行してください。
          </span>
          <button type="button" onClick={onOpenPulseLab}>Pulseラボへ戻る</button>
        </aside>
      ) : null}

      <PanelVisibilityMenu
        panels={availablePanelKeys}
        openPanels={openPanels}
        onToggle={togglePanel}
        onShowAll={showAllPanels}
        onHideAll={hideAllPanels}
      />

      <div className="pulse-explorer-page__panels">
        <CollapsiblePanel
          panelKey="physical"
          open={openPanels.physical}
          onToggle={() => togglePanel('physical')}
        >
          <PulseTimelinePlayback
            view={view}
            simulationTimeUs={cursorTimeUs}
            onSimulationTimeChange={setCursorTimeUs}
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          panelKey="metrics"
          open={openPanels.metrics}
          onToggle={() => togglePanel('metrics')}
        >
          <PulseMetricTimeline view={view} cursorTimeUs={cursorTimeUs} />
        </CollapsiblePanel>

        <CollapsiblePanel
          panelKey="populations"
          open={openPanels.populations}
          onToggle={() => togglePanel('populations')}
        >
          <PulsePopulationTimeline
            response={run.response}
            formAtRun={run.formAtRun}
            cursorTimeUs={cursorTimeUs}
          />
        </CollapsiblePanel>

        <CollapsiblePanel
          panelKey="probabilities"
          open={openPanels.probabilities}
          onToggle={() => togglePanel('probabilities')}
        >
          <PulseStateProbabilityComparison view={view} cursorTimeUs={cursorTimeUs} />
        </CollapsiblePanel>

        <CollapsiblePanel
          panelKey="output"
          open={openPanels.output}
          onToggle={() => togglePanel('output')}
        >
          <PulseOutputProbabilities
            view={view}
            cursorTimeUs={cursorTimeUs}
            onCursorTimeChange={setCursorTimeUs}
          />
        </CollapsiblePanel>

        {view.finalDensityMatrix === null ? null : (
          <CollapsiblePanel
            panelKey="density"
            open={openPanels.density}
            onToggle={() => togglePanel('density')}
          >
            <div className="pulse-explorer-page__section-heading">
              <div>
                <span className="pulse-explorer-page__eyebrow">Full quantum state</span>
                <h2>密度行列</h2>
              </div>
              <p>
                {view.hasPerPointDensityMatrix
                  ? 'カーソル時刻の完全な密度行列です。占有確率は対角成分、コヒーレンスは非対角成分に現れます。仮想Zのような位相操作は対角成分を動かさないため、非対角成分で確認してください。'
                  : '2準位モデルの軌跡は占有確率だけを返すため、密度行列はPulse終了時と最終時刻の2点でのみ利用できます。ここでは最終時刻の密度行列を表示します。'}
              </p>
            </div>
            {cursorDensityMatrix === null ? (
              <div className="pulse-explorer-page__unavailable">
                この結果には密度行列が含まれていません。
              </div>
            ) : (
              <PulseDensityMatrixHeatmap
                key={`pulse-explorer-density-${view.dimension}`}
                matrix={cursorDensityMatrix}
                basisLabels={view.basisLabels}
                eyebrow={view.hasPerPointDensityMatrix ? 'DENSITY OPERATOR AT CURSOR' : 'FULL DENSITY OPERATOR'}
                title={
                  view.hasPerPointDensityMatrix
                    ? `密度行列（${cursorPoint?.timeUs.toFixed(4) ?? '—'} μs）`
                    : '最終密度行列'
                }
              />
            )}
          </CollapsiblePanel>
        )}
      </div>

      <section className="pulse-explorer-page__summary" aria-label="Pulse結果の概要">
        <span>{view.modelLabel}</span>
        <span>トランズモン {view.transmonCount}</span>
        <span>{view.dimension} x {view.dimension}</span>
        <span>サンプル {view.points.length} 個</span>
        <span>総観測時間 {view.totalTimeUs.toPrecision(4)} μs</span>
        {view.sequenceLength > 1 ? <span>操作 {view.sequenceLength} 個</span> : null}
        {internalInfoVisible ? (
          <span>{new Date(run.completedAt).toLocaleTimeString()} 実行</span>
        ) : null}
      </section>

      <QuantumPet phase={petPhase} message={petMessage} tips={pulseStateExplorerTips} />
    </main>
  )
}

function ExplorerHeader() {
  return (
    <header className="pulse-explorer-page__header">
      <div>
        <span className="pulse-explorer-page__eyebrow">Yuragi-Strider / Pulse-level results</span>
        <h1>Pulse 状態エクスプローラー</h1>
        <p className="pulse-explorer-page__scope">
          Pulseラボで実行した軌跡専用です。Gate-awareの回路スナップショットは
          Gate-awareの状態エクスプローラーで表示され、ここには読み込まれません。
          縮約Bloch球は、リーケージのある3準位以上の状態を正しく表せないため置いていません。
        </p>
      </div>
    </header>
  )
}
