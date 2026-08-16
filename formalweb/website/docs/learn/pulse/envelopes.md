---
title: P2. パルス整形と周波数領域
sidebar_position: 3
---

# P2. パルス整形と周波数領域

:::info[このページで学ぶこと]
- パルス面積定理が成り立つ条件と、成り立たなくなる場合
- 時間領域と周波数領域の対応、パルスの「帯域」とは何か
- 矩形パルスの sinc スペクトルと、Gaussian パルスがそれを避ける仕組み
- 有限区間で打ち切った Gaussian の面積を厳密に扱う方法
- 打ち切り正規化を誤ると $8.5\times10^{-3}$ rad の誤差が出ることの導出
- 振幅モードが排他である理由

**前提**: [第6章](../pulse-control.md) 6.5〜6.6節、[P1](./transmon.md)
:::

## P2.1 パルス面積定理を精密に述べる

[第6章](../pulse-control.md) 6.5節で、共鳴・固定位相のとき回転角が包絡線の面積で決まることを見ました。

$$
\theta = \int_0^{\tau_p}\Omega(t)\,dt
$$

なぜこれが厳密に成り立つのかを、あらためて確認します。回転系のハミルトニアンは

$$
H(t) = -\Delta\,\hat n + \frac{\Omega(t)}{2}\big(\cos\varphi\,\sigma_x + \sin\varphi\,\sigma_y\big)
$$

でした。$\Delta = 0$ かつ $\varphi$ が一定なら、右辺の演算子部分は時間に依存せず、係数 $\Omega(t)$ だけが動きます。

$$
H(t) = \frac{\Omega(t)}{2}A,
\qquad
A = \cos\varphi\,\sigma_x + \sin\varphi\,\sigma_y \ \ (\text{時間非依存})
$$

このとき異なる時刻のハミルトニアンが可換です。

$$
\big[H(t_1), H(t_2)\big] = \frac{\Omega(t_1)\Omega(t_2)}{4}\big[A, A\big] = 0
$$

[第2章](../unitary-dynamics.md) 2.4節で「時間順序積が必要」と述べた困難が、この場合だけ消えます。したがって素朴な指数が厳密解になります。

$$
U(\tau_p) = \exp\!\left(-\frac{i}{2}\left[\int_0^{\tau_p}\Omega\,dt\right]A\right)
$$

:::warning[面積定理が破れる3つの場合]
| 条件 | 何が起きるか |
|---|---|
| **離調がある**($\Delta \ne 0$) | $\hat n$ 項が $A$ と可換でない。回転軸が傾き、面積だけでは決まらない |
| **位相が時間変化する**($\varphi = \varphi(t)$) | $A$ が時間依存になり可換性が崩れる。**DRAGはこれに該当します** |
| **3準位以上** | $\lvert2\rangle$ への結合が入り、2準位の回転として閉じない |

つまり面積定理は **Baseline A の共鳴・固定位相の場合にだけ厳密**です。DRAGを掛けた瞬間、「$\beta$ を変えても回転角は変わらないはず」という直感は保証を失います。[P3](./leakage-drag.md)で確かめます。
:::

## P2.2 パルスの帯域

パルスは有限の長さを持つので、単一の周波数ではありません。包絡線 $\Omega(t)$ のFourier変換

$$
\tilde\Omega(\omega) = \int_{-\infty}^{\infty}\Omega(t)\,e^{-i\omega t}\,dt
$$

が、そのパルスが「どの周波数成分をどれだけ含むか」を表します。

なぜこれが重要かというと、**$|1\rangle\to|2\rangle$ 遷移は駆動から $|\alpha|$ だけ離れた周波数にある**からです([P1](./transmon.md))。パルスが $\omega = |\alpha|$ の成分をどれだけ含むかが、そのまま漏れの量を決めます([P3](./leakage-drag.md)で定式化します)。

$$
\text{漏れ} \ \sim\ \big\lvert\tilde\Omega(|\alpha|)\big\rvert^2
$$

### 矩形パルス

長さ $\tau_p$、振幅 $A$ の矩形パルスのFourier変換は **sinc関数**です。

$$
\tilde\Omega(\omega) = A\,\tau_p\,\frac{\sin(\omega\tau_p/2)}{\omega\tau_p/2}
$$

この関数は $1/\omega$ でしか減衰せず、**サイドローブが遠くまで残ります**。

$$
\lvert\tilde\Omega(\omega)\rvert \ \sim\ \frac{2A}{\omega}
\qquad (\omega\tau_p \gg 1)
$$

急な立ち上がり・立ち下がりが高周波成分を生む、というのが物理的な理由です。矩形パルスは「$|\alpha|$ のところにも無視できない振幅を持つ」ので、qutritに対しては漏れやすい形状です。

### Gaussianパルス

