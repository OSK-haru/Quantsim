import type {ReactNode} from 'react';
import styles from './styles.module.css';

/*
 * 本体ホームの capability グリッド (frontend/src/pages/HomePage.tsx の
 * `capabilities`) と同じ見せ方: 通し番号を macro 書体の accent で立て、
 * その下に mono のユニット名、最後に本文。Infima の col/row は使わない。
 */

type FeatureItem = {
  id: string;
  unit: string;
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    id: '01',
    unit: 'GATE–DURATION NOISE',
    title: 'ゲート実行中のノイズ',
    description: (
      <>
        量子ゲートを瞬間的な操作として扱わず、実行時間を持つ操作として計算します。
        ゲートによる回転と環境散逸を同じ時間区間で扱います。
      </>
    ),
  },
  {
    id: '02',
    unit: 'BLOCH / DENSITY MATRIX',
    title: '開放量子系の可視化',
    description: (
      <>
        Fidelity、Purity、出力確率、Bloch球などを通して、
        量子状態が環境によって劣化する過程を確認できます。
      </>
    ),
  },
  {
    id: '03',
    unit: 'T1 / TPHI LINDBLAD',
    title: '物理モデルを説明可能',
    description: (
      <>
        Lindblad方程式、熱励起、T1・T2、collapse operatorなど、
        内部モデルの仮定と適用範囲を公式ドキュメントで説明します。
      </>
    ),
  },
];

function Feature({id, unit, title, description}: FeatureItem): ReactNode {
  return (
    <li>
      <data className={styles.index} value={id}>
        {id}
      </data>
      <span className={styles.unit}>{unit}</span>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </li>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features} aria-labelledby="capability-heading">
      {/*
       * カードの見出しが h3 なので、その上に h2 を置いて見出し階層を
       * h1 → h2 → h3 に通す。DOCUMENT MAP 側の見出しと同じ体裁。
       */}
      <h2 id="capability-heading" className={styles.heading}>
        <span className="eyebrow">CAPABILITY</span>
      </h2>

      <ul className={styles.grid}>
        {FeatureList.map((props) => (
          <Feature key={props.id} {...props} />
        ))}
      </ul>
    </section>
  );
}
