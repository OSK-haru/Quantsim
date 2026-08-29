import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

/*
 * ここは本体アプリのホームの複製ではなく、製品紹介として読ませる面。
 * 本体ホームは「起動して、どのモードに入るか」を選ばせる操作盤だが、
 * こちらは初めて名前を見た人に「何ができる道具で、なぜ信用できるのか」を
 * 順に読ませる: 主題 → 3つの価値 → 降りていく層 → 検証の数字 → 入口。
 *
 * 意匠 (トークン・書体・ヘアライン区画) は本体と共有したままにする。
 * 変えるのは構図と語り口だけで、別製品に見せることが目的ではない。
 */

/** 冒頭の一撃。製品が何を提供するかを3つに割る。 */
const propositions: readonly {
  id: string;
  unit: string;
  title: string;
  body: string;
}[] = [
  {
    id: '01',
    unit: 'NO PRIOR KNOWLEDGE',
    title: '予備知識ゼロから始められる',
    body:
      '起動すると案内役のナビペットが、回路を組んで動かし結果を読むところまで連れて行きます。数式は出しません。条件を変えて実行し直すたび、量子状態の変化がその場で画面に出ます。',
  },
  {
    id: '02',
    unit: 'DOWN TO THE WAVEFORM',
    title: '実機を設計する層まで降りられる',
    body:
      '「Xゲートを置く」で止まりません。そのゲートが実機でどんな制御パルスとして作られているのか、波形そのものを設計してシミュレートできます。通常はコードを書ける専門家しか到達できない層です。',
  },
  {
    id: '03',
    unit: 'VERIFIED AGAINST HARDWARE',
    title: '「本当に正しいのか」を検証済み',
    body:
      '独立ライブラリ QuTiP との突き合わせ、数値解法の収束次数、CPTP性の全時刻監視、そして IBM Quantum 実機へのジョブ投入まで行い、結果は機械可読な形で公開しています。合わなかった点もそのまま書いています。',
  },
];

/**
 * 製品の核。抽象度の階段を上から下へ1本の列で見せる。
 * 「アルゴリズムからパルスまで連続して降りられる」という主張は、
 * 文章で言うより段として並べたほうが速い。
 */
const descent: readonly {
  depth: string;
  layer: string;
  title: string;
  body: string;
  to: string;
}[] = [
  {
    depth: 'L1',
    layer: 'ALGORITHM',
    title: '量子アルゴリズムを動かす',
    body:
      'Grover探索、量子テレポーテーション、反復符号などを収録したライブラリから選んで、そのまま実行し分解して読めます。',
    to: '/docs/tutorials/gate-aware/algorithm-library',
  },
  {
    depth: 'L2',
    layer: 'GATE + TIME',
    title: 'ゲートに実行時間を与える',
    body:
      'ゲートを瞬間的な操作として扱わず、実行時間を持つ操作として計算します。回転と環境散逸を同じ時間区間で扱います。',
    to: '/docs/physics-model/control_models/gate-awaremodel',
  },
  {
    depth: 'L3',
    layer: 'OPEN SYSTEM',
    title: '環境ノイズで状態が崩れる',
    body:
      'T1・T2、熱励起、純位相緩和。Lindblad方程式で開放系として解き、Fidelity・Purity・Bloch球で劣化の過程を追えます。',
    to: '/docs/physics-model/lindblad',
  },
  {
    depth: 'L4',
    layer: 'CONTROL PULSE',
    title: '実機を動かす波形を設計する',
    body:
      '3準位トランズモンと DRAG パルスを実装。計算に使わない |2⟩ への漏れ (リーケージ) を、波形設計で抑えられることまで観察できます。',
    to: '/docs/learn/pulse/leakage-drag',
  },
];

/** 検証で出た数字。主張ではなく計測値として mono で並べる。 */
const evidence: readonly {
  value: string;
  unit: string;
  label: string;
  to: string;
}[] = [
  {
    value: '7.6',
    unit: '×10⁻⁸',
    label: 'QuTiP とのトレース距離 (合格基準 5×10⁻⁷)',
    to: '/docs/physics-model/validations/propagation',
  },
  {
    value: '4.00',
    unit: '×/step',
    label: '時間刻み半減あたりの誤差減少 = 2次収束',
    to: '/docs/physics-model/validations/propagation',
  },
  {
    value: '4.4',
    unit: '% avg',
    label: 'IBM Quantum 実機 (ibm_kingston) との平均差',
    to: '/docs/physics-model/validations/hardware-comparison',
  },
  {
    value: '10⁻¹⁵',
    unit: 'rust/py',
    label: 'Rust 実装と Python 実装の差 = 倍精度の限界',
    to: '/docs/performance/rust-acceleration',
  },
];

