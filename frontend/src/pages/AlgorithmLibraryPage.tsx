import './AlgorithmLibraryPage.css'
import { SectionHeader } from '../components/SectionHeader'
import type { SectionIconName } from '../components/SectionIcon'
import type { CircuitPresetKey } from '../context/CircuitContextCore'
import { useCircuitContext } from '../context/useCircuitContext'

type AlgorithmLibraryPageProps = {
  onOpenSimulation: () => void
}

type AlgorithmPreset = {
  key: CircuitPresetKey
  icon: SectionIconName
  category: string
  title: string
  qubits: number
  difficulty: string
  description: string
  highlights: string[]
}

const algorithmPresets: AlgorithmPreset[] = [
  {
    key: 'grover_2qubit',
    icon: 'chart',
    category: '探索アルゴリズム',
    title: 'Grover探索（2量子ビット）',
    qubits: 2,
    difficulty: '入門〜中級',
    description:
      '4通りの状態からCZゲートのオラクルで|11>だけに位相を反転させ、1回の拡散変換（振幅増幅）で測定確率を高めます。2量子ビットなら1回の反復で最適化されるため、Groverアルゴリズムの仕組みを最短で確認できます。',
    highlights: ['振幅増幅', 'オラクル', '拡散変換'],
  },
  {
    key: 'teleportation',
    icon: 'atom',
    category: '量子通信プロトコル',
    title: '量子テレポーテーション',
    qubits: 3,
    difficulty: '入門',
    description:
      'エンタングルメントと2ビットの古典通信を使い、量子状態をq0からq2へ転送します。ベル対の生成・ベル測定・条件付き補正という量子通信の基本パターンを確認できます。',
    highlights: ['エンタングルメント', 'ベル測定', '古典条件付きゲート'],
  },
  {
    key: 'bit_flip_repetition',
    icon: 'circuit',
    category: '量子誤り訂正',
    title: '3量子ビット反復符号',
    qubits: 5,
    difficulty: '中級',
    description:
      '1つの論理量子ビットを3つの物理量子ビットに符号化します。q1にX（ビット反転）故障を注入し、2つの補助量子ビットでシンドロームを測定して、条件付きゲートで自動的に誤りを訂正します。',
    highlights: ['誤り訂正符号', 'シンドローム測定', '条件付き補正'],
  },
]

export function AlgorithmLibraryPage({ onOpenSimulation }: AlgorithmLibraryPageProps) {
  const { handleLoadCircuitPreset } = useCircuitContext()

  function loadAndRun(key: CircuitPresetKey) {
    handleLoadCircuitPreset(key)
    onOpenSimulation()
  }

  return (
    <main className="algorithm-library-page">
      <header className="algorithm-library-page__header">
        <span className="algorithm-library-page__eyebrow">Yuragi-Strider / Gate-aware</span>
        <h1>アルゴリズム一覧</h1>
        <p className="algorithm-library-page__lede">
          回路をゼロから組む代わりに、代表的な量子アルゴリズムを読み込んですぐに実行できます。
          読み込み後はシミュレーションワークスペースに移動し、そのまま実行・パラメーター調整ができます。
        </p>
      </header>

      <div className="algorithm-library-page__grid">
        {algorithmPresets.map((preset) => (
          <article className="algorithm-library-page__card" key={preset.key}>
            <SectionHeader icon={preset.icon} eyebrow={preset.category} title={preset.title} />
            <p className="algorithm-library-page__description">{preset.description}</p>
            <div className="algorithm-library-page__tags">
              <span>{preset.qubits} 量子ビット</span>
              <span>{preset.difficulty}</span>
              {preset.highlights.map((highlight) => (
                <span key={highlight}>{highlight}</span>
              ))}
            </div>
            <button
              type="button"
              className="algorithm-library-page__button"
              onClick={() => loadAndRun(preset.key)}
            >
              この回路を読み込んで実行
            </button>
          </article>
        ))}
      </div>
    </main>
  )
}
