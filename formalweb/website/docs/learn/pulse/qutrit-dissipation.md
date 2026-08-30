---
title: P4. 多準位系の散逸
sidebar_position: 5
---

# P4. 多準位系の散逸

:::info[このページで学ぶこと]
- 2準位の崩壊演算子を3準位へ持ち上げるときの選択肢
- 遷移ごとに別々のレートを持つ理由と、$\gamma_{21} = 2\gamma_{10}$ の由来
- 遷移ごとに熱占有数が違うこと($f_{12} < f_{01}$ の帰結)
- 数演算子形式の位相緩和 $L_\phi = \sqrt{2\gamma_{\phi,\text{adj}}}\,\hat n$ の導出
- 減衰比 $1:1:4$ がどこから来るか
- なぜ $\sigma_z$ ではなく $\hat n$ を使うのか

**前提**: [第4章](../decoherence.md)、[P1](./transmon.md)
:::

## P4.1 2準位の散逸をそのまま持ち上げられるか

[第4章](../decoherence.md)で見た2準位の崩壊演算子は3つでした。

$$
L_\downarrow = \sqrt{\gamma_\downarrow}\,\sigma^-,
\qquad
L_\uparrow = \sqrt{\gamma_\uparrow}\,\sigma^+,
\qquad
L_\phi = \sqrt{\frac{\gamma_\phi}{2}}\,\sigma_z
$$

これを3準位へ拡張しようとすると、両方の種類で選択を迫られます。

| 演算子 | 3準位での問題 |
|---|---|
| $\sigma^\pm$ | $0\leftrightarrow1$ と $1\leftrightarrow2$ は**別の遷移**。同じレートでよいか? |
| $\sigma_z$ | 3準位で「$\sigma_z$ の自然な拡張」は一意でない |

前者はP4.2〜P4.3、後者はP4.4で扱います。

## P4.2 遷移ごとの緩和

3準位系のエネルギー緩和は、はしごを1段ずつ降りる過程です。

```text
|2⟩ ──┐  γ21↓  ▲ γ12↑
      ▼        │
|1⟩ ──┐  γ10↓  ▲ γ01↑
      ▼        │
|0⟩ ──┘
```

崩壊演算子は4つになります。

$$
\sqrt{\gamma_{10}}\,|0\rangle\langle1|,
\quad
\sqrt{\gamma_{01}}\,|1\rangle\langle0|,
\quad
\sqrt{\gamma_{21}}\,|1\rangle\langle2|,
\quad
\sqrt{\gamma_{12}}\,|2\rangle\langle1|
$$

:::note[$0\leftrightarrow2$ の直接遷移はない]
$|2\rangle\to|0\rangle$ を直接つなぐ崩壊演算子は構成しません。トランズモンの駆動・散逸はどちらも $\hat a$ に比例し、$\hat a$ は隣接準位しか繋がないためです。$|2\rangle$ から $|0\rangle$ へは $|1\rangle$ を経由します。
:::

### $\gamma_{21} = 2\gamma_{10}$ の由来

絶対零度での緩和レートは、遷移の行列要素の2乗に比例します。トランズモンの結合は $\hat a$ に比例するので

$$
\gamma_{n,n-1} \ \propto\ \big\lvert\langle n{-}1|\hat a|n\rangle\big\rvert^2 = n
$$

したがって

$$
\frac{\gamma_{21}(T{=}0)}{\gamma_{10}(T{=}0)} = \frac{2}{1} = 2
$$

**$|2\rangle$ は $|1\rangle$ の2倍の速さで崩れます。** これは[第6章](../pulse-control.md) 6.8節で見た駆動の $\sqrt2$ と同じ起源(調和振動子のはしご行列要素)です。駆動されやすい準位は、環境からも壊されやすい。

:::warning[これは教育用の近似です]
実際のトランズモンでは、$T_1$ が何で制限されているか(誘電損失、二準位欠陥、準粒子、放射)によって $n$ 依存性は変わります。調和振動子の行列要素だけで決まるとは限りません。

Yuragi-Striderは `physical` モードでこの $2:1$ の関係を使いますが、これは**文献から導出された値ではなく学習用の選択**です。`direct_rates` モードを使えば4つのレートを独立に指定できます。
:::

