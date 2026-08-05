import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'ゲート実行中のノイズ',
    description: (
      <>
        量子ゲートを瞬間的な操作として扱わず、実行時間を持つ操作として計算します。
        ゲートによる回転と環境散逸を同じ時間区間で扱います。
      </>
    ),
  },
  {
    title: '開放量子系の可視化',
    description: (
      <>
        Fidelity、Purity、出力確率、Bloch球などを通して、
        量子状態が環境によって劣化する過程を確認できます。
      </>
    ),
  },
  {
    title: '物理モデルを説明可能',
    description: (
      <>
        Lindblad方程式、熱励起、T1・T2、collapse operatorなど、
        内部モデルの仮定と適用範囲を公式ドキュメントで説明します。
      </>
    ),
  },
];

function Feature({
  title,
  description,
}: FeatureItem): ReactNode {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, index) => (
            <Feature key={index} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
