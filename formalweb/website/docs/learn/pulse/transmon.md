---
title: P1. トランズモンの物理
sidebar_position: 2
---

# P1. トランズモンの物理

:::info[このページで学ぶこと]
- なぜLC共振器は量子ビットにならないのか
- Josephson接合が持ち込む非線形性
- Cooper対箱ハミルトニアンから transmon 極限へ
- $\omega_{01} \approx \sqrt{8E_JE_C} - E_C$ と $\alpha \approx -E_C$ の由来
- 電荷ノイズ耐性と非調和性のトレードオフ
- Duffing近似と3準位切り詰めがどこまで正当か

**前提**: [第6章](../pulse-control.md) 6.7節
:::

## P1.1 調和振動子では量子ビットにならない

超伝導回路でいちばん単純な共振器は、インダクタ $L$ とキャパシタ $C$ を繋いだLC回路です。量子化すると、これは調和振動子そのものになります。

$$
H_{LC} = \hbar\omega_r\left(\hat a^\dagger \hat a + \frac{1}{2}\right),
\qquad
\omega_r = \frac{1}{\sqrt{LC}}
$$

エネルギー準位は $\omega_r$ 間隔で**完全に等間隔**です。

```text
|3⟩ ────────  3ω
|2⟩ ────────  2ω
|1⟩ ────────   ω
|0⟩ ────────   0
```

ここに $|0\rangle \to |1\rangle$ を狙って周波数 $\omega_r$ のマイクロ波を当てるとどうなるか。$|1\rangle \to |2\rangle$ の間隔も $\omega_r$ なので、**まったく同じだけ共鳴します**。しかも[第6章](../pulse-control.md) 6.8節で見たとおり $|1\rangle\to|2\rangle$ の行列要素は $\sqrt{2}$ 倍大きいので、むしろ上へ上へと駆け上がります。

$$
\text{等間隔の準位} \;\Longrightarrow\; \text{2準位に閉じ込められない} \;\Longrightarrow\; \text{量子ビットにならない}
$$

**必要なのは非線形性です。** 準位間隔を不揃いにする素子が要ります。

## P1.2 Josephson接合

Josephson接合は、2つの超伝導体を薄い絶縁膜で隔てた素子です。ここを流れる電流と、蓄えられるエネルギーは次式で与えられます。

$$
I = I_c\sin\hat\phi,
\qquad
U = -E_J\cos\hat\phi
$$

$\hat\phi$ は接合両側の超伝導位相差、$E_J = \hbar I_c/2e$ は **Josephsonエネルギー**です。

$\cos$ が入っていることが決定的です。これを展開すると

$$
-E_J\cos\hat\phi = -E_J\left(1 - \frac{\hat\phi^2}{2} + \frac{\hat\phi^4}{24} - \cdots\right)
$$

第2項までなら普通のインダクタ(調和振動子)ですが、**$\hat\phi^4$ 以降が非線形性を作ります**。Josephson接合は「散逸のない非線形インダクタ」であり、超伝導量子ビットが存在できる唯一の理由と言ってよい部品です。

## P1.3 Cooper対箱ハミルトニアン

Josephson接合とキャパシタを組み合わせた回路の量子化ハミルトニアンは、次の形になります。

$$
\boxed{\
H = 4E_C\left(\hat n - n_g\right)^2 - E_J\cos\hat\phi
\ }
$$

| 記号 | 意味 |
|---|---|
| $\hat n$ | 接合を渡ったCooper対の数(演算子) |
| $\hat\phi$ | 超伝導位相差。$[\hat\phi, \hat n] = i$ で $\hat n$ と共役 |
| $E_C = e^2/2C_\Sigma$ | **チャージングエネルギー**(Cooper対を1つ足すコスト) |
| $E_J$ | Josephsonエネルギー(位相をそろえようとする力) |
| $n_g$ | ゲート電荷(オフセット。環境の電荷ノイズで揺らぐ) |

第1項は「電荷を動かしたくない」、第2項は「位相をそろえたい」という、互いに競合する2つの傾向です。どちらが勝つかは比 $E_J/E_C$ で決まり、それが素子の性格を決めます。

| 領域 | 性格 |
|---|---|
| $E_J/E_C \ll 1$ | Cooper対箱。電荷が良い量子数。$n_g$ に極めて敏感 |
| $E_J/E_C \gg 1$ | **transmon**。位相がほぼ固定。$n_g$ にほぼ鈍感 |

