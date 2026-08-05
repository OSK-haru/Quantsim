# 実行表現の選択

## 方針

回路意味論は `CircuitConfig` に統一し、計算表現だけを実行開始時に選択する。

| 条件 | 表現 | 計算量の目安 |
| --- | --- | --- |
| 1〜5量子ビット、ノイズあり | Density Matrix | $O(4^n)$ メモリ |
| 6〜18量子ビット、理想・測定なし | Statevector | $O(2^n)$ メモリ |
| 将来の大規模ノイズ | Trajectory（予約） | 軌跡数 × $O(2^n)$ |

現在のStatevector経路は、理想・測定なし回路で有効化される。中間測定を含む回路は、
測定スナップショットと混合状態の意味論を壊さないため、現段階では既存の分岐密度行列
経路を使用する。

## なぜDensity Matrixを無制限に拡張しないか

$n$量子ビットの密度行列は $2^n\times2^n$ であり、要素数は $4^n$ になる。
一方、純粋状態のStatevectorは $2^n$ 要素で済む。したがって、ノイズの有無を
無視して一つの表現に統一すると、理想回路まで不必要に指数コストが増える。

## 監査上の制約

- Statevectorはローカルゲートを直接作用させ、全体行列を構成しない。
- ノイズあり回路は既存のGate-aware密度行列／CPTP経路を正とする。
- Trajectoryはまだ未実装で、診断の `trajectory_available=false` で明示する。
- 表現と状態次元は `execution_representation`、`state_dimension`、
  `density_matrix_dimension` としてAPI診断へ出力する。

これにより、将来Trajectoryを追加しても、回路エディタ・条件式・ショットUIの契約を
変更せずに実行層だけを差し替えられる。
