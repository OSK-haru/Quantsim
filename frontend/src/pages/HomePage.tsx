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
        <div className="home-page__eyebrow">QuantaScope</div>
        <h1>QuantaScope</h1>
        <p className="home-page__subtitle">
          物理環境を考慮した量子回路シミュレーター
        </p>
        <p className="home-page__lede">
          ゲート操作と環境ノイズが量子状態に与える影響を、視覚的に学べる
          教育向けシミュレーターです。Python を標準とし、Rust は任意の preview backend です。
        </p>

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
            Pulse Lab / Experimental
          </button>
        </div>
      </section>
    </main>
  )
}