$\Omega(t) = A\,e^{-t^2/2\sigma^2}$ のFourier変換は、やはりGaussianです。

$$
\tilde\Omega(\omega) = A\sigma\sqrt{2\pi}\;e^{-\omega^2\sigma^2/2}
$$

**指数関数的に減衰します。** $\omega\sigma$ が大きい領域では、sinc の $1/\omega$ とは比較にならないほど小さくなります。

$$
\frac{\lvert\tilde\Omega(\lvert\alpha\rvert)\rvert}{\lvert\tilde\Omega(0)\rvert}
= e^{-\alpha^2\sigma^2/2}
$$

:::tip[漏れが $\sigma$ に対して指数関数的に効く]
$\lvert\alpha\rvert/2\pi = 250$ MHz、つまり $\lvert\alpha\rvert = 1571$ rad/μs で数値を入れます。

| $\sigma$ [μs] | $\lvert\alpha\rvert\sigma$ | $e^{-(\alpha\sigma)^2/2}$ |
|---|---|---|
| 0.0005 | 0.79 | $7.3\times10^{-1}$ |
| 0.001 | 1.57 | $2.9\times10^{-1}$ |
| 0.002 | 3.14 | $7.2\times10^{-3}$ |
| 0.005 | 7.85 | $4.2\times10^{-14}$ |

境目は $\sigma \sim 1/\lvert\alpha\rvert = 6.4\times10^{-4}$ μs あたりです。**そこを下回ると漏れが急激に立ち上がります。** これが[第6章](../pulse-control.md) 6.8節の $1/\tau_p \gtrsim \lvert\alpha\rvert$ という見積もりの、より精密な形です。
:::

これがGaussian包絡線を使う理由です。パルス面積(= 回転角)が同じでも、**周波数領域での姿がまったく違う**わけです。

## P2.3 打ち切られたGaussian

Gaussianは無限に広がるので、実際には有限区間で打ち切ります。Yuragi-Striderの実装は次のとおりです。

$$
\Omega(t) = A\exp\!\left(-\frac{(t - t_c)^2}{2\sigma^2}\right),
\qquad
0 \le t \le \tau_p
$$

$$
\tau_p = 2N_{\text{trunc}}\,\sigma,
\qquad
t_c = N_{\text{trunc}}\,\sigma
$$

区間の外では厳密に 0 です。**なめらかに減衰させる処理は入っていません**(端で $A e^{-N^2/2}$ から 0 へ不連続に落ちます)。この不連続を隠さないのは、打ち切りの影響を利用者が見られるようにするためです。

### 有限区間の面積

回転角を正しく出すには、この**有限区間での面積**が必要です。

$$
\int_{t_c-N\sigma}^{t_c+N\sigma}
e^{-\frac{(t-t_c)^2}{2\sigma^2}}dt
= \sigma\sqrt{2\pi}\;\operatorname{erf}\!\left(\frac{N}{\sqrt{2}}\right)
$$

無限台の面積 $\sigma\sqrt{2\pi}$ に、補正因子 $\operatorname{erf}(N/\sqrt2)$ が掛かった形です。

| $N_{\text{trunc}}$ | $\operatorname{erf}(N/\sqrt2)$ | 失われる割合 |
|---|---|---|
| 2 | 0.954500 | 4.55 % |
| 3 | 0.997300 | 0.270 % |
| 4 | 0.999937 | 0.0063 % |

### $8.5\times10^{-3}$ という数字の正体

ここで、実装が明示的に避けている誤りを追ってみます。

目標回転角 $\theta$ を実現したいとき、**無限台の面積で振幅を決めてしまう**と

$$
A_{\text{wrong}} = \frac{\theta}{\sigma\sqrt{2\pi}}
$$

ですが、実際に系が受け取る面積は有限区間ぶんだけなので

$$
\theta_{\text{actual}} = A_{\text{wrong}}\cdot\sigma\sqrt{2\pi}\,\operatorname{erf}\!\left(\frac{N}{\sqrt2}\right)
= \theta\cdot\operatorname{erf}\!\left(\frac{N}{\sqrt2}\right)
$$

$N = 3$、$\theta = \pi$(π パルス)のとき、誤差は

$$
\pi\left(1 - 0.997300\right) = \pi \times 2.700\times10^{-3}
= 8.5\times10^{-3}\ \mathrm{rad}
$$

**[Pulse-levelモデル](../../physics-model/control_models/pulse-levelmodel.md)に記録されている $8.5\times10^{-3}$ は、この計算の結果です。**

Yuragi-Striderは**打ち切り後の実際の面積**で正規化するので、この誤差は 0 になります。

$$
A = \frac{\theta}{\sigma\sqrt{2\pi}\,\operatorname{erf}(N/\sqrt2)}
$$

