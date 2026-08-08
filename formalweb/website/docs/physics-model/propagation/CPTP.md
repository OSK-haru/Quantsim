---
title: 明示的CPTP写像
sidebar_position: 2
---

# 明示的CPTP写像

各時間区間の発展を、数値積分ではなく**Liouvillianの行列指数**として厳密に計算する経路です。区間内でハミルトニアンと散逸子を定数とみなすことで、その区間の写像が完全正値かつトレース保存(CPTP)であることが構成上保証されます。

識別子は `explicit_cptp`(Gate-aware経路のメソッドIDは `gate_aware_constant_gksl_exponential_v1`)です。

## 構成

GKSL方程式をLiouvillian超演算子 $\mathcal{L}$ で書き、ベクトル化した密度行列に対して指数写像を作用させます。

$$
\operatorname{vec}\big(\rho(t + \Delta t)\big)
= \exp\!\left(\mathcal{L}\,\Delta t\right)\operatorname{vec}\big(\rho(t)\big)
$$

行列指数の計算には scaling and squaring 法(Padé 13次)を用います。

```text
ベクトル化規約  : column_major_vec_f_v1
行列指数        : scaling_squaring_pade13_numpy_v1 / _rust_v1
```

Gate-awareモデルでは1つのゲート列または待機区間が1つの定数GKSL指数写像に対応します。

## Choi行列による監査

各区間の写像 $\mathcal{E}$ に対して、Choi行列 $J(\mathcal{E})$ を構成し、CPTP性を数値的に検証します。

| 性質 | 判定 | 許容誤差 |
|---|---|---|
| 完全正値性(CP) | $J$ の最小固有値 $\ge -\epsilon$ | $10^{-12}$ |
| トレース保存性(TP) | 部分トレースが恒等演算子 | $10^{-12}$ |

```text
Choi規約  : unnormalized_input_output_row_major_v1
正規化    : 非正規化(Tr(J) = d)
添字順    : input ⊗ output
```

監査結果は診断 `cptp_all_maps_passed_audit`、最小Choi固有値、最大TP誤差として返されます。

## RK4との違い

| | RK4 | 明示的CPTP |
|---|---|---|
| 各区間の計算 | 数値積分(4次) | 行列指数(厳密) |
| 有限ステップでのCPTP性 | 保証されない | **構成上保証** |
| 密度行列の整形 | 各ステップで適用 | **適用しない** |
| 内部サブステップ | あり | なし(`integration_substeps = 0`) |
| 計算コスト | 低い | 高い(次元の2乗の行列を扱う) |

明示的CPTP経路で整形を適用しないのは、整形が不要だからです。整形が必要ということは、その経路がCPTP性を保っていないことを意味します。

## 時間依存性の扱い

:::warning 厳密なCPTP積分ではない
CPTP性が保証されるのは、**区間内でGKSL生成子が定数である**という前提のもとでのみです。

時間依存のパルスに対しては、区間の中点における生成子を用いた区分定数近似(`midpoint_piecewise_constant_v1`)が適用されます。したがって、連続的な時間依存問題に対する厳密なCPTP積分ではありません。

区間を細かくすれば近似は改善しますが、各区間が個別にCPTPであることと、全体が正しい解に収束することは別の問題です。
:::

## 規模による制限

Choi行列は $(2^n)^2 \times (2^n)^2$ のサイズを持つため、量子ビット数に対して急速に増大します。

このため、**5量子ビットの条件付き回路**では明示的CPTPを要求してもRK4に強制フォールバックします。

| 場面 | メッセージ |
|---|---|
| 主軌跡 | 「5量子ビットの条件付き回路は、次元32でのChoi監査が過大なためRK4を使用」 |
| 分岐実行 | 「Choi監査は $(2^n)^2$ でスケールするため、5量子ビット分岐はRK4に制限。主軌跡はCPTPを維持」 |

Coupled transmon pairモデルでは、CPTP区間数の上限が 500 に設定されています。

## 凍結された契約

明示的CPTPモデルは監査を経て凍結されています。

```text
freeze_id : yuragi_strider_explicit_cptp_v1
method    : explicit_cptp_midpoint_gksl_v1
判定       : PASS WITH RESTRICTIONS
```

Gate-aware経路についても別途凍結されています。

```text
freeze_id : yuragi_strider_gate_aware_cptp_v1
method    : gate_aware_constant_gksl_exponential_v1
判定       : PASS WITH RESTRICTIONS
```

凍結時に明記された制限は次のとおりです。

- 校正済みハードウェア予測を確立しない
- 非マルコフ的ダイナミクスを扱わない
- 実験室系の搬送波積分を行わない
- 多量子ビットパルス制御を確立しない

なお、凍結時点では「Gate-aware `run_simulation` でのCPTP実行」は未確立とされていましたが、これは後続の `yuragi_strider_gate_aware_cptp_v1` で確立されています。

## 検証状況

| 比較 | 条件 | 結果 |
|---|---|---|
| CPTP vs RK4 | 3ケース×3ステップ×2バックエンド | 最大トレース距離 $2.70\times10^{-4}$、PASS |
| CPTP vs QuTiP | 事前登録許容 $5\times10^{-5}$ / $2\times10^{-4}$ | 最良 $2.49\times10^{-5}$ / $8.61\times10^{-6}$、PASS |

Python実装とRust実装の一致は $1.78\times10^{-15}$ 以内です。詳細は[時間発展の検証](../validations/propagation.md)を参照してください。