## P4.3 遷移ごとに温度が違って見える

もう1つ、2準位から素直には出てこない効果があります。

熱占有数は遷移周波数に依存しました([第4章](../decoherence.md) 4.3節)。

$$
n_{\text{th}} = \frac{1}{\exp\!\left(hf/k_BT\right) - 1}
$$

そして $|1\rangle\to|2\rangle$ の遷移周波数は $|0\rangle\to|1\rangle$ より $|\alpha|$ だけ**低い**のでした([P1](./transmon.md))。

$$
f_{12} = f_{01} + \frac{\alpha_{[\mathrm{MHz}]}}{1000}\ [\mathrm{GHz}]
\qquad(\alpha < 0)
$$

$f$ が低いほど $hf/k_BT$ が小さくなり、$n_{\text{th}}$ は**大きく**なります。

$$
f_{12} < f_{01}
\quad\Longrightarrow\quad
n_{12} > n_{01}
$$

**$1\leftrightarrow2$ 遷移のほうが「熱い」** ということです。これを反映して、実装は遷移ごとに別々の熱占有数を持ちます。

$$
\gamma_{21} = \gamma_{21}^{(0)}\left(1 + n_{12}\right),
\qquad
\gamma_{12} = \gamma_{21}^{(0)}\,n_{12}
$$

$$
\gamma_{10} = \gamma_{10}^{(0)}\left(1 + n_{01}\right),
\qquad
\gamma_{01} = \gamma_{10}^{(0)}\,n_{01}
$$

各遷移が独立に詳細釣り合いを満たします。検証B-2では、この釣り合いが最大誤差 $5.55\times10^{-17}$ で成立することが確認されています。

### 数値感覚

$f_{01} = 5.0$ GHz、$\alpha = -250$ MHz なので $f_{12} = 4.75$ GHz です。$T = 15$ mK では

$$
\frac{hf_{01}}{k_B} = 240\ \mathrm{mK},
\qquad
\frac{hf_{12}}{k_B} = 228\ \mathrm{mK}
$$

$$
n_{01} \approx e^{-16.0} \approx 1.1\times10^{-7},
\qquad
n_{12} \approx e^{-15.2} \approx 2.5\times10^{-7}
$$

倍以上の差がありますが、どちらも $10^{-7}$ 級なので実用上の影響はほとんどありません。**この効果が効くのは高温側です。**

## P4.4 位相緩和 — なぜ $\hat n$ なのか

ここが3準位化で最も本質的な選択です。

2準位では $L_\phi \propto \sigma_z$ でした。しかし3準位で「$\sigma_z$ に相当するもの」は一意ではありません。$\operatorname{diag}(1,-1,0)$ か、$\operatorname{diag}(1,0,-1)$ か、Gell-Mann行列の組み合わせか。数学的にはどれも可能です。

**答えは、物理的な機構に戻ることで決まります。**

[第4章](../decoherence.md) 4.5節で見たとおり、純位相緩和は**遷移周波数のゆらぎ**から生じます。トランズモンの周波数がゆらぐと、準位 $n$ のエネルギーは

$$
\delta E_n = n\,\delta\omega
$$

だけ動きます($E_n \approx n\omega_{01} + \cdots$ の $\omega_{01}$ が揺れる)。つまり**ゆらぎは数演算子 $\hat n$ に結合します**。

$$
H_{\text{noise}}(t) = \delta\omega(t)\,\hat n
$$

したがって崩壊演算子も $\hat n$ に比例すべきです。Yuragi-Striderの規約は

$$
\boxed{\ L_\phi = \sqrt{2\gamma_{\phi,\text{adj}}}\;\hat n,
\qquad
\hat n = \operatorname{diag}(0, 1, 2)\ }
$$

モデル識別子は `number_operator_adjacent_rate_v1` です。

### 減衰比 $1:1:4$ の導出

この形が何を予言するかを計算します。$L = \sqrt{2\gamma}\,\hat n$ とおいて散逸子の $(j,k)$ 成分を求めます。$\hat n$ は対角なので簡単です。