トランズモン(transmon = **trans**mission line shunted plasma oscillation qubit)は、後者の極限を狙って設計された素子です。典型値は $E_J/E_C \sim 50$ です。

## P1.4 transmon極限とDuffing振動子

$E_J \gg E_C$ では位相 $\hat\phi$ は 0 の近くに強く束縛されるので、$\cos$ を展開できます。定数を落として

$$
H \approx 4E_C\hat n^2 + \frac{E_J}{2}\hat\phi^2 - \frac{E_J}{24}\hat\phi^4
$$

前2項は調和振動子です。生成消滅演算子を導入すると

$$
\hat\phi = \left(\frac{2E_C}{E_J}\right)^{1/4}\left(\hat a + \hat a^\dagger\right)
$$

で、調和部分が $\sqrt{8E_JE_C}\,\hat a^\dagger\hat a$ になります。残った $\hat\phi^4$ の項を RWA で処理すると $\hat a^\dagger\hat a^\dagger\hat a\hat a = \hat n(\hat n-1)$ の形に落ち、最終的に

$$
\boxed{\
H \approx \omega_{01}\hat n + \frac{\alpha}{2}\hat n(\hat n - 1)
\ }
$$

$$
\omega_{01} \approx \sqrt{8E_JE_C} - E_C,
\qquad
\alpha \approx -E_C
$$

**これが[第6章](../pulse-control.md) 6.7節で天下り的に与えたDuffing形の由来です。**

そして重要な帰結が出ます。

:::tip[非調和性はチャージングエネルギーそのもの]
$$
\alpha \approx -E_C
$$

非調和性は独立に設計できる自由なパラメータではなく、**回路のキャパシタンスで決まります**。$C_\Sigma$ を大きくすれば $E_C$ が小さくなり、$|\alpha|$ も小さくなります。

これがP1.6で見るトレードオフの根です。
:::

### 数値で確かめる

典型的なトランズモンの設計値を入れてみます。

```text
E_C / h  = 250 MHz
E_J / E_C = 50   →  E_J / h = 12.5 GHz
```

$$
\sqrt{8E_JE_C}/h = \sqrt{8 \times 12500 \times 250}\ \mathrm{MHz} = 5000\ \mathrm{MHz}
$$

$$
f_{01} \approx 5000 - 250 = 4750\ \mathrm{MHz},
\qquad
\alpha/h \approx -250\ \mathrm{MHz}
$$

Yuragi-Striderの既定値($f_q = 5.0$ GHz、$\alpha = -250$ MHz)は、まさにこの設計領域に対応しています。

## P1.5 なぜ $n_g$ に鈍感になるのか

環境の電荷ノイズはゲート電荷 $n_g$ を揺らします。$n_g$ が変わると準位が動く度合いを**電荷分散**といい、transmon極限では次のように指数関数的に小さくなります。

$$
\epsilon_m \ \propto\ \exp\!\left(-\sqrt{\frac{8E_J}{E_C}}\right)
$$

$E_J/E_C = 50$ を入れると

$$
\exp\!\left(-\sqrt{400}\right) = e^{-20} \approx 2\times10^{-9}
$$

**9桁の抑制です。** これがトランズモンが広く使われる理由で、Cooper対箱の最大の弱点だった電荷ノイズを事実上消してしまいます。

指数関数の中に $\sqrt{E_J/E_C}$ が入っているので、比を少し上げるだけで劇的に効きます。

## P1.6 設計のトレードオフ

ここまでで2つの式が出ました。

$$
\alpha \approx -E_C,
\qquad
\epsilon \propto \exp\!\left(-\sqrt{8E_J/E_C}\right)
$$

$E_J/E_C$ を大きくすると:

| 効果 | 向き |
|---|---|
| 電荷ノイズ耐性 | **良くなる**(指数関数的に) |
| 非調和性 $\lvert\alpha\rvert$ | **悪くなる**(漏れやすくなる) |

$|\alpha|$ が小さいと、[P3](./leakage-drag.md)で見るように、速いゲートを打ったときの漏れが増えます。

