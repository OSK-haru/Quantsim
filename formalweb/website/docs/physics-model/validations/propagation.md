---
title: 時間発展の検証
sidebar_position: 3
---

# 時間発展の検証

RK4・明示的CPTP・状態ベクトルの各時間発展経路が、解析解および独立ソルバーと一致することを検証します。

## V1: ゼロ散逸のユニタリ極限

### 比較対象と条件

散逸をすべて 0 にした場合、発展は純粋なユニタリ変換になります。**有効ハミルトニアンも積分器も使わず**、独立に構成した $\rho \leftarrow U_{\text{col}}\,\rho\,U_{\text{col}}^\dagger$ と比較します。

```text
ideal_reference = True(3レートすべて 0、崩壊演算子リスト空)
待機時間 0、時間ステップ 101
ゲート所要時間: H / X / Z = 0.20 μs、CNOT = 0.40 μs
基底順: q0 が最上位ビット
```

8ケース: 1量子ビットX / 1量子ビットH / H+Zの位相感度 / 2量子ビットBell / 3量子ビットGHZ / 4量子ビット基底順 / 2量子ビット同列積 / 4量子ビット同列2重CNOT

### 許容誤差

```text
max_element        : 1e-8
frobenius          : 1e-8
trace_distance     : 1e-8
one_minus_fidelity : 1e-8
trace              : 1e-10
hermiticity        : 1e-10
```

### 実測値

```text
最大要素誤差       : ≤ 1.11e-16
Frobenius誤差      : ≤ 2.22e-16
トレース距離       : ≤ 1.11e-16
Fidelity           : 1.000000000000
トレース誤差       : 0.0
```

**8/8 PASS**。時間ステップを 11 / 51 / 101 に変えても差は **0.0** でした。

### 制限事項

:::note ステップ非依存性の解釈
11 / 51 / 101 ステップで結果が完全に一致するのは、ゼロ散逸条件下でのサブステップ方針に由来する性質です。**有限レート下での収束性を保証するものではありません**。収束性は V6 で別途検証されています。
:::

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_zero_dissipation_unitary_limit.py
```

アーティファクト: `validation_results/validation1_zero_dissipation.json` / `.csv`

---

## V3 / V4: 単一チャネルの解析解比較

### V3: 励起状態の指数減衰

$|1\rangle$ から出発し、ハミルトニアン 0、$\gamma_\uparrow = \gamma_\phi = 0$ の条件で $e^{-\gamma_\downarrow t}$ と比較します。

| $\gamma_\downarrow$ | 最大誤差 | フィット相対誤差 |
|---|---|---|
| 0.010 | 1.923961e-12 | 5.230191e-12 |
| 0.050 | 1.222742e-09 | 3.323757e-09 |
| 0.100 | 1.997610e-08 | 5.430066e-08 |

許容誤差 `max_abs_error_p1 = 1e-6`、`rmse = 1e-7`。内部ステップ監査(0.5 → 0.25 μs)の差 1.804279e-12。**PASS**

### V4: 純位相緩和

$|+\rangle$ から出発し、$\rho_{01}(t) = \rho_{01}(0)e^{-\gamma_\phi t}$ と比較します。

| $\gamma_\phi$ | 最大誤差 |
|---|---|
| 0.010 | 9.620638e-13 |
| 0.050 | 6.113710e-10 |
| 0.100 | 9.988049e-09 |

:::info 係数規約の判別診断
V4は、崩壊演算子が $\sqrt{\gamma_\phi/2}\,\sigma_z$ であって $\sqrt{\gamma_\phi}\,\sigma_z$ ではないことを積極的に判別します。

誤った規約を仮定した曲線との最大誤差は **0.11932561**、最小の非ゼロ時刻での差でも **3.346274e-03** でした。正しい規約との誤差(1e-9 オーダー)と8桁以上離れており、規約の取り違えは検出可能です。
:::

**PASS**

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_excited_state_exponential_decay.py
.\.venv\Scripts\python.exe scripts\validate_pure_dephasing.py
```

---

## V6: 時間ステップ収束

### 比較対象と条件

内部最大ステップを **1.0 μs から 0.0625 μs** まで細かくし、収束を確認します。参照は解析解(V6-1〜V6-3)および 0.03125 μs の細解(V6-4、V6-5)です。

### 許容誤差