**ジャンプ項**:
$$
\big(L\rho L^\dagger\big)_{jk} = 2\gamma\,j\,k\,\rho_{jk}
$$

**no-jump項**: $L^\dagger L = 2\gamma\,\hat n^2$ なので
$$
\left(\tfrac{1}{2}\{L^\dagger L, \rho\}\right)_{jk}
= \gamma\left(j^2 + k^2\right)\rho_{jk}
$$

合わせると

$$
\frac{d\rho_{jk}}{dt}
= 2\gamma jk\,\rho_{jk} - \gamma(j^2+k^2)\rho_{jk}
= -\gamma\,(j-k)^2\,\rho_{jk}
$$

$$
\boxed{\ \rho_{jk}(t) = \rho_{jk}(0)\,e^{-\gamma_{\phi,\text{adj}}(j-k)^2 t}\ }
$$

準位差の**2乗**で減衰率が決まります。

| コヒーレンス | $(j-k)^2$ | 減衰率 |
|---|---|---|
| $\rho_{01}$ | 1 | $\gamma_{\phi,\text{adj}}$ |
| $\rho_{12}$ | 1 | $\gamma_{\phi,\text{adj}}$ |
| $\rho_{02}$ | 4 | $4\gamma_{\phi,\text{adj}}$ |

$$
\rho_{01} : \rho_{12} : \rho_{02} \ =\ 1 : 1 : 4
$$

:::tip[$1:1:4$ の物理的意味]
$\rho_{02}$ は「2量子分のエネルギー差」を跨ぐコヒーレンスです。周波数が $\delta\omega$ 揺れると、$\rho_{01}$ の蓄積位相は $\delta\omega\,t$ ですが、$\rho_{02}$ は $2\delta\omega\,t$ です。

位相の分散が $4$ 倍になり、減衰率 $\propto \langle\phi^2\rangle$ も $4$ 倍になります。**「離れた準位間のコヒーレンスほど壊れやすい」** という一般的な性質の、最も単純な現れ方です。
:::

### 係数 $\sqrt{2\gamma_{\phi,\text{adj}}}$ の意味

なぜ $\sqrt{\gamma}$ でも $\sqrt{\gamma/2}$ でもなく $\sqrt{2\gamma}$ なのか。導出から明らかです。この係数のおかげで

$$
\text{隣接準位のコヒーレンス減衰率} = \gamma_{\phi,\text{adj}}
$$

がちょうど成り立ちます。$\gamma_{\phi,\text{adj}}$ という名前(adjacent = 隣接)は、この定義を宣言したものです。

:::warning[2準位の $\sqrt{\gamma_\phi/2}\,\sigma_z$ との関係]
2準位に落としたときの整合性を確認しておきます。$\hat n = \operatorname{diag}(0,1)$ と $\sigma_z = \operatorname{diag}(1,-1)$ は $\hat n = (I - \sigma_z)/2$ の関係にあります。恒等演算子は散逸子に寄与しないので

$$
\sqrt{2\gamma}\,\hat n \ \longleftrightarrow\ \sqrt{2\gamma}\cdot\left(-\frac{\sigma_z}{2}\right) = -\sqrt{\frac{\gamma}{2}}\,\sigma_z
$$

符号は散逸子に効かないので、**$\sqrt{\gamma_\phi/2}\,\sigma_z$ と一致します**。2つの規約は矛盾していません。

規約が違って見える形で書かれていても、同じ物理を指しているかは必ず計算で確かめてください。
:::

## P4.5 このモデルが表現しないもの

| 表現しないもの | 内容 |
|---|---|
| 準位ごとに独立な $T_\phi$ | $\hat n$ 形は $1:1:4$ を**固定**する。実測がこの比から外れても合わせられない |
| 非マルコフ的な位相緩和 | 定数レートのみ。[P5](./quasi-static-noise.md)の準静的ノイズが別枠 |
| $0\leftrightarrow2$ の直接緩和 | 構成しない |
| 準粒子・二準位欠陥の個別モデル | すべて実効レートに押し込む |
| 相関ノイズ | 各遷移が独立と仮定 |

