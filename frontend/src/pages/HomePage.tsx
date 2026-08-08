import './HomePage.css'
import { useState } from 'react'

type HomePageProps = {
  onStartSimulation: () => void
  onOpenStateExplorer: () => void
  onOpenPulseLab: () => void
}



export function HomePage({
  onStartSimulation,
  onOpenStateExplorer,
  onOpenPulseLab,
}: HomePageProps) {
  const [activeAction, setActiveAction] =
    useState<'simulation' | 'explorer' | 'pulse' | null>(null)

  function triggerAction(
    action: 'simulation' | 'explorer' | 'pulse',
    callback: () => void,
  ) {
    setActiveAction(action)
    window.setTimeout(callback, 180)
  }

  return (
    <main className={`home-page${activeAction ? ' home-page--activated' : ''}`}>
      <section className="home-page__hero">
        <div className="home-page__eyebrow">Yuragi-Strider</div>
        <h1>Yuragi-Strider</h1>
        <p className="home-page__subtitle">
          量子ビットの&ldquo;ゆらぎ&rdquo;を、その場で見て確かめる
        </p>
        <p className="home-page__lede">
          理想的なゲート操作でも、現実の量子ビットは温度や磁束ノイズの影響で少しずつ状態がずれていきます。
          回路を組んでノイズの強さを変えるだけで、その&ldquo;ズレ&rdquo;がどれだけ・なぜ起きるのかをその場で確認できます。
        </p>

        <ul className="home-page__features">
          <li>回路を組んで、ノイズを変えて、結果を比較する</li>
          <li>理想状態と現実の状態のズレをBloch球・密度行列で可視化</li>
          <li>T1緩和・位相緩和など、物理モデルに基づくノイズ</li>
        </ul>

        <div className="home-page__actions">
          <button
            className={`home-page__button${activeAction === 'simulation' ? ' home-page__button--activated' : ''}`}
            type="button"
            onClick={() => triggerAction('simulation', onStartSimulation)}
          >
            シミュレーションを開始
          </button>
          <button
            className={`home-page__button home-page__button--secondary${activeAction === 'explorer' ? ' home-page__button--activated' : ''}`}
            type="button"
            onClick={() => triggerAction('explorer', onOpenStateExplorer)}
          >
            状態エクスプローラー
          </button>
          <button
            className={`home-page__button home-page__button--secondary${activeAction === 'pulse' ? ' home-page__button--activated' : ''}`}
            type="button"
            onClick={() => triggerAction('pulse', onOpenPulseLab)}
          >
            Pulseラボ / 実験的
          </button>
        </div>

        <p className="home-page__footnote">
          計算エンジン: Python（標準） / Rust（実験的な preview backend）
        </p>
      </section>
    </main>
  )
}