/** 実測のショーケース。数値ひとつで「降りられる」ことを証明する。 */
const showcase = {
  before: '10.04',
  after: '5.58',
} as const;

function Masthead(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={styles.masthead}>
      <div className={styles.mastheadMeta}>
        <span className="eyebrow">Quantum circuit simulator</span>
        <span className={styles.mastheadRev}>REV 2.6 / OPEN SYSTEM</span>
      </div>

      <Heading as="h1" className={styles.headline}>
        量子コンピュータが
        <br />
        <em>崩れていく側</em>まで、
        <br />
        触って確かめる。
      </Heading>

      <p className={styles.lede}>
        教科書の中では、量子回路は数式通りに動きます。しかし現実の装置では、計算している最中にも時間が流れ、
        熱や磁場に揺さぶられ、状態は崩れていきます。<strong>{siteConfig.title}</strong> は、
        その崩れる側まで GUI で触って確かめられる量子回路シミュレーターです。
      </p>

      <div className={styles.mastheadActions}>
        <Link
          className={styles.ctaPrimary}
          href="https://yuragi-strider-app.23sam55781.workers.dev">
          アプリを試してみる
        </Link>
        <Link className={styles.ctaGhost} to="/docs/overview/introduction">
          ドキュメントを読む
        </Link>
      </div>

      <p className={styles.mastheadNote}>
        ブラウザで動作 / インストール不要 / 予備知識不要
      </p>
    </header>
  );
}

