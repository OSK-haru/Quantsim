---
title: 入力モデルの検証
sidebar_position: 2
---

# 入力モデルの検証

環境パラメータから物理レートへの写像([入力とパラメータ](../input_and_parameters.md))が正しいかを検証します。

## V2: ゼロ温度における熱励起

### 比較対象と条件

実装が計算する熱占有数 $n_{\text{th}}$ を、**独立に実装したBose-Einstein式**と比較します。

$$
n_{\text{th}} = \frac{1}{\exp\!\left(\dfrac{h f_q}{k_B T}\right) - 1}
$$

固定条件:

```text
device_quality   = 1.0
t1_max_us        = 100.0
flux_noise_phi0  = 0.0
qubit_frequency  = 5.0 GHz
→ gamma0_per_us  = 0.01
```

検証ケース(JSON上25行、単体テスト10件):

| ケース | 内容 |
|---|---|
| V2-1 | 厳密に $T = 0$ |
| V2-2 | $T = 0$、周波数 1 / 5 / 10 GHz |
| V2-3 | $T = 10^{-9}$, $10^{-6}$, $0.001$ mK(極低温) |
| V2-4 | 温度掃引 0 / 1 / 10 / 20 / 100 / 1000 mK + 単調性 |
| V2-5 | 周波数掃引 1 / 3 / 5 / 10 GHz(100 mK)+ 単調性 |
| V2-6 | 詳細釣り合い 4点 |
| V2-7 | 実際の崩壊演算子の構成 |
| V2-8 | 物理的 $T=0$ と `ideal_reference=True` の比較 |

### 許容誤差

```text
detailed_balance_absolute : 1e-12
detailed_balance_relative : 1e-10
analytic_n_th_absolute    : 1e-12
```

### 実測値

詳細釣り合いの誤差(4ケース):

```text
2.649563e-25
8.673617e-18
0.000000e+00
5.551115e-17   ← 最大
```

参照値(5 GHz):

| 温度 | $n_{\text{th}}$ |
|---|---|
| 0 mK | 0.0 |
| 1 mK | 6.106056e-105 |
| 10 mK | 3.789449e-11 |
| 100 mK | 9.981031e-02 |
| 1000 mK | 3.687302 |

数値安全分岐も監査対象です($T \le 0$ で 0、指数部 > 700 で 0、中間域は `expm1`)。

### 判定

**PASS**(`overall_pass: true`、全行PASS)

### 制限事項

- 一般デバイスプロファイルをハードウェアに校正するものではない
- 有限温度における全ダイナミクスを検証するものではない

記録された曖昧性: 「`gamma1_per_us` は `gamma_down_per_us` の互換エイリアスとしてのみ保持される」

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_zero_temperature_thermal_excitation.py
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_temperature_thermal_excitation
```

アーティファクト: `validation_results/validation2_zero_temperature.json` / `.csv`

---

## V5: 有限温度における平衡

### 比較対象と条件

解析解と比較します。

$$
P_1(t) = P_1^{\text{eq}} + \left(P_1(0) - P_1^{\text{eq}}\right)e^{-(\gamma_\downarrow + \gamma_\uparrow)t},
\qquad
P_1^{\text{eq}} = \frac{\gamma_\uparrow}{\gamma_\downarrow + \gamma_\uparrow}
$$

2つの層で6ケース:

| 層 | ケース | 条件 |
|---|---|---|
| `direct_rate` | V5-1〜V5-3 | ハミルトニアン 0、位相緩和 0、初期状態 $\|0\rangle$ / $\|1\rangle$ / $I/2$ |
| `physical_input` | P5-1〜P5-3 | 50 / 100 / 200 mK、5 GHz、品質 1.0、$T_1^{\max}$ 100 μs、磁束ノイズ 0 |

### 許容誤差

```text
max_abs_error_p1                 : 1e-6
rmse_p1                          : 1e-7
max_relative_fit_error           : 1e-4
max_pairwise_final_p1_difference : 1e-5
max_trace_error                  : 1e-10
max_hermiticity_error            : 1e-10
minimum_eigenvalue               : -1e-10
max_step_refinement_difference   : 1e-7
```

### 実測値

$P_1$ の最大絶対誤差:

| ケース | 誤差 |
|---|---|
| V5-1 | 6.146805e-12 |
| V5-2 | 9.676537e-11 |
| V5-3 | 1.018781e-08 |
| P5-1 | 1.947442e-12 |
| P5-2 | 3.545775e-12 |
| P5-3 | 1.745104e-11 |

補足的な監査:

- フィットされたレートの相対誤差: 1.95e-11 〜 5.43e-08
- **初期状態非依存性**: 最終 $P_1$ の最大ペア差 **6.144216e-06**(許容 1e-5)
- Gibbs詳細釣り合いの参照差: 最大 5.551115e-17
- ステップ細分化: 0.5 / 0.25 / 0.125 μs

初期状態非依存性は、$|0\rangle$、$|1\rangle$、最大混合状態のいずれから出発しても同一の平衡に達することを確認するもので、平衡状態が正しく実装されている強い証拠です。

### 判定

**PASS**(`overall_pass: true`)

### 制限事項

ハードウェア校正、パルスレベルの挙動、非マルコフ的物理、外部ソルバーとの一致は確立しません。

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_finite_temperature_equilibrium.py
```

