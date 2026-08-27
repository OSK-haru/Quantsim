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
        <span>STRIDER</span>
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

/**
 * 文書一枚を折り返した図。区画ごとの入口を並べるのはやめて、
 * ここは「ドキュメントへ入る」一手だけに絞っている。
 */
function DocumentMark(): ReactNode {
  return (
    <svg
      className={styles.entryMark}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true">
      <path d="M11 5H29L37 13V43H11Z" />
      <path d="M29 5V13H37" />
      <path d="M17 21H31M17 27H31M17 33H25" />
    </svg>
  );
}

/** 起動中のアプリ本体を新しいタブで開く矢羽根。 */
function AppMark(): ReactNode {
  return (
    <svg
      className={styles.entryMark}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true">
      <path d="M8 40L24 8L40 40Z" />
      <path d="M24 8V40" />
    </svg>
  );
}

function HomepageEntries(): ReactNode {
  return (
    <nav className={styles.entries} aria-label="主な入口">
      <Link className={styles.entry} to="/docs/overview/introduction">
        <DocumentMark />
        <span className={styles.entryTitle}>ドキュメントを見る</span>
      </Link>
      <Link
        className={styles.entryAlt}
        href="https://yuragi-strider-app.23sam55781.workers.dev">
        <AppMark />
        <span className={styles.entryTitle}>アプリを試してみる</span>
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
