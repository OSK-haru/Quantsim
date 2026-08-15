---
title: Pulse-levelモデル
sidebar_position: 2
---

# Pulse-levelモデル

実際の超伝導量子コンピューターでは、量子回路をトランズモンと呼ばれる人工原子に

Pulse-levelモデルは、ゲートを論理的な単位としてではなく、**時間依存の制御パルス**として扱います。パルスの包絡線、位相、離調を直接指定し、その駆動下での状態発展を計算します。

Gate-awareモデルより低いレイヤーを扱うため、漏れ(leakage)、DRAG補正、パルス形状の影響といった、論理ゲートでは表現できない現象を観察できます。

:::info[Pulse LabとCircuit Studioの関係]
Pulse-levelモデルは**単発パルスのフロー**であり、Circuit Studioで作った回路を消費しません。回路を扱うのはGate-awareモデルです。2つのモデルは現在連携していません。
:::

## 共通の前提

3つのパルスモデルはすべて次を共有します。

```text
frame          : rotating(回転系)
approximation  : RWA(回転波近似)
hardware_calibrated : false
experimental   : true
units          : μs / rad·μs⁻¹ / μs⁻¹
```

離調は「駆動周波数 − 量子ビット周波数」として定義されます。

$$
\Delta = \omega_d - \omega_{01}
$$

## 3つのモデル

| | Baseline A | Extension B | Coupled pair |
|---|---|---|---|
| model_id | `driven_two_level_rwa_experimental_v1` | `driven_transmon_qutrit_rwa_experimental_v1` | `driven_coupled_transmon_pair_rwa_experimental_v1` |
| contract | `pulse-baseline-a-v1` | `pulse-extension-b-v1` | `pulse-coupled-pair-v1` |
| 準位数 | 2 | 3 | 3⊗3 = 9 |
| 状態 | available | available | **experimental** |
| DRAG | 不可(β = 0 強制) | Gaussianのみ | Gaussianのみ・ドライブ別 |
| 準静的ノイズ | 非対応 | 対応(次数 3/5/7/9) | 対応(次数 3/5、相関あり) |
| 作業上限 | 200,000 ステップ | 25,000 ステップ | 15,000 RK4 / 500 CPTP区間 |

いずれも同一のエンドポイント `POST /api/pulse/simulate` から `model_id` による判別で利用します。

## 包絡線と振幅

### 包絡線の形状

| 形状 | 指定 |
|---|---|
| `square` | `pulse_duration_us` |
| `gaussian` | `sigma_us` と `truncation_sigma` |

Gaussianでは所要時間が次式で導出されるため、`pulse_duration_us` の指定は拒否されます。

$$
\tau_p = 2 N_{\text{trunc}}\, \sigma
$$

有限区間で打ち切ったGaussianは、無限台のGaussianではなく**打ち切り後の面積**で正規化されます。この扱いにより、打ち切り 3σ でも回転角の誤差が 0 になります(無限台の正規化を使うと $8.5\times10^{-3}$ の誤差が生じます)。

### 振幅モード

排他的に1つだけ指定します。

| モード | 必要なフィールド |
|---|---|
| `target_rotation_angle` | `target_rotation_angle_rad` |
| `peak_amplitude` | `peak_amplitude_rad_per_us` |

## Pulse Baseline A(2準位)

最も基本的なモデルです。駆動された2準位系を回転系・RWAで扱います。

散逸は $\sqrt{\gamma_\downarrow}\sigma^-$、$\sqrt{\gamma_\uparrow}\sigma^+$、$\sqrt{\gamma_\phi/2}\sigma_z$ の3つです。パルス中の散逸と、パルス後の待機区間の両方が計算されます。

環境入力は `physical` と `direct_rates` の2モードです。

ステップ方針 `pulse_baseline_a_step_policy_v1`:

$$
h \cdot G_H \le 0.05, \qquad h \cdot G_D \le 0.05, \qquad \frac{h}{\sigma} \le \frac{1}{20}
$$

**制限**: 2準位のみで漏れを表現しない、RWAのみ、マルコフ的Lindbladのみ、DRAG・伝達関数・クロストーク・多量子ビットパルス制御は非対応。

## Pulse Extension B(qutrit)

第3準位を含めることで、漏れとDRAG補正を扱えます。