function Propositions(): ReactNode {
  return (
    <section className={styles.section} aria-labelledby="value-heading">
      <div className={styles.sectionHead}>
        <h2 id="value-heading" className={styles.sectionTitle}>
          <span className="eyebrow">What it gives you</span>
        </h2>
      </div>

      <ul className={styles.propGrid}>
        {propositions.map(({id, unit, title, body}) => (
          <li key={id}>
            <data className={styles.propIndex} value={id}>
              {id}
            </data>
            <span className={styles.propUnit}>{unit}</span>
            <h3 className={styles.propTitle}>{title}</h3>
            <p className={styles.propBody}>{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Descent(): ReactNode {
  return (
    <section className={styles.section} aria-labelledby="descent-heading">
      <div className={styles.sectionHead}>
        <h2 id="descent-heading" className={styles.sectionTitle}>
          <span className="eyebrow">The descent</span>
        </h2>
        <p className={styles.sectionLede}>
          一般的なシミュレーターは、どこか一つの層で止まります。Yuragi-Strider が作ったのは、
          学習者が GUI のまま <strong>アルゴリズムから実機の波形まで連続して降りていける経路</strong> です。
        </p>
      </div>

      <ol className={styles.descent}>
        {descent.map(({depth, layer, title, body, to}) => (
          <li key={depth}>
            <Link className={styles.descentRow} to={to}>
              <data className={styles.descentDepth} value={depth}>
                {depth}
              </data>
              <span className={styles.descentLayer}>{layer}</span>
              <span className={styles.descentBody}>
                <span className={styles.descentTitle}>{title}</span>
                <span className={styles.descentDetail}>{body}</span>
              </span>
              <span className={styles.descentArrow} aria-hidden="true">
                &gt;
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/*
 * 実測ひとつ。数字を2つ並べるだけで「波形設計がゲートの質を決める」が伝わる。
 * 回路図の上でXゲートを置いているだけでは決して見えない差、という主張の実物。
 */
function Showcase(): ReactNode {
  return (
    <section className={styles.showcase} aria-labelledby="showcase-heading">
      <div className={styles.showcaseCopy}>
        <h2 id="showcase-heading" className={styles.showcaseTitle}>
          <span className="eyebrow">Measured in-app</span>
          <span className={styles.showcaseHeadline}>
            パルス波形だけで、リーケージが半分になる。
          </span>
        </h2>
        <p className={styles.showcaseBody}>
          同じ回路・同じ環境のまま、DRAG 係数 β を 0.001 から 0.002 に変えただけ。
          計算に使わない第3準位 |2⟩ への漏れが半減し、計算部分空間に残る確率は
          89.96% → 94.42% に改善しました。GUI 上で数値として確かめられます。
        </p>
        <Link className={styles.showcaseLink} to="/docs/learn/pulse/leakage-drag">
          リーケージと DRAG の理論を読む
        </Link>
      </div>

      <div className={styles.showcaseReadout}>
        <div className={styles.readoutCell} data-state="before">
          <span className={styles.readoutLabel}>β = 0.001</span>
          <output className={styles.readoutValue}>
            {showcase.before}
            <span>%</span>
          </output>
          <span className={styles.readoutUnit}>LEAKAGE TO |2⟩</span>
        </div>
        <div className={styles.readoutCell} data-state="after">
          <span className={styles.readoutLabel}>β = 0.002</span>
          <output className={styles.readoutValue}>
            {showcase.after}
            <span>%</span>
          </output>
          <span className={styles.readoutUnit}>LEAKAGE TO |2⟩</span>
        </div>
      </div>
    </section>
  );
}

function Evidence(): ReactNode {
  return (
    <section className={styles.section} aria-labelledby="evidence-heading">
      <div className={styles.sectionHead}>
        <h2 id="evidence-heading" className={styles.sectionTitle}>
          <span className="eyebrow">Why you can trust it</span>
        </h2>
        <p className={styles.sectionLede}>
          きれいなグラフが出ることと、計算が正しいことは別物です。独立ライブラリ、数値解析、
          そして実機との突き合わせまで行い、生データを公開しています。
        </p>
      </div>

      <dl className={styles.evidence}>
        {evidence.map(({value, unit, label, to}) => (
          <Link className={styles.evidenceCell} key={label} to={to}>
            <dt className={styles.evidenceLabel}>{label}</dt>
            <dd className={styles.evidenceValue}>
              <span className={styles.evidenceNumber}>{value}</span>
              <span className={styles.evidenceUnit}>{unit}</span>
            </dd>
          </Link>
        ))}
      </dl>
    </section>
  );
}

function Onboarding(): ReactNode {
  return (
    <section className={styles.section} aria-labelledby="start-heading">
      <div className={styles.sectionHead}>
        <h2 id="start-heading" className={styles.sectionTitle}>
          <span className="eyebrow">Where to start</span>
        </h2>
      </div>

      <div className={styles.startGrid}>
        <Link className={styles.startCard} to="/docs/overview/introduction">
          <span className={styles.startUnit}>OVERVIEW</span>
          <span className={styles.startTitle}>まず概要を読む</span>
          <span className={styles.startDetail}>
            このシミュレーターが何を計算していて、何を計算していないのか。
          </span>
        </Link>
        <Link className={styles.startCard} to="/docs/learn/">
          <span className={styles.startUnit}>LEARN / THEORY</span>
          <span className={styles.startTitle}>理論から学ぶ</span>
          <span className={styles.startDetail}>
            量子状態、密度行列、開放量子系、パルス制御を基礎から。
          </span>
        </Link>
        <Link className={styles.startCard} to="/docs/tutorials/">
          <span className={styles.startUnit}>TUTORIALS</span>
          <span className={styles.startTitle}>画面の使い方を見る</span>
          <span className={styles.startDetail}>
            Gate-aware 側に6本、Pulse-level 側に4本の画面別チュートリアル。
          </span>
        </Link>
        <Link
          className={styles.startCard}
          to="/docs/physics-model/validations/">
          <span className={styles.startUnit}>VALIDATION</span>
          <span className={styles.startTitle}>検証結果を確かめる</span>
          <span className={styles.startDetail}>
            QuTiP 比較、収束次数、CPTP性、実機比較の生データと再現手順。
          </span>
        </Link>
      </div>
    </section>
  );
}

/** 締め。製品の立ち位置を一文で言い切って、入口をもう一度出す。 */
function Closing(): ReactNode {
  return (
    <section className={styles.closing}>
      <p className={styles.closingLine}>
        量子コンピュータを<em>動かせる</em>だけの道具はもうあります。
        <br />
        Yuragi-Strider が作りたかったのは、
        <strong>動いた理由と、動かなくなる理由の両方が見える道具</strong>です。
      </p>

      <div className={styles.mastheadActions}>
        <Link
          className={styles.ctaPrimary}
          href="https://yuragi-strider-app.23sam55781.workers.dev">
          アプリを試してみる
        </Link>
        <Link className={styles.ctaGhost} to="/docs/overview/introduction">
          ドキュメントを読む
        </Link>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <div className="tt-hazard" aria-hidden="true" />

      <main className={styles.home}>
        <Masthead />
        <Propositions />
        <Descent />
        <Showcase />
        <Evidence />
        <Onboarding />
        <Closing />
      </main>
    </Layout>
  );
}