```text
analytic_fine_max_error : 1e-8
gate_0_125_max_error    : 1e-7
gate_0_0625_max_error   : 1e-8
physicality             : 1e-10
backend                 : 1e-10
```

### 実測値

| ケース | 最大誤差 |
|---|---|
| V6-1 | 2.929879e-13 |
| V6-2 | 1.466327e-13 |
| V6-3 | 1.494360e-13 |
| V6-4 | 2.549706e-09 |
| V6-5 | 1.351919e-09 |

補足:

- スナップショット格子非依存性(0.125 μs 固定): **0.0**
- バックエンド一致: 1量子ビット 1.110223e-16、2量子ビット 5.551115e-17

### 判定と制限

**PASS**(`overall_pass: true`)

:::warning 重要な制限
V6は「**すべての有限RK4ステップがCPTP写像であることの一般的な証明にはならない**」と明記しています。収束することと、各ステップが物理的な写像であることは別問題です。
:::

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_time_step_convergence.py
```

---

## V7: Gate-awareモデルのQuTiP比較

### 比較対象と条件

同一の初期状態 $\rho(0)$、ハミルトニアン行列、崩壊演算子、区間長、出力時刻をQuTiPに渡して比較します。

:::info 比較の独立性
アダプタはYuragi-Striderの行列を**そのままQobjに変換**します。QuTiPのスピン演算子を使って系を組み直すことはしません。これにより「同じ物理を2つの独立した積分器で解く」比較になります。
:::

```text
Yuragi-Strider 内部RK4上限 : 0.03125 μs
QuTiP mesolve           : method=dop853, atol=1e-12, rtol=1e-12,
                          nsteps=100000, max_step_us=0.015625,
                          normalize_output=False, store_states=True
```

### 許容誤差と実測値

| ケース | 内容 | 許容誤差 | 最大要素誤差 | 最大トレース距離 |
|---|---|---|---|---|
| V7-1 | 下向き緩和 | 1e-8 | 2.934875e-13 | 2.934597e-13 |
| V7-2 | 純位相緩和 | 1e-8 | 1.469380e-13 | 1.469380e-13 |
| V7-3 | 有限温度緩和 | 1e-8 | 1.499911e-13 | 1.494638e-13 |
| V7-0 | ユニタリHゲート | 1e-8 | 2.099189e-10 | 2.099244e-10 |
| V7-4 | 駆動1量子ビットHゲート | 1e-7 | 1.696213e-10 | 1.725252e-10 |
| V7-5 | **2量子ビットBell回路** | 2e-7 | 1.649723e-10 | 1.754019e-10 |
| V7-6 | 物理入力由来のレート | 1e-7 | 2.220446e-15 | 1.417981e-15 |

すべて許容誤差を3桁以上下回っています。

### 判定

**PASS**(`overall_pass: true`)

### 実行環境

```text
python 3.14.4 / qutip 5.2.3 / numpy 2.4.4 / scipy 1.17.1
Windows-11-10.0.26200-SP0
```

### 再現方法

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-validation.txt
.\.venv\Scripts\python.exe scripts\validate_qutip_comparison.py
.\.venv\Scripts\python.exe -m unittest tests.test_validation_qutip_comparison
```

アーティファクト: `validation_results/validation7_qutip_comparison.json` / `.csv` / `.png`

---

## C8: 明示的CPTP と RK4 の比較

### 条件

3ケース × 3ステップ幅 × 2バックエンド(Python / Rust)= 18行。格子を揃え、物理性許容 1e-10。**実行速度は合格基準に含めません。**

### 実測値

トレース距離(ステップを細かくするほど収束):

| ケース | 粗 → 細 |
|---|---|
| `constant_qubit_open_system`(0.2 / 0.1 / 0.05 μs) | 3.970104e-07 → 2.451682e-08 → 1.523087e-09 |
| `two_level_gaussian_open_system`(0.04 / 0.02 / 0.01 μs) | 2.696749e-04 → 4.886788e-05 → 1.222232e-05 |
| `constant_qutrit_open_system`(2e-4 / 1e-4 / 5e-5 μs) | 8.025548e-08 → 5.018991e-09 → 3.137400e-10 |

CPTP側の健全性:

```text
最大トレース誤差    : 4.551914e-14
最小状態固有値      : 1.1419145e-03
最小Choi固有値      : 1.3355421e-09
最大TP誤差          : 7.777271e-14
```

**`all_cases_pass: true`**

### 除外された発散ケース

