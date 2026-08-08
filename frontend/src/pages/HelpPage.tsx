import './HelpPage.css'
import { MODEL_IDS, getModelLabel } from '../utils/modelLabels'

const currentEvolutionLabel = getModelLabel(MODEL_IDS.evolutionMode).label
const plannedModeLabel = getModelLabel(MODEL_IDS.plannedMode).label

const helpItems = [
  {
    question: '状態忠実度とは何ですか？',
    answer:
      '状態忠実度は、ノイズを含む結果が理想的な結果にどれだけ近いかを表します。1 に近いほど目標状態に近く、低いほど状態が大きく離れています。このアプリでは、回路の有効性がどの程度の速さで失われるかを示す主要な指標です。',
  },
  {
    question: '純度とは何ですか？',
    answer:
      '純度は、量子状態がどれだけ純粋か、または混合しているかを表します。純粋状態の純度は 1 に近く、混合状態では低くなります。忠実度が下がり始めても、状態が整ったまま理想的な目標から離れる場合があるため、純度は比較的高く保たれることがあります。',
  },
  {
    question: '有効操作時間とは何ですか？',
    answer:
      '有効操作時間は、忠実度がしきい値を下回る最初の時刻です。「回路はどのくらいの時間使えるのか？」という問いに、分かりやすく答える指標です。このアプリでは、有効時間が短いほど環境による回路の劣化が速いことを意味します。',
  },
  {
    question: '忠実度が低いのに純度が高いのはなぜですか？',
    answer:
      '忠実度と純度は異なるものを測定します。忠実度は理想的な目標への近さを確認し、純度は状態がどの程度混合しているかを確認します。そのため、状態が比較的純粋で整っていても、理想的な結果とは異なる方向を向いていることがあります。',
  },
  {
    question: 'ノイズが大きいと忠実度が下がるのはなぜですか？',
    answer:
      'ノイズは、状態が発展する間にランダムな乱れを加えます。その乱れによって、結果は理想的な軌跡からより速く離れていきます。この簡略化されたモデルでは、ノイズが大きいほど通常は忠実度の低下が速くなり、使用可能な時間が短くなります。',
  },
  {
    question: '完了時の忠実度と最終忠実度の違いは何ですか？',
    answer:
      '完了時の忠実度は、意図した操作が完了した時点の状態を測定します。最終忠実度は、シミュレーション全体のタイムラインが終了した時点の状態を測定します。ゲート完了後も状態が発展し続ける場合、両者は異なる値になります。',
  },
  {
    question: 'Yuragi-Strider はどのモデルを使用していますか？',
    answer:
      `Yuragi-Strider は現在、学習用の弱結合開放系シミュレーションである「${currentEvolutionLabel}」を使用しています。環境設定を単純化した T1・T2 緩和時間に変換し、選択したモデルでの傾向を確認できるようにしています。特定のハードウェアを正確に予測するものではありません。「${plannedModeLabel}」は将来対応予定で、現在のシミュレーション経路には未実装です。`,
  },
  {
    question: 'ハードウェアを正確に再現するシミュレーターですか？',
    answer:
      'いいえ。厳密に校正されたハードウェアモデルではなく、簡略化された学習用モデルです。結果は選択した前提条件での傾向を示すもので、特定のデバイスに対する正確な予測ではありません。',
  },
  {
    question: '忠実度が下がったときは何を試せばよいですか？',
    answer:
      'まず低ノイズ条件と高ノイズ条件で実行し、有効時間がどのように変化するかを比較してください。忠実度が急速に低下する場合は、最初にノイズレベルを下げ、その後で温度や磁場の変化を比較します。どの条件が状態を理想的な結果から最も強く引き離しているかを確認することが目的です。',
  },
]

export function HelpPage() {
  return (
    <main className="help-page">
      <header className="help-page__header">
        <div>
          <div className="help-page__eyebrow">Yuragi-Strider</div>
          <h1>ヘルプ / Q&amp;A</h1>
          <p className="help-page__lede">
            シミュレーション画面の見方、指標の比較、結果が変化する理由を説明します。
          </p>
        </div>
      </header>

      <section className="help-page__intro" aria-label="モデルについての注意">
        <p>
          ここで説明する内容は、このアプリで使用している簡略化モデルに基づいています。
          現在のシミュレーションは学習用で、ゲートを考慮した Lindblad ベースのモデルです。
          選択した環境設定による傾向を確認することを目的としています。
        </p>
      </section>

      <section className="help-page__grid" aria-label="ヘルプの質問">
        {helpItems.map((item) => (
          <article className="help-page__card" key={item.question}>
            <h2 className="help-page__question">{item.question}</h2>
            <p className="help-page__answer">{item.answer}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
