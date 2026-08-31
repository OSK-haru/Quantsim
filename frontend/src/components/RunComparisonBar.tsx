import './RunComparisonBar.css'
import { ResultImportButton } from './ResultImportButton'

type RunComparisonBarProps = {
  /* 保持中の実行の見出し。保持していなければ null。 */
  heldLabel: string | null
  /* 保持できる結果が手元にあるか。無ければ保持ボタンを押せない。 */
  canHold: boolean
  comparing: boolean
  onHold: () => void
  onRelease: () => void
  onComparingChange: (comparing: boolean) => void
  /* 表示中の結果をファイルへ書き出す。結果が無い画面では呼ばれない。 */
  onExport: () => void
  /* 書き出せる結果が手元にあるか。無ければ書き出しボタンを押せない。 */
  canExport: boolean
  /* 結果ファイルを読み込む。回路・設定ごと復元される。 */
  onImport: (file: File) => void
  /* 書き出し・読み込みの結果表示。何もしていないあいだは空文字。 */
  transferStatus: string
}

/*
 * 「前回の実行を保持して、いまの実行と見比べる」ための操作だけを置く帯。
 *
 * 保持は1件・ページ単位にする。各パネルは同じ物理時刻のカーソルを共有して
 * 動いているので、パネルごとに別々の実行を保持できてしまうと、
 * 隣り合う図が別々の条件を指すことになり読み方が壊れる。
 *
 * 比較表示は既定で切ってある。比較を出すと1枚の図に線が1本増えるので、
 * 見比べたいと決めたときだけ増えるようにする。
 *
 * 保持を続けるのは、回路と観測窓が変わらないあいだだけ。環境以外が動いたら
 * ページ側が保持を捨てるので、この帯からは「保持中」の表示ごと消える。
 *
 * 書き出しも同じ帯に置く。保持が「この画面の中で見比べる」手段なのに対し、
 * 書き出しは「画面の外へ持ち出す」手段で、どちらも表示中の結果に対する
 * 同じ種類の操作だからである。
 */
export function RunComparisonBar({
  heldLabel,
  canHold,
  comparing,
  onHold,
  onRelease,
  onComparingChange,
  onExport,
  canExport,
  onImport,
  transferStatus,
}: RunComparisonBarProps) {

  return (
    <div className="run-comparison-bar">
      {heldLabel === null ? (
        <>
          <span className="run-comparison-bar__hint">
            いまの結果を保持すると、環境パラメタだけを変えた次の実行と重ねられます。
          </span>
          <button type="button" onClick={onHold} disabled={!canHold}>
            この実行を保持
          </button>
        </>
      ) : (
        <>
          <span className="run-comparison-bar__held">
            <i className="run-comparison-bar__swatch" aria-hidden="true" />
            保持中：{heldLabel}
          </span>
          <label className="run-comparison-bar__toggle">
            <input
              type="checkbox"
              checked={comparing}
              onChange={(event) => onComparingChange(event.target.checked)}
            />
            比較表示
          </label>
          <button type="button" onClick={onHold} disabled={!canHold}>
            いまの実行に差し替え
          </button>
          <button type="button" className="run-comparison-bar__release" onClick={onRelease}>
            保持を解除
          </button>
        </>
      )}
      {/*
        * 書き出し・読み込みは保持の有無に関係なく使える。いま表示している
        * 結果を出す／別の結果を載せるだけで、保持側とは無関係だからである。
        */}
      <button
        type="button"
        className="run-comparison-bar__export"
        onClick={onExport}
        disabled={!canExport}
      >
        結果を書き出す
      </button>
      <ResultImportButton onImport={onImport} status={transferStatus} />
    </div>
  )
}
