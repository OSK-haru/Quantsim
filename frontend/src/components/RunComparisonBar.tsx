import './RunComparisonBar.css'

type RunComparisonBarProps = {
  /* 保持中の実行の見出し。保持していなければ null。 */
  heldLabel: string | null
  /* 保持できる結果が手元にあるか。無ければ保持ボタンを押せない。 */
  canHold: boolean
  comparing: boolean
  onHold: () => void
  onRelease: () => void
  onComparingChange: (comparing: boolean) => void
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
 */
export function RunComparisonBar({
  heldLabel,
  canHold,
  comparing,
  onHold,
  onRelease,
  onComparingChange,
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
    </div>
  )
}