:::note[$1:1:4$ は予言であって入力ではない]
このモデルでは $\gamma_{\phi,\text{adj}}$ という**1つの数**を与えると、3つのコヒーレンスの減衰がすべて決まります。自由度を1つに絞っているぶん、モデルは強い予言をしていることになります。

実機の測定値が $1:1:4$ から外れていた場合、それは「パラメータが合っていない」のではなく「モデルの形が合っていない」ことを意味します。**モデルの構造そのものが検証対象になる**という良い例です。
:::

## P4.6 漏れと散逸の相互作用

[P3](./leakage-drag.md)で見た漏れは、散逸と組み合わさると独特の振る舞いをします。

$|2\rangle$ に漏れた population は、$\gamma_{21} = 2\gamma_{10}$ という**速い**レートで $|1\rangle$ へ落ちます。表面的には「$|2\rangle$ から消えた」ので漏れの指標は下がりますが、落ちた先は $|1\rangle$ であって、狙った状態とは限りません。

```text
狙い:      |0⟩ ──πパルス──▶ |1⟩
実際:      |0⟩ ──πパルス──▶ 0.74|1⟩ + 0.26|2⟩
                              │ γ21 で緩和
                              ▼
                            |1⟩ (位相情報は失われている)
```

**漏れが「自然に治る」ように見えても、それは誤りが別の形に化けただけです。** $|2\rangle$ を経由した population は、$|1\rangle$ に戻った時点でコヒーレンスを失っています。

だからこそ、漏れの指標は緩和と切り離して測る必要があります([第9章](../metrics.md) 9.8節)。

## 実装ではどうなっているか

- qutritの遷移別レート、数演算子形式、$1:1:4$、検証B-2: [散逸モデル](../../physics-model/dissipation-model.md)
- 環境入力モード(`physical` / `direct_rates`): [Pulse-levelモデル](../../physics-model/control_models/pulse-levelmodel.md)

## 演習

1. $L = \sqrt{2\gamma}\,\hat n$ について $\frac{d\rho_{02}}{dt} = -4\gamma\rho_{02}$ を、P4.4 の手順を自分でたどって示せ。

2. $\hat n = \operatorname{diag}(0,1,2)$ に対して、$\hat n$ の代わりに $\hat n - I$(つまり $\operatorname{diag}(-1,0,1)$)を使うと減衰比はどうなるか。$1:1:4$ は変わるか。この結果は何を意味するか。

3. 対角成分 $\rho_{jj}$ が $\hat n$ 形の位相緩和で変化しないことを、$(j-k)^2 = 0$ から示せ。

4. $f_{01} = 5.0$ GHz、$\alpha = -300$ MHz、$T = 100$ mK のときの $n_{01}$ と $n_{12}$ を計算し、比を求めよ。$T = 15$ mK の場合と比べよ。

5. $\gamma_{10}^{(0)} = 0.01\ \mu\mathrm{s}^{-1}$ のとき、$\lvert2\rangle$ の実効的な寿命($T = 0$)はいくらか。$\lvert1\rangle$ の何倍か。

6. 🔬 **Pulse 回路スタジオ**でリーケージが見える短いGaussian $\pi$ Pulseを保存する。**Pulseラボ**で「準位数」を「3準位 qutrit(漏れ準位あり)」、「環境入力」を「Lindblad率を直接指定」にし、「gamma 10 down [1/us]」を固定したまま「gamma 21 down [1/us]」を既定値とgamma 10 downと同じ値にした場合で実行せよ。「観測時間 [us]」をPulse幅より長く取り、「P2 / リーケージ」のPulse後の減衰を比較せよ。

7. 🔬 同じqutrit Pulseと「Lindblad率を直接指定」を使い、「隣接準位の位相緩和 [1/us]」を`0`と正の値にして実行せよ。下降・上昇レートは0に固定する。「最終密度行列」の各セルに表示される $|\rho|$ を比較し、対角のP0・P1・P2はほぼ変わらず、非対角成分だけが小さくなることを確認せよ。$\rho_{02}$が十分生成されない条件では、まずPulse幅を短くしてリーケージを増やしてから比較すること。

---

次章では、GKSL方程式では書けないノイズを扱います。→ [P5. 準静的ノイズ](./quasi-static-noise.md)