アーティファクト: `validation_results/validation5_finite_temperature_equilibrium.json` / `.csv` / `.png`

---

## レート変数の命名規約

正準名と非推奨エイリアスの対応は、単体テスト(`tests/test_rate_variable_naming_refactor.py`)およびAPI/UIアダプタのテストで担保されています。

規約の要点:

- 崩壊演算子の係数は $\sqrt{\gamma_\downarrow}$、$\sqrt{\gamma_\uparrow}$、$\sqrt{\gamma_\phi/2}$
- 合計population緩和レート $\gamma_{\text{pop}}$ は**決して崩壊演算子の係数として使わない**
- `gamma1_per_us` は `gamma_down_per_us` の読み取り専用エイリアスであり、$\gamma_{\text{pop}}$ ではない

:::note 機械可読アーティファクトなし
この移行には対応するJSON/CSVアーティファクトが存在しません。担保は単体テストのみです。
:::

---

## 検証されていない範囲

:::warning デバイス品質と磁束ノイズの写像は未検証
入力モデルのうち、次の2つの写像には**検証ドキュメントも機械可読アーティファクトも存在しません**。

1. `device_quality` → $T_1$ / $T_\phi$(幾何補間)
2. `flux_noise_phi0` → $\gamma_\phi$(線形写像)

担保されているのは単体テストによる**単調性の確認のみ**です。

- `tests/test_physical_environment.py::test_higher_device_quality_increases_base_times`
- `tests/test_physical_environment.py::test_higher_flux_noise_increases_gamma_phi`
- `tests/test_unified_environment_rates.py::test_higher_flux_noise_increases_dephasing_rate`
- `tests/test_unified_environment_rates.py::test_higher_device_quality_increases_base_coherence_times`
- `tests/test_unified_environment_rates.py::test_normalized_inputs_map_monotonically_to_physical_inputs`
- `tests/test_unified_environment.py::test_device_quality_zero_uses_profile_minimum_not_maximum`

つまり「品質を上げるとコヒーレンス時間が伸びる」「磁束ノイズを増やすと位相緩和が速くなる」という**向きは確認されていますが、その量が正しいかは検証されていません**。

これらの写像はもともと物理的な導出を持たない学習用の選択であり(→[参考文献](../references.md)の「文献からは決まらない設計判断」)、許容誤差を定義できる比較対象が存在しないことが理由です。

検証V4も「磁束ノイズの校正は検証しない」、検証V2も「デバイスプロファイルは検証しない」と明記しています。
:::

これは入力モデルにおける最大の検証上の穴です。デバイス品質や磁束ノイズを変えたときの**絶対的な数値**を物理的に信頼できるものとして扱わないでください。相対的な傾向の理解に用いることが想定された機能です。
