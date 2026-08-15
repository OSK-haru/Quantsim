import './HomePage.css'
import { useState } from 'react'
import { QuantumPet } from '../components/QuantumPet'
import { useTutorial } from '../context/useTutorial'
import { homeTips } from '../utils/quantumPetTips'
import { tutorialCourseList } from '../utils/tutorialScript'

type HomePageProps = {
  onStartSimulation: () => void
  onOpenPulseLab: () => void
}

export function HomePage({ onStartSimulation, onOpenPulseLab }: HomePageProps) {
  const [activeMode, setActiveMode] = useState<'gate-aware' | 'pulse' | null>(null)
  const tutorial = useTutorial()

  function triggerMode(mode: 'gate-aware' | 'pulse', callback: () => void) {
    setActiveMode(mode)
    window.setTimeout(callback, 180)
  }

  return (
    <main className={`home-page${activeMode ? ' home-page--activated' : ''}`}>
      <div className="tt-hazard" aria-hidden="true" />

      <section className="home-page__hero" data-tutorial-anchor="home-hero">
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

      {/*
        ここは2つのモードの入口。以前は Gate-aware 側だけ2つ（シミュレーション と
        状態エクスプローラー）並んでいて、モード選択と画面選択が混ざっていた。
        状態エクスプローラーは Gate-aware の中の1画面なので、ナビゲーションと
        実行後の導線に任せ、ここはモードだけを左右対称に見せる。
      */}
      <nav className="home-page__actions" aria-label="モードの選択">
        <button
          className={`home-page__mode${activeMode === 'gate-aware' ? ' home-page__mode--activated' : ''}`}
          type="button"
          onClick={() => triggerMode('gate-aware', onStartSimulation)}
        >
          <span className="home-page__mode-unit">Gate-aware / 標準</span>
          <span className="home-page__mode-title">
            <span className="home-page__mode-index" aria-hidden="true">
              &gt;&gt;&gt;
            </span>
            通常モードを開始
          </span>
          <span className="home-page__mode-detail">
            量子ゲートで回路を組み、ノイズの下で状態がどうずれるかを調べます。まずはこちら。
          </span>
        </button>
        <button
          className={`home-page__mode home-page__mode--secondary${activeMode === 'pulse' ? ' home-page__mode--activated' : ''}`}
          type="button"
          onClick={() => triggerMode('pulse', onOpenPulseLab)}
        >
          <span className="home-page__mode-unit">Pulse / 実験的</span>
          <span className="home-page__mode-title">
            <span className="home-page__mode-index" aria-hidden="true">
              &gt;&gt;&gt;
            </span>
            PULSEモードを開始
          </span>
          <span className="home-page__mode-detail">
            ゲートより下の層へ。マイクロ波パルスの波形そのものから量子ビットの応答を追います。
          </span>
        </button>
      </nav>

      {/*
        はじめて来た人の入口。モード選択の下に置いて、
        「まず何をすればいいか分からない」で止まらないようにする。
        1本目で使い方、2本目で物理の実験、と役割を分けている。
      */}
      <section className="home-page__tutorial" aria-label="チュートリアル">
        <div className="home-page__tutorial-intro">
          <span className="home-page__tutorial-unit">Guided tour / ナビペットが案内します</span>
          <p className="home-page__tutorial-lede">
            量子回路を知らなくても大丈夫。画面の見るべき場所を光らせながら、
            手を動かして進みます。
          </p>
        </div>

        <ul className="home-page__tutorial-list">
          {tutorialCourseList.map((course, index) => {
            const isCompleted = tutorial.completedCourses.includes(course.id)
            return (
              <li className="home-page__tutorial-course" key={course.id}>
                <div className="home-page__tutorial-course-head">
                  <data className="home-page__tutorial-index" value={index + 1}>
                    {String(index + 1).padStart(2, '0')}
                  </data>
                  <h2 className="home-page__tutorial-name">{course.title}</h2>
                  <span className="home-page__tutorial-meta">
                    {isCompleted ? `修了済み / ${course.duration}` : course.duration}
                  </span>
                </div>
                <p className="home-page__tutorial-summary">{course.summary}</p>
                <button
                  className="home-page__tutorial-button"
                  type="button"
                  onClick={() => tutorial.start(course.id)}
                >
                  {isCompleted ? 'もう一度受ける' : 'はじめる'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="home-page__colophon">
        <span>&copy; YURAGI&ndash;STRIDER</span>
        <span>PYTHON / RUST PREVIEW BACKEND</span>
        <span>NO WARRANTY &mdash; RESEARCH INSTRUMENT</span>
      </footer>

      {/* ホームでもナビペットは常駐する。チュートリアルの入口はここにも置く。 */}
      <QuantumPet
        phase="idle"
        tips={homeTips}
        actions={tutorialCourseList.map((course, index) => (
          <button
            className={`quantum-pet__action${index === 0 ? '' : ' quantum-pet__action--quiet'}`}
            type="button"
            key={course.id}
            onClick={() => tutorial.start(course.id)}
          >
            {course.title}
          </button>
        ))}
      />
    </main>
  )
}
