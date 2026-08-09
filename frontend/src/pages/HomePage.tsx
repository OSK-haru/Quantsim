import './HomePage.css'
import { useEffect, useState } from 'react'
import { BlochSphereExplorer } from '../components/BlochSphereExplorer'
import { homeDemoSnapshots } from '../mock/homeDemoSnapshots'
import { useAnimationSettings } from '../context/useAnimationSettings'

const DEMO_ADVANCE_INTERVAL_MS = 700

type HomePageProps = {
  onStartSimulation: () => void
  onOpenStateExplorer: () => void
  onOpenPulseLab: () => void
}

const capabilities = [
  {
    id: '01',
    title: '回路を組んで、ノイズを変えて、結果を比較する',
    unit: 'CIRCUIT / NOISE SWEEP',
  },
  {
    id: '02',
    title: '理想状態と現実の状態のズレをBloch球・密度行列で可視化',
    unit: 'BLOCH / DENSITY MATRIX',
  },
  {
    id: '03',
    title: 'T1緩和・位相緩和など、物理モデルに基づくノイズ',
    unit: 'T1 / TPHI LINDBLAD',
  },
]

export function HomePage({
  onStartSimulation,
  onOpenStateExplorer,
  onOpenPulseLab,
}: HomePageProps) {
  const [activeAction, setActiveAction] =
    useState<'simulation' | 'explorer' | 'pulse' | null>(null)
  const { animationsEnabled } = useAnimationSettings()
  const [demoSnapshotIndex, setDemoSnapshotIndex] = useState(0)

  function triggerAction(
    action: 'simulation' | 'explorer' | 'pulse',
    callback: () => void,
  ) {
    setActiveAction(action)
    window.setTimeout(callback, 180)
  }

  useEffect(() => {
    if (!animationsEnabled) {
      return
    }
    const intervalId = window.setInterval(() => {
      setDemoSnapshotIndex((current) => (current + 1) % homeDemoSnapshots.length)
    }, DEMO_ADVANCE_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [animationsEnabled])

  return (
    <main className={`home-page${activeAction ? ' home-page--activated' : ''}`}>
      <div className="tt-hazard" aria-hidden="true" />

      <section className="home-page__hero">
        <h1 className="home-page__wordmark">
          <span>YURAGI</span>
          <span>
            STRIDER<sup className="tt-reg">&reg;</sup>
          </span>
        </h1>

        <div className="home-page__hero-body">
          <div className="home-page__hero-copy">
            <p className="home-page__subtitle">
              量子ビットの&ldquo;ゆらぎ&rdquo;を、その場で見て確かめる
            </p>
            <p className="home-page__lede">
              理想的なゲート操作でも、現実の量子ビットは温度や磁束ノイズの影響で少しずつ状態がずれていきます。
              回路を組んでノイズの強さを変えるだけで、その&ldquo;ズレ&rdquo;がどれだけ・なぜ起きるのかをその場で確認できます。
            </p>
          </div>

          <dl className="home-page__spec">
            <div>
              <dt>ENGINE</dt>
              <dd>PYTHON / STD</dd>
            </div>
            <div>
              <dt>KERNEL</dt>
              <dd>RUST / PREVIEW</dd>
            </div>
            <div>
              <dt>MODEL</dt>
              <dd>GATE&ndash;AWARE OPEN SYS</dd>
            </div>
            <div>
              <dt>SOLVER</dt>
              <dd>LINDBLAD / RK4</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="home-page__capabilities" aria-label="主な機能">
        <ul className="home-page__features">
          {capabilities.map((capability) => (
            <li key={capability.id}>
              <data className="home-page__feature-index" value={capability.id}>
                {capability.id}
              </data>
              <span className="home-page__feature-unit">{capability.unit}</span>
              <p className="home-page__feature-title">{capability.title}</p>
            </li>
          ))}
        </ul>
      </section>

      <nav className="home-page__actions" aria-label="主要な操作">
        <button
          className={`home-page__button${activeAction === 'simulation' ? ' home-page__button--activated' : ''}`}
          type="button"
          onClick={() => triggerAction('simulation', onStartSimulation)}
        >
          <span className="home-page__button-index">&gt;&gt;&gt;</span>
          シミュレーションを開始
        </button>
        <button
          className={`home-page__button home-page__button--secondary${activeAction === 'explorer' ? ' home-page__button--activated' : ''}`}
          type="button"
          onClick={() => triggerAction('explorer', onOpenStateExplorer)}
        >
          <span className="home-page__button-index">&gt;&gt;&gt;</span>
          状態エクスプローラー
        </button>
        <button
          className={`home-page__button home-page__button--secondary${activeAction === 'pulse' ? ' home-page__button--activated' : ''}`}
          type="button"
          onClick={() => triggerAction('pulse', onOpenPulseLab)}
        >
          <span className="home-page__button-index">&gt;&gt;&gt;</span>
          Pulseラボ / 実験的
        </button>
      </nav>

      <section className="home-page__demo">
        <div className="home-page__demo-head">
          <h2 className="home-page__demo-title">LIVE PREVIEW</h2>
          <span className="tt-meta">BLOCH VECTOR / STREAMING</span>
        </div>
        <div className="tt-barcode" aria-hidden="true" />
        <BlochSphereExplorer
          snapshots={homeDemoSnapshots}
          snapshotIndex={demoSnapshotIndex}
          onSnapshotIndexChange={setDemoSnapshotIndex}
        />
      </section>

      <footer className="home-page__colophon">
        <span>&copy; YURAGI&ndash;STRIDER</span>
        <span>PYTHON / RUST PREVIEW BACKEND</span>
        <span>NO WARRANTY &mdash; RESEARCH INSTRUMENT</span>
      </footer>
    </main>
  )
}