:::danger RK4は粗いステップで破綻する
合格判定から除外された意図的なストレスケース `qutrit_drag_intentionally_coarse_step`(ステップ 0.006 μs、非調和性 −215 MHz)の結果:

| 指標 | Python | Rust |
|---|---|---|
| トレース距離 | 9.68e+19 | 2.99e+20 |
| RK4 整形前の最小固有値 | **−3.02e+22** | **−1.51e+23** |
| CPTP 最小固有値 | 9.911845e-02 | 9.911845e-02 |

同じ条件で明示的CPTPは物理的な状態を保ちました。この対比は、**密度行列の整形(cleanup)が発散したRK4を救済しない**ことを示しています。整形はあくまで丸め誤差の吸収です。
:::

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\compare_rk4_cptp.py
```

アーティファクト: `validation_results/cptp_rk4_comparison.json`

---

## Phase 3A: 明示的CPTP の QuTiP 比較

### 事前登録された合格条件

比較の前に条件を確定させる(preregistration)方式を採っています。

```text
物理性許容                    : 1e-10
Python / Rust 一致許容        : 2e-10
単調性のスラック              : 1e-12
必要バックエンド              : python かつ rust
区間サイズ                    : ケースごとに3種を事前登録
比較点                        : すべての区間境界
QuTiP 最大ステップ            : CPTP区間 / 8
最終ステップのトレース距離上限 :
  two_level_gaussian_open_pulse : 5e-5
  qutrit_drag_open_pulse        : 2e-4
```

### 実測値(12行)

| ケース | 区間幅 | 区間数 | トレース距離 |
|---|---|---|---|
| two_level | 0.01 μs | 24 | 3.998035e-04 |
| two_level | 0.005 μs | 48 | 9.973294e-05 |
| two_level | 0.0025 μs | 96 | **2.491969e-05** |
| qutrit DRAG | 2e-4 μs | 80 | 1.379126e-04 |
| qutrit DRAG | 1e-4 μs | 160 | 3.445576e-05 |
| qutrit DRAG | 5e-5 μs | 320 | **8.613462e-06** |

Python と Rust の結果は数値的に同一。一致誤差は two_level 1.776362e-15、qutrit 3.775414e-15。

### 判定

**PASS**(`decision: PASS`、`overall_pass: true`、`rust_requirement_pass: true`)

### 制限事項

ハードウェア校正を検証しない。Gate-aware実行へのCPTP追加を確立しない(これは後続の凍結で別途確立)。

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\validate_cptp_qutip_comparison.py
```

アーティファクト: `validation_results/cptp_qutip_comparison.json` / `.csv`

---

## 明示的CPTPモデルの凍結

```text
freeze_id : yuragi_strider_explicit_cptp_v1
method    : explicit_cptp_midpoint_gksl_v1
判定       : PASS WITH RESTRICTIONS
commit    : f306fbf6eb2083d9098ab0ade079e2681920ac4e
```

凍結された契約:

```text
Choi規約   : unnormalized_input_output_row_major_v1(Tr(J) = d、input ⊗ output)
CP / TP許容 : 1e-12 / 1e-12
ベクトル化 : column_major_vec_f_v1
行列指数   : scaling_squaring_pade13_numpy_v1 / _rust_v1
時間依存性 : midpoint_piecewise_constant_v1
単位       : μs / rad·μs⁻¹ / sqrt(1/μs) / 1/μs
整形       : 適用しない
```

29個のソースファイルのハッシュを含むマニフェストが記録されています(`critical_source_tree_sha256 = 9db9a192...`)。

凍結時に明記された制限のうち「Phase 3 の CPTP→QuTiP 監査が未完了」は、上記 Phase 3A により解消済みです。

### 再現方法

```powershell
.\.venv\Scripts\python.exe scripts\freeze_cptp_model.py
```

アーティファクト: `validation_results/cptp_model_freeze.json`

---

## 数値健全性チェック

すべてのシミュレーション結果に対する基本的な検査です。

- NaN / inf が存在しないこと
- Fidelity と Purity が $[0,1]$ に収まること
- 出力確率の和が 1 になること
- トレースが 1 に近いこと
- Hermite性の破れが小さいこと
- 最小固有値が大きく負に振れないこと

:::note
この検査は「**研究グレードのシミュレーション精度を保証するものではない**」と明示されています。あくまで明白な破綻の検出用です。
:::