Duffing型のトランズモンとして、非調和性 $\alpha$ を持ちます。

$$
\alpha_{[\mathrm{rad/\mu s}]} = 2\pi\, \alpha_{[\mathrm{MHz}]},
\qquad
f_{12} = f_{01} + \frac{\alpha}{1000}
$$

散逸は遷移ごとに指定でき、位相緩和は数演算子形式 $\sqrt{2\gamma_{\phi,\text{adj}}}\,\hat{n}$ を用います。これにより $\rho_{01} : \rho_{12} : \rho_{02}$ の減衰比が 1 : 1 : 4 に固定されます。

### DRAG制御

Gaussian包絡線に対して、微分成分を直交クアドラチャに加えることで漏れを抑制します。

$$
\Omega_y(t) = -\beta \frac{d\Omega_x(t)}{dt}
$$

検証B-4での効果($\beta = 0.001\ \mu\mathrm{s}$、π パルス):

| 指標 | β = 0 | β = 0.001 |
|---|---|---|
| パルス終端の漏れ | 0.260634 | **0.022695** |
| 目標忠実度 | 0.647631 | **0.936293** |

ステップ方針 `qutrit_fixed_rk4_v1` は Baseline A より厳しく、$\varepsilon_H = \varepsilon_D = 0.02$、σ あたり 32 サンプルです。

**制限**: 単一qutritのみ、3準位切り詰め、RWAのみ、準静的Gaussian離調が唯一の非マルコフ的ノイズ、**固定ステップRK4は厳密な有限ステップCPTP積分ではない**。

## Coupled transmon pair(結合2トランズモン)

2つのqutritを交換結合で繋いだ9次元系です。

$$
H = H_0^{(0)} + H_0^{(1)} + J\left(a_0^\dagger a_1 + a_0 a_1^\dagger\right)
$$

各トランズモンに独立したドライブを与えられ、DRAGもドライブごとに設定できます。ステップ方針には結合由来の制限 $h \le 0.02/(4J)$ が加わります。

:::warning[環境プロファイルの共有]
実装では**両方のトランズモンが単一のレートプロファイルを共有**します(`rates = (rate, rate)`)。個別のコヒーレンス時間を持つ非対称なペアは表現できません。この制限はAPIレスポンスの警告としてクライアントにも通知されます。
:::

**制限**: 厳密に N = 2、交換結合とRWAのみ、クロストーク・可変結合器・校正は非対応。

## 準静的ノイズ

ショットごとに固定され、1ショット内では変化しないGaussian離調のゆらぎを扱います。

$$
H(t;\delta) = H_0(t) - (\Delta + \delta)\,\hat{n},
\qquad
\delta \sim \mathcal{N}(0, \sigma_\omega^2)
$$

モンテカルロサンプリングではなく、**決定論的なGauss-Hermite求積**で評価されます(次数 3/5/7/9)。結合ペアではCholesky分解による相関付き2変量版が使えます(次数 3/5)。

純度はアンサンブル平均後の密度行列から $\operatorname{Tr}(\bar\rho^2)$ として計算されます(各サンプルの純度の平均ではありません)。

## 実行時の制約

APIは同時に最大2つのパルスジョブを実行します。

| ステータス | 意味 |
|---|---|
| 422 | スキーマ・タイミング・モード・作業量の拒否 |
| 503 | 実行スロットが両方とも使用中 |
| 504 | 15秒の待機タイムアウトを超過 |

作業量が上限を超える要求は、数値計算の**実行前**に 422 で拒否されます。

## 検証状況

3モデルすべてがQuTiP 5.2.3との独立比較を通過しています。

| モデル | ケース数 | 許容誤差 | 最大誤差 | 判定 |
|---|---|---|---|---|
| Baseline A | 6 | $5\times10^{-7}$ | $6.61\times10^{-8}$ | PASS |
| Extension B | 8 | $5\times10^{-7}$ | $5.03\times10^{-10}$ | PASS WITH RESTRICTIONS |
| Coupled pair | 7(93チェックポイント) | $2\times10^{-6}$〜$2\times10^{-5}$ | $1.51\times10^{-7}$ | PASS |

詳細は[制御モデルの検証](../validations/control-models.md)を参照してください。
