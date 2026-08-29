import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';
import QuantumFluctuationField from '@site/src/components/QuantumFluctuationField';

/*
 * 本体アプリのホームの複製ではなく、製品紹介として読ませる面。
 * 本体ホームが「どのモードに入るか」を選ばせる操作盤なのに対し、
 * こちらは名前を初めて見た人に、何のための道具かを短く伝えるだけ。
 *
 * 数値も検証結果も機能一覧も置かない。それはドキュメント本体の仕事で、
 * ここに並べると入口が読みものになってしまう。この面に置くのは、
 * 何のための道具かを言う一文と、そこへの入口だけ。
 *
 * 下地には本体と同じ「真空のゆらぎ」を走らせて、要素はその上に浮かせる。
 */

function Masthead(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={styles.masthead}>
      <span className="eyebrow">Quantum circuit simulator</span>

      <Heading as="h1" className={styles.headline}>
        量子コンピュータが
        <br />
        <em>崩れていく側</em>まで、
        <br />
        触って確かめる。
      </Heading>

      <p className={styles.lede}>
        教科書の中では、量子回路は数式通りに動きます。けれど現実の装置では、
        計算している最中にも時間が流れ、熱や磁場に揺さぶられ、状態は崩れていきます。
        <strong>{siteConfig.title}</strong> は、その崩れる側まで手で触って確かめられる
        量子回路シミュレーターです。
      </p>

      {/* 入口その1。ヘッダのナビと、ページ下部と合わせて三か所。 */}
      <div className={styles.actions}>
        <Link
          className={styles.ctaPrimary}
          href="https://yuragi-strider-app.23sam55781.workers.dev">
          アプリを試す
        </Link>
        <Link className={styles.ctaGhost} to="/docs/overview/introduction">
          ドキュメントを読む
        </Link>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      {/*
        下地はこの面の中に閉じる。position のスタッキングを .home 側で
        作って、ゆらぎをその最下層に敷き、中身を上に浮かせる。
      */}
      <main className={styles.home}>
        <QuantumFluctuationField />

        <div className={styles.content}>
          <Masthead />
        </div>
      </main>
    </Layout>
  );
}
