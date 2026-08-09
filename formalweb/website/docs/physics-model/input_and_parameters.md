---
title: 入力とパラメータ
sidebar_position: 3
---

# 入力とパラメータ

Yuragi-Striderは環境の記述に統一環境モデル `generic_superconducting_open_system_v1` を用います。入力は2つのモードのいずれかで与えられ、どちらも最終的には同じ物理レートの組に変換されます。

## 入力モード

| モード | 想定利用者 | 内容 |
|---|---|---|
| `normalized` | 初学者向け | 0〜1の抽象的な3つのつまみ |
| `physical` | 専門的な利用 | 物理単位を持つ6つのパラメータ |

現在のReactフロントエンドは `physical` モードで送信します。`normalized` モードは互換性のために維持されています。

## physical モードの入力

| フィールド | 単位 | 制約 | 既定値 |
|---|---|---|---|
| `device_quality` | — | $0 \le q \le 1$ | 0.5 |
| `temperature_mk` | mK | $\ge 0$、有限 | 15.0 |
| `flux_noise_phi0` | $\Phi_0$ | $\ge 0$、有限 | $10^{-6}$ |
| `qubit_frequency_ghz` | GHz | $> 0$ | 5.0 |
| `t1_max_us` | μs | $> 0$ | 100.0 |
| `tphi_max_us` | μs | $> 0$ | 100.0 |
| `ideal_reference` | — | 真偽値 | false |

`physical` モードでは上記6つの数値パラメータすべてが必須です。

## normalized モードの入力

`temperature`、`magnetic_field`、`noise_level` の3つを $[0,1]$ で与えます。内部では次の写像で物理入力に変換されます。

$$
q = 1 - (\text{noise\_level})
$$

$$
T[\mathrm{mK}] = 10 + 90 \times (\text{temperature})
$$

$$
\Phi_{\text{noise}} = \Phi_{\min}\left(\frac{\Phi_{\max}}{\Phi_{\min}}\right)^{(\text{magnetic\_field})}
$$

磁束ノイズのみ対数補間である点に注意してください。$\Phi_{\min} = 10^{-6}$、$\Phi_{\max} = 10^{-5}$ です。

なお `magnetic_field` は歴史的な名称で、実際には**正規化された磁束ノイズ強度**として解釈されます。

## デバイスプロファイル

物理入力の解釈には、一般的なトランズモンを模したプロファイルを用います。これは校正済みのハードウェアモデルではありません。

```text
qubit_frequency_ghz                 : 5.0
anharmonicity_mhz                   : -250.0
t1_min_us  / t1_max_us              : 1.0 / 100.0
tphi_min_us / tphi_max_us           : 1.0 / 100.0
default_temperature_mk              : 15.0
flux_noise_min_phi0 / max_phi0      : 1e-6 / 1e-5
flux_noise_gamma_phi_per_us_at_max  : 0.05
```

## レートへの変換

### デバイス品質 → 基準コヒーレンス時間

デバイス品質は、プロファイルの下限と上限のあいだの**幾何補間**として作用します。

$$
T_1^{\text{base}} = T_1^{\min}\left(\frac{T_1^{\max}}{T_1^{\min}}\right)^{q},
\qquad
T_\phi^{\text{base}} = T_\phi^{\min}\left(\frac{T_\phi^{\max}}{T_\phi^{\min}}\right)^{q}
$$

`t1_max_us` と `tphi_max_us` はこの式の**上限のみ**を置き換えます。下限は $1.0\ \mu\mathrm{s}$ に固定されているため、上限を大きくしても低品質デバイスが理想的になることはありません。

### 温度 → 熱占有数

$$
n_{\text{th}} = \frac{1}{\exp\!\left(\dfrac{h f_q}{k_B T}\right) - 1}
$$

分母には数値安定性のため `expm1` を用いています。また次の安全分岐があります。

- $T \le 0$ または $f_q \le 0$ のとき $n_{\text{th}} = 0$
- 指数部が 700 を超えるとき $n_{\text{th}} = 0$(アンダーフロー回避)

この式は**角周波数 $\omega_q$ ではなく通常の周波数 $f_q$** を用いる規約です。

### 緩和・熱励起レート

$$
\gamma_0 = \frac{1}{T_1^{\text{base}}},
\qquad
\gamma_\downarrow = \gamma_0 (1 + n_{\text{th}}),
\qquad
\gamma_\uparrow = \gamma_0\, n_{\text{th}}
$$

この構成により、詳細釣り合い $\gamma_\uparrow/\gamma_\downarrow = \exp(-hf_q/k_BT)$ が自動的に満たされます。

### 位相緩和レート

$$
\gamma_\phi = \gamma_\phi^{\text{base}} + \gamma_\phi^{\text{flux}},
\qquad
\gamma_\phi^{\text{base}} = \frac{1}{T_\phi^{\text{base}}},
\qquad
\gamma_\phi^{\text{flux}} = 0.05 \times \frac{\Phi_{\text{noise}}}{\Phi_{\max}}
$$

:::warning[磁束ノイズの外挿について]
$\Phi_{\text{noise}}/\Phi_{\max}$ の比には**上限のクランプがありません**。`flux_noise_phi0` が $\Phi_{\max} = 10^{-5}$ を超える値を指定した場合、線形に外挿されます。プロファイルが想定する範囲を超えた領域の結果は物理的な裏付けを持ちません。
:::

### 実効時間

$$
\gamma_{\text{pop}} = \gamma_\downarrow + \gamma_\uparrow,
\qquad
T_1^{\text{eff}} = \frac{1}{\gamma_{\text{pop}}},
\qquad
T_\phi^{\text{eff}} = \frac{1}{\gamma_\phi},
\qquad
T_2^{\text{eff}} = \frac{1}{\tfrac{1}{2}\gamma_{\text{pop}} + \gamma_\phi}
$$

## 理想参照モード

`ideal_reference: true` を指定すると、すべてのレートが 0、すべての実効時間が無限大になります。ノイズのない理想的な回路動作との比較に用います。

## レート変数の命名規約

正準の名称は次のとおりです。

| 変数 | 意味 |
|---|---|
| `gamma0_per_us` | $1/T_1^{\text{base}}$ |
| `gamma_down_per_us` | $\gamma_\downarrow$(下向き遷移) |
| `gamma_up_per_us` | $\gamma_\uparrow$(熱励起) |
| `gamma_phi_per_us` | $\gamma_\phi$(合計位相緩和) |
| `gamma_population_relaxation_per_us` | $\gamma_\downarrow + \gamma_\uparrow$ |
| `n_th` | 熱占有数 |
| `t1_effective_us` / `t2_effective_us` / `tphi_effective_us` | 実効時間 |

:::note[非推奨のエイリアス]
`gamma1_per_us` は `gamma_down_per_us` の読み取り専用エイリアスとして残っていますが、**合計の $1/T_1$ ではありません**。混同を避けるため新規の利用では正準名を使ってください。ほかに `gammaphi_per_us`、`t1_base_us`、`tphi_base_us`、`gamma_phi_total_per_us`、`t1_us`、`t2_us` も非推奨です。
:::

## 検証状況

この入力モデルの妥当性検証については[入力モデルの検証](./validations/input.md)を参照してください。温度まわり(熱占有数・詳細釣り合い・有限温度平衡)は独立な解析式との比較で検証されていますが、**デバイス品質と磁束ノイズの写像には専用の検証ドキュメントが存在しません**。
