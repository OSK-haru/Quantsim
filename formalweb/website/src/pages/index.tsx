import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

/*
 * ここは本体アプリの HomePage (frontend/src/pages/HomePage.tsx) と同じ順序で
 * 読ませる: ハザード帯 → ワードマーク → 主題 + 諸元 → 機能 → 入口。
 * 「ドキュメントを開いたら別製品だった」と感じさせないための構成上の一致。
 */

/** 本体ホームの spec ブロックと同じ4項目。 */
const spec: readonly [string, string][] = [
  ['ENGINE', 'PYTHON / STD'],
  ['KERNEL', 'RUST / PREVIEW'],
  ['MODEL', 'GATE–AWARE OPEN SYS'],
  ['SOLVER', 'LINDBLAD / RK4'],
];

/*
 * sidebars.ts のトップレベル区画と 1 対 1 で対応させる。妥当性検証だけは
 * 「物理モデル詳細」の下位カテゴリだが、この製品の主張の核なので rail
 * (navbar) と同じくホームにも独立した入口として出す。
 * sidebars.ts に区画を足したら、ここにも足すこと。
 */
const sections = [
  {
    id: '01',
    unit: 'OVERVIEW',
    title: 'Yuragi-Striderとは',
    detail: '何を計算するシミュレーターなのか、どこを狙った道具なのか。',
    to: '/docs/overview/introduction',
  },
  {
    id: '02',
    unit: 'QUICK START',
    title: 'ダウンロードと起動',
    detail: '手元の環境で動かすまでの手順。',
    to: '/docs/getting-started/download',
  },
  {
    id: '03',
    unit: 'TUTORIALS',
    title: '画面別チュートリアル',
    detail:
      'Gate-aware と Pulse-level、2つのワークスペースの画面ごとの操作。',
    to: '/docs/tutorials/',
  },
  {
    id: '04',
    unit: 'PERFORMANCE',
    title: 'Rustによる高速化',
    detail: '密度行列計算を高速化する仕組みと、回路別の実測結果。',
    to: '/docs/performance/rust-acceleration',
  },
  {
    id: '05',
    unit: 'LEARN',
    title: '理論を学ぶ',
    detail: '量子状態から評価指標まで、同じ物理を定義と導出から追う9章。',
    to: '/docs/learn/',
  },
  {
    id: '06',
    unit: 'PHYSICS MODEL',
    title: '物理モデル詳細',
    detail:
      'Lindblad方程式、散逸モデル、制御モデル、時間発展の各段を定式から追う。',
    to: '/docs/physics-model/overview',
  },
  {
    id: '07',
    unit: 'VALIDATION',
    title: '妥当性検証',
    detail: '入力・時間発展・制御モデル・実機比較の検証結果。',
    to: '/docs/physics-model/validations/',
  },
  {
    id: '08',
    unit: 'LIMITATIONS',
    title: '制限事項',
    detail: '現時点で扱えない範囲と、意図的に置いている近似。',
    to: '/docs/limitations/current-limitations',
  },
];

function HomepageHeader(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={styles.hero}>
      <Heading as="h1" className={styles.wordmark}>
        <span>YURAGI</span>
        <span>
          STRIDER<sup className="tt-reg">&reg;</sup>
        </span>
      </Heading>

      <div className={styles.heroBody}>
        <div>
          <p className={styles.subtitle}>{siteConfig.tagline}</p>
          <p className={styles.lede}>
            量子ゲートを瞬間的な操作として扱わず、実行時間を持つ操作として計算します。
            このドキュメントでは、内部で使っている物理モデルの仮定・定式・適用範囲と、
            その妥当性をどう検証したかを公開しています。
          </p>
        </div>

        <dl className={styles.spec}>
          {spec.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

function HomepageEntries(): ReactNode {
  return (
    <nav className={styles.entries} aria-label="主な入口">
      <Link className={styles.entry} to="/docs/overview/introduction">
        <span className={styles.entryUnit}>Overview / 概要</span>
        <span className={styles.entryTitle}>
          <span className={styles.entryVector} aria-hidden="true">
            &gt;&gt;&gt;
          </span>
          Yuragi-Striderとは
        </span>
        <span className={styles.entryDetail}>
          どんな問題を解く道具なのか。まずはこちら。
        </span>
      </Link>

      <Link
        className={`${styles.entry} ${styles.entrySecondary}`}
        to="/docs/physics-model/overview">
        <span className={styles.entryUnit}>Physics / 物理モデル</span>
        <span className={styles.entryTitle}>
          <span className={styles.entryVector} aria-hidden="true">
            &gt;&gt;&gt;
          </span>
          物理モデルを見る
        </span>
        <span className={styles.entryDetail}>
          Lindblad方程式から時間発展まで、計算の中身を定式で確認する。
        </span>
      </Link>
    </nav>
  );
}

function HomepageSections(): ReactNode {
  return (
    <section className={styles.map} aria-label="ドキュメントの構成">
      <h2 className={styles.mapHeading}>
        <span className="eyebrow">DOCUMENT MAP</span>
      </h2>

      <ul className={styles.mapList}>
        {sections.map((section) => (
          <li key={section.id}>
            <Link className={styles.mapItem} to={section.to}>
              <data className={styles.mapIndex} value={section.id}>
                {section.id}
              </data>
              <span className={styles.mapUnit}>{section.unit}</span>
              <span className={styles.mapTitle}>{section.title}</span>
              <span className={styles.mapDetail}>{section.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <div className="tt-hazard" aria-hidden="true" />

      <main className={styles.home}>
        <HomepageHeader />
        <HomepageFeatures />
        <HomepageEntries />
        <HomepageSections />
      </main>
    </Layout>
  );
}
