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
 * 数値や検証結果は置かない。それはドキュメント本体の仕事で、
 * ここに並べると入口が読みものになってしまう。ここに残すのは
 * 動機と、降りていける層があるという事実、それだけ。
 *
 * 下地には本体と同じ「真空のゆらぎ」を走らせて、要素はその上に浮かせる。
 */

/*
 * 製品の核。抽象度の階段を上から下へ。
 * 文で「アルゴリズムからパルスまで降りられる」と言うより、段として並べる。
 */
const layers: readonly {depth: string; label: string; body: string}[] = [
  {
    depth: 'L1',
    label: 'ALGORITHM',
    body: '量子アルゴリズムを組んで、動かす。',
  },
  {
    depth: 'L2',
    label: 'GATE + TIME',
    body: 'ゲートに実行時間を与える。計算している間にも、時間は流れている。',
  },
  {
    depth: 'L3',
    label: 'OPEN SYSTEM',
    body: '熱や磁場に揺さぶられ、量子状態が崩れていく過程を見る。',
  },
  {
    depth: 'L4',
    label: 'CONTROL PULSE',
    body: '実機を動かす制御パルスそのものを、波形から設計する。',
  },
];

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

/*
 * 動機。なぜ作ったのかを一段落だけ。
 * 詳しい話はドキュメント本体にあるので、ここでは引きに徹する。
 */
function Motivation(): ReactNode {
  return (
    <section className={styles.motivation}>
      <p className={styles.motivationLead}>
        教科書で見ていた量子回路と、実際の量子コンピュータの間には、
        まだいくつもの層がありました。
      </p>
      <p className={styles.motivationBody}>
        実機に「Xゲート」という物体があるわけではありません。超伝導量子コンピュータでは、
        マイクロ波を短く当てることでゲートに相当する操作を実現します。
        その間も量子ビットは環境と相互作用し、少しずつ情報を失っていきます。
        アルゴリズムを動かすところから、環境による劣化、実機の制御に近いところまで、
        自分で一段ずつ降りて確かめたい。それがこのシミュレーターの出発点です。
      </p>
    </section>
  );
}

function Layers(): ReactNode {
  return (
    <section className={styles.layers} aria-labelledby="layers-heading">
      <h2 id="layers-heading" className={styles.layersHeading}>
        <span className="eyebrow">The descent</span>
      </h2>

      <ol className={styles.layerList}>
        {layers.map(({depth, label, body}) => (
          <li className={styles.layer} key={depth}>
            <data className={styles.layerDepth} value={depth}>
              {depth}
            </data>
            <span className={styles.layerLabel}>{label}</span>
            <p className={styles.layerBody}>{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* 締め。立ち位置を一文で言い切って、最後の入口を出す。 */
function Closing(): ReactNode {
  return (
    <section className={styles.closing}>
      <p className={styles.closingLine}>
        量子コンピュータを<em>動かせる</em>だけの道具は、もうあります。
        <br />
        ここで作りたかったのは、<strong>動いた理由と、動かなくなる理由</strong>の
        両方が見える道具です。
      </p>

      {/* 入口その3。 */}
      <div className={styles.actions}>
        <Link className={styles.ctaPrimary} to="/docs/overview/introduction">
          ドキュメントを読む
        </Link>
        <Link
          className={styles.ctaGhost}
          href="https://yuragi-strider-app.23sam55781.workers.dev">
          アプリを試す
        </Link>
      </div>
    </section>
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
          <Motivation />
          <Layers />
          <Closing />
        </div>
      </main>
    </Layout>
  );
}
