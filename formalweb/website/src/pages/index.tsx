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

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <div className="tt-hazard" aria-hidden="true" />

      <main className={styles.home}>
        <HomepageHeader />
        <HomepageFeatures />
        <HomepageEntries />
      </main>
    </Layout>
  );
}