:::tip[パルス面積定理を知っていれば当然、知らなければ系統誤差]
$8.5\times10^{-3}$ rad は角度にして約 0.49°、忠実度でいえば $\sin^2(\theta/2)$ の変化として $\sim 10^{-5}$ の効果です。

小さく見えますが、これは**ランダムな誤差ではなく系統誤差**です。同じ向きにずっと積み上がるので、ゲートを100回重ねれば $10^{-3}$ 級になります。数値解法の精度をいくら上げても消えません。

「解いている方程式が正しくても、方程式に入れる数が間違っていれば結果は間違う」という典型例です。
:::

## P2.4 振幅モードは排他

パルスの強さの指定には2つの流儀があり、実装は**排他的に1つだけ**を受け付けます。

| モード | 指定するもの | 使う場面 |
|---|---|---|
| `target_rotation_angle` | `target_rotation_angle_rad` | 「π パルスが欲しい」 |
| `peak_amplitude` | `peak_amplitude_rad_per_us` | 「この振幅で何が起きるか見たい」 |

前者は $A = \theta / (\text{面積因子})$ を内部で解いてくれるモード、後者は $A$ を直接与えるモードです。

両方を同時に指定できないのは、**矛盾しうるから**です。$A$ と $\theta$ は面積因子で結ばれているので、独立に2つ与えると過剰決定になります。実装は暗黙にどちらかを優先するのではなく、422 で拒否します。

:::note[Gaussianで `pulse_duration_us` が拒否される理由]
同じ論理です。Gaussianでは所要時間が

$$
\tau_p = 2N_{\text{trunc}}\sigma
$$

と、$\sigma$ と $N_{\text{trunc}}$ から**導出されます**。そこに $\tau_p$ を独立に与えると過剰決定になるため、実装は拒否します。

矩形パルスには $\sigma$ がないので、逆に `pulse_duration_us` が必須です。
:::

## P2.5 形状と数値ステップの関係

包絡線の形は、必要な数値積分のステップ幅も決めます。ステップ方針には $\sigma$ に対するサンプル数の条件が入っています。

$$
\frac{h}{\sigma} \le \frac{1}{N_{\text{samples}}}
$$

| モデル | $N_{\text{samples}}$ |
|---|---|
| Baseline A | 20 |
| Extension B(qutrit) | 32 |

$\sigma$ を小さくして速いパルスを打つと、ステップ幅も比例して細かくなり、計算量が増えます。**速いパルスは物理的に漏れやすいだけでなく、数値的にも高くつきます。** 詳細は[P7](./numerics.md)で扱います。

## 実装ではどうなっているか

- 包絡線の形状、振幅モード、Gaussianの導出規則、面積正規化: [Pulse-levelモデル](../../physics-model/control_models/pulse-levelmodel.md)
- ステップ方針: [Pulse-levelモデル](../../physics-model/control_models/pulse-levelmodel.md)、[P7](./numerics.md)

## 演習

1. 矩形パルスのFourier変換が sinc になることを直接積分して示せ。最初のゼロ点は $\omega = 2\pi/\tau_p$ にあることを確かめよ。

2. Gaussianのフーリエ変換が $e^{-\omega^2\sigma^2/2}$ に比例することを示せ(平方完成を使う)。

3. $N_{\text{trunc}} = 2$ で無限台の正規化を使った場合、π パルスの回転角誤差は何 rad になるか。$N = 3$ の場合の何倍か。

4. 目標回転角 $\theta = \pi$、$\sigma = 0.002$ μs、$N = 3$ のときのピーク振幅 $A$ を求めよ。パルス長 $\tau_p$ はいくらか。

5. 面積定理が離調下で破れることを、[第6章](../pulse-control.md) 6.5節の $P_1^{\max} = \Omega^2/(\Omega^2+\Delta^2)$ から説明せよ。

6. 🔬 **Pulse 回路スタジオ**でX Pulseを選び、「振幅の指定方法」を「回転角」、「回転角 [rad]」を $\pi$ に固定する。「波形」をSquareとGaussianに切り替えてそれぞれ「ブロックへ保存」し、**Pulseラボ**の「2準位モデル」で実行せよ。両方の「占有確率と品質指標」でPulse終了時のP1と最終忠実度がほぼ一致することを確かめよ。

7. 🔬 設問6と同じSquareとGaussianを、今度は**Pulseラボ**の「Qutrit(漏れ準位あり)」で実行せよ。「最大リーケージ P2」「最終リーケージ P2」と「目標状態との重なり」を記録し、2つの波形が一致しないことと、どちらに不利な差が出るかをP2.2の議論と照合せよ。比較中は非調和性と環境設定を変えないこと。

---

次章では、その漏れを定量化し、抑える方法を扱います。→ [P3. 漏れとDRAG](./leakage-drag.md)