:::warning[$E_J/E_C \sim 50$ は妥協点です]
比を上げれば電荷ノイズには強くなるが、ゲートが遅くなる。下げればゲートは速くできるが、電荷ノイズで $T_2$ が落ちる。実機の $E_J/E_C \sim 30$〜$80$ という値は、この両者の折り合いとして選ばれています。

**「なぜこの設計値なのか」に一意の答えはなく、何を優先するかで動きます。** 実機ごとに $\alpha$ が違うのはこのためです。
:::

## P1.7 Yuragi-Striderが何をモデル化しているか

:::note[$E_J$ と $E_C$ は入力ではありません]
Yuragi-Striderのパルスモデルは、Cooper対箱ハミルトニアンを解いていません。**すでにDuffing形に落ちた段階から出発します。**

入力するのは次の2つです。

```text
qubit_frequency_ghz    : f_01        (既定 5.0 GHz)
anharmonicity_mhz      : α           (既定 -250 MHz、負であることを強制)
```

内部で角周波数に変換されます。

$$
\alpha_{[\mathrm{rad/\mu s}]} = 2\pi\,\alpha_{[\mathrm{MHz}]},
\qquad
f_{12} = f_{01} + \frac{\alpha_{[\mathrm{MHz}]}}{1000}\ [\mathrm{GHz}]
$$

したがって、この章で見た $E_J/E_C$ のトレードオフを**シミュレーター上で直接動かすことはできません**。$\alpha$ を手で変えることで、その帰結だけを観察できます。
:::

実装は $\alpha \ge 0$ を例外として拒否します。正の非調和性はトランズモンの物理に反するためです。

### 3準位で切ることの妥当性

回転系のハミルトニアンは、駆動を含めても

$$
H = -\Delta\,\hat n + \frac{\alpha}{2}\hat n(\hat n-1) + \text{(駆動)}
$$

の形です。準位 $n$ のエネルギーは $-n\Delta + \frac{\alpha}{2}n(n-1)$ で、$|3\rangle$ は $|2\rangle$ よりさらに $\alpha$ だけ離調しています。共鳴駆動から遠いほど占有されにくいので、$|3\rangle$ 以上を捨てる近似は、$|2\rangle$ の占有が小さい限り妥当です。

:::warning[切り詰めが破れる条件]
逆に、次の場合は3準位切り詰めが正当化されません。

- 極端に強い駆動($\Omega \gtrsim |\alpha|$)
- 意図的に $|2\rangle$ を大きく占有させる操作
- $|1\rangle\to|2\rangle$ 遷移への共鳴駆動

Yuragi-Striderは切り詰めの妥当性を自動判定しません。$|2\rangle$ の population が大きく出た結果は、そもそもモデルの適用外である可能性を疑ってください。
:::

## 実装ではどうなっているか

- 非調和性の入力と単位変換、qutritモデルの仕様: [Pulse-levelモデル](../../physics-model/control_models/pulse-levelmodel.md)
- transmonの原典(Koch et al. 2007): [参考文献](../../physics-model/references.md)

## 演習

1. $E_C/h = 200$ MHz、$E_J/E_C = 60$ のトランズモンについて $f_{01}$ と $\alpha$ を見積もれ。$f_{12}$ はいくらか。

2. 電荷分散が $E_J/E_C = 30$ と $E_J/E_C = 60$ で何桁違うか計算せよ。

3. $\hat\phi^4$ 項を落とすと $H$ は完全な調和振動子になる。このとき $\alpha = 0$ であることを確かめ、量子ビットとして使えない理由を P1.1 の議論で説明せよ。

4. 回転系での準位エネルギー $E_n = -n\Delta + \frac{\alpha}{2}n(n-1)$ を $n = 0,1,2,3$ について書き下し、$\Delta = 0$ のとき $|3\rangle$ が $|2\rangle$ よりどれだけ離調しているか求めよ。

5. 🔬 Pulse Lab の Extension B で $\alpha$ を $-250$ MHz から $-150$ MHz へ変え、同じ π パルスでの漏れがどう変わるか観察せよ。P1.6 のトレードオフと整合するか。

6. 🔬 $\alpha$ に正の値を入れて、実装が拒否することを確認せよ。エラーメッセージは何を根拠にしているか。

---

次は、その量子ビットに当てるパルスそのものを設計します。→ [P2. パルス整形と周波数領域](./envelopes.md)
