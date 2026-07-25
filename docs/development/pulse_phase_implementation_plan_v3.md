# QuantaScope Pulse Phase 開発・検証計画書 v3

> **Status update**
>
> Pulse Baseline A is complete and frozen as
> `driven_two_level_rwa_experimental_v1` /
> `pulse-baseline-a-v1`. Extension B, including qutrit leakage, DRAG, and Pulse
> Lab UI, is complete and frozen: B-0 through B-7 are complete with a
> `PASS WITH RESTRICTIONS` decision. Current Baseline A truth is in
> `docs/development/pulse-baseline-a/README.md`. The executable Extension B
> phase plan is maintained in
> `docs/development/pulse-extension-b/README.md` and takes precedence over the
> older B0-B7 outline in this document.

## 0. 文書の目的

本計画書は、QuantaScope に時間依存の制御包絡線モデルを追加し、二準位モデルから三準位 transmon モデル、leakage、DRAG までを段階的に実装・検証するための仕様書である。

本計画で扱うモデルは、実験室座標系で GHz の搬送波を直接時間分解する厳密な実機再現ではない。位置づけは次のとおりとする。

> **回転座標系、回転波近似、制御包絡線を用いた実験的な駆動モデル**

英語名は **rotating-frame RWA control-envelope experimental model** とする。

- **rotating frame**: 回転座標系。駆動周波数に合わせて回転する座標系。
- **RWA**: Rotating-Wave Approximation、回転波近似。高速に振動して平均化される項を除く近似。
- **control envelope**: 制御包絡線。パルス振幅が時間とともに変化する外形。
- **experimental**: 研究・検証中の機能であり、特定実機への校正済み再現を意味しない。

内部モデル ID は次とする。

```text
driven_two_level_rwa_experimental_v1
driven_transmon_qutrit_rwa_experimental_v1
```

本計画では、開発完了条件を二つの到達点に分離する。

```text
Pulse Baseline A
  二準位 RWA control-envelope model
  square / Gaussian / phase / detuning
  dissipation / convergence / QuTiP comparison

Pulse Extension B
  qutrit transmon
  leakage / qutrit dissipation
  DRAG / qutrit convergence / QuTiP qutrit comparison
```

- **baseline**: 後続開発の基準として固定する最初の完成段階。
- **extension**: 基準モデルへ追加する拡張段階。

Pulse Baseline A の完了時点で、検証済み二準位モデルを独立した成果として固定する。Pulse Extension B は、その基準を壊さずに三準位系へ拡張する。

---

# 1. 現在の基準モデル

現行 QuantaScope では、区間一定の有効 Hamiltonian と Lindblad 散逸を同時に解く gate-level モデルが実装されている。

$$
\frac{d\rho}{dt}
=
-i[H_{\mathrm{gate}},\rho]
+
\sum_k
\left(
L_k\rho L_k^\dagger
-
\frac12\{L_k^\dagger L_k,\rho\}
\right)
$$

V1 から V7 により、次を確認済みである。

| 検証 | 内容 | 状態 |
|---|---|---|
| V1 | 散逸ゼロで理想ゲートと一致 | 完了 |
| V2 | ゼロ温度極限と熱励起率 | 完了 |
| V3 | 励起状態の指数減衰 | 完了 |
| V4 | 純粋位相緩和 | 完了 |
| V5 | 有限温度での熱平衡 | 完了 |
| V6 | 時間刻みと数値収束 | 完了 |
| V7 | QuTiP との同一条件比較 | 完了 |

Pulse Phase では、この経路を削除せず、既存の定数 Hamiltonian 経路として保存する。

```text
Simulation model
├─ gate_aware_hamiltonian_lindblad_v1
├─ driven_two_level_rwa_experimental_v1
└─ driven_transmon_qutrit_rwa_experimental_v1
```

- **simulation model**: シミュレーション内部で採用する物理・数値モデルの種類。

各 Pulse milestone 完了時に V1 から V7 を再実行し、既存モデルの数値結果が変わっていないことを確認する。

- **milestone**: 開発工程の区切りとなる到達点。

---

# 2. 二準位モデルの物理規約

実装前に本節を仕様として固定し、コード、API、UI、検証報告書で同じ記号を使用する。

## 2.1 基底と Pauli 行列

$$
|0\rangle=
\begin{pmatrix}1\\0\end{pmatrix},
\qquad
|1\rangle=
\begin{pmatrix}0\\1\end{pmatrix}
$$

$$
\sigma_x=
\begin{pmatrix}0&1\\1&0\end{pmatrix},
\qquad
\sigma_y=
\begin{pmatrix}0&-i\\i&0\end{pmatrix},
\qquad
\sigma_z=
\begin{pmatrix}1&0\\0&-1\end{pmatrix}
$$

したがって、

$$
\sigma_z|0\rangle=+|0\rangle,
\qquad
\sigma_z|1\rangle=-|1\rangle
$$

である。

## 2.2 回転座標系

- **laboratory frame**: 実験室座標系。搬送波の高速振動を含む元の表示。
- **rotating-frame transformation**: 実験室座標系から回転座標系へ移る変換。

変換規約を次で固定する。

$$
R(t)=\exp\left(+i\frac{\omega_d t}{2}\sigma_z\right)
$$

$$
|\psi_{\mathrm{rot}}(t)\rangle
=R^\dagger(t)|\psi_{\mathrm{lab}}(t)\rangle
$$

ここで、

- $\omega_d$: 駆動角周波数
- $\omega_q$: 量子ビット遷移角周波数

である。

## 2.3 離調

離調は次で定義する。

$$
\boxed{\Delta=\omega_d-\omega_q}
$$

- **detuning**: 離調。駆動角周波数と量子ビット角周波数の差。

二準位 RWA Hamiltonian は、

$$
\boxed{
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x
+
\sin\phi\,\sigma_y
\right)
}
$$

とする。単位行列に比例するグローバル位相成分は除く。

## 2.4 位相

$\phi=0$ は $+x$ 軸回転、$\phi=\pi/2$ は $+y$ 軸回転とする。

$$
\phi=0
\quad\Rightarrow\quad
H_{\mathrm{drive}}(t)=\frac{\Omega(t)}2\sigma_x
$$

$$
\phi=\frac{\pi}{2}
\quad\Rightarrow\quad
H_{\mathrm{drive}}(t)=\frac{\Omega(t)}2\sigma_y
$$

正の位相は、Bloch 球の赤道面で $+x$ 軸から $+y$ 軸へ向かう方向とする。

- **Bloch sphere**: 一量子ビット状態を三次元球上のベクトルで表す方法。
- **trajectory**: 時間発展によって状態が描く軌跡。

Pulse Lab の Bloch trajectory は必ず **rotating-frame trajectory** と表示する。

## 2.5 単位

| 量 | 内部単位 |
|---|---|
| 時間 $t$ | $\mu\mathrm{s}$ |
| $\Omega(t)$ | $\mathrm{rad}/\mu\mathrm{s}$ |
| $\Delta$ | $\mathrm{rad}/\mu\mathrm{s}$ |
| $\omega_d,\omega_q$ | $\mathrm{rad}/\mu\mathrm{s}$ |
| 散逸率 $\gamma$ | $1/\mu\mathrm{s}$ |
| transmon 非調和性 $\alpha$ | $\mathrm{rad}/\mu\mathrm{s}$ |
| DRAG 係数 $\beta$ | $\mu\mathrm{s}$ |

UI では通常周波数を MHz または GHz で入力し、API または core 境界で角周波数へ変換する。

$$
1\ \mathrm{MHz}
=
1\ \mathrm{cycle}/\mu\mathrm{s}
$$

$$
f\ [\mathrm{MHz}]
\longrightarrow
2\pi f\ [\mathrm{rad}/\mu\mathrm{s}]
$$

---

# 3. 三準位 transmon モデル

## 3.1 目的

二準位モデルには $|2\rangle$ が存在しないため、leakage を原理的に表現できない。Pulse Extension B では三準位 transmon を導入する。

- **qutrit**: 三つの基底状態を持つ量子系。本計画では $|0\rangle,|1\rangle,|2\rangle$ を使う。
- **leakage**: 計算基底 $|0\rangle,|1\rangle$ の外である $|2\rangle$ へ人口が移る現象。

## 3.2 基底と演算子

$$
|0\rangle,
\qquad
|1\rangle,
\qquad
|2\rangle
$$

消滅演算子を、

$$
a=
\begin{pmatrix}
0&1&0\\
0&0&\sqrt2\\
0&0&0
\end{pmatrix}
$$

とし、

$$
n=a^\dagger a
$$

を数演算子とする。

## 3.3 非調和性

非調和性は、

$$
\boxed{\alpha=\omega_{12}-\omega_{01}}
$$

とする。

- **anharmonicity**: 非調和性。隣接する遷移周波数の差が一定でないこと。

通常の transmon では $\alpha<0$ を想定する。

UI と API では、単位誤りを避けるため原則として、

```text
anharmonicity_mhz
```

を入力する。内部では、

$$
\alpha_{\mathrm{rad}/\mu s}
=
2\pi\,\alpha_{\mathrm{MHz}}
$$

へ変換する。

例として、

$$
-250\ \mathrm{MHz}
\longrightarrow
-2\pi\times250
=
-1570.7963267948965\ \mathrm{rad}/\mu\mathrm{s}
$$

である。

したがって、次は誤りである。

```text
-1.5707963267948966 rad/us
```

これは約 $-0.25\ \mathrm{MHz}$ に相当する。

## 3.4 回転座標系 Hamiltonian

三準位モデルでは、

$$
\boxed{
H_{\mathrm{qutrit}}(t)
=
-\Delta n
+
\frac{\alpha}{2}n(n-1)
+
\frac{\Omega_x(t)}{2}(a+a^\dagger)
+
\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right]
}
$$

とする。

$$
\Omega_x(t)=\Omega(t)\cos\phi
$$

$$
\Omega_y(t)=\Omega(t)\sin\phi
$$

二準位部分空間では、$-\Delta n$ は単位行列成分を除いて $+(\Delta/2)\sigma_z$ と一致する。これにより、二準位モデルと三準位モデルで detuning 規約を統一する。

## 3.5 leakage 指標

三準位密度行列 $\rho$ に対して、

$$
\boxed{P_{\mathrm{leak}}(t)=\rho_{22}(t)}
$$

と定義する。

次を別々に記録する。

```text
maximum_leakage_probability
leakage_at_pulse_end
leakage_at_final_time
```

---

# 4. 三準位散逸規約

Pulse Extension B の実装開始前に、三準位散逸を次の規約で固定する。

## 4.1 遷移別 collapse operator

下向き遷移を、

$$
L_{10}^{\downarrow}
=
\sqrt{\gamma_{10}^{\downarrow}}|0\rangle\langle1|
$$

$$
L_{21}^{\downarrow}
=
\sqrt{\gamma_{21}^{\downarrow}}|1\rangle\langle2|
$$

上向き遷移を、

$$
L_{01}^{\uparrow}
=
\sqrt{\gamma_{01}^{\uparrow}}|1\rangle\langle0|
$$

$$
L_{12}^{\uparrow}
=
\sqrt{\gamma_{12}^{\uparrow}}|2\rangle\langle1|
$$

とする。

行列要素の $\sqrt2$ 効果は、collapse operator に重複して入れず、ゼロ温度基礎 rate の比へ含める。

初期 physical model では、

$$
\gamma_{21,0}
=
r_{21/10}\,\gamma_{10,0}
$$

とし、既定値を、

$$
\boxed{r_{21/10}=2}
$$

とする。

これは調和振動子の遷移行列要素の二乗比を用いた現象論的近似であり、特定実機への校正値ではない。device profile で上書き可能にする。

- **profile override**: device profile ごとに既定値を置き換える設定。

## 4.2 遷移ごとの熱占有数

$0\leftrightarrow1$ と $1\leftrightarrow2$ では遷移周波数が異なるため、熱占有数を別々に計算する。

$$
n_{01}
=
\frac{1}{\exp\left(\frac{h f_{01}}{k_BT}\right)-1}
$$

$$
n_{12}
=
\frac{1}{\exp\left(\frac{h f_{12}}{k_BT}\right)-1}
$$

ここで、

$$
f_{12}=f_{01}+\frac{\alpha}{2\pi}
$$

である。API で $f_{01}$ を GHz、$\alpha$ を MHz で受け取る場合は、

$$
f_{12}[\mathrm{GHz}]
=
f_{01}[\mathrm{GHz}]
+
\frac{\alpha[\mathrm{MHz}]}{1000}
$$

とする。

$f_{12}\le0$ となる入力は不正として拒否する。

## 4.3 有限温度 rate

$$
\gamma_{10}^{\downarrow}
=
\gamma_{10,0}(n_{01}+1)
$$

$$
\gamma_{01}^{\uparrow}
=
\gamma_{10,0}n_{01}
$$

$$
\gamma_{21}^{\downarrow}
=
\gamma_{21,0}(n_{12}+1)
$$

$$
\gamma_{12}^{\uparrow}
=
\gamma_{21,0}n_{12}
$$

したがって、各遷移で詳細釣り合い、

$$
\frac{\gamma_{01}^{\uparrow}}
{\gamma_{10}^{\downarrow}}
=
\exp\left(-\frac{h f_{01}}{k_BT}\right)
$$

$$
\frac{\gamma_{12}^{\uparrow}}
{\gamma_{21}^{\downarrow}}
=
\exp\left(-\frac{h f_{12}}{k_BT}\right)
$$

を満たす。

## 4.4 純粋位相緩和

初期 qutrit model では、単一の number-noise model を採用する。

$$
\boxed{
L_{\phi}^{(3)}
=
\sqrt{2\gamma_{\phi,\mathrm{adj}}}\,n
}
$$

ここで、$\gamma_{\phi,\mathrm{adj}}$ は隣接準位間 coherence の純粋位相減衰率を表す。

散逸が純粋位相緩和だけの場合、

$$
\rho_{01}(t)
=
\rho_{01}(0)e^{-\gamma_{\phi,\mathrm{adj}}t}
$$

$$
\rho_{12}(t)
=
\rho_{12}(0)e^{-\gamma_{\phi,\mathrm{adj}}t}
$$

$$
\rho_{02}(t)
=
\rho_{02}(0)e^{-4\gamma_{\phi,\mathrm{adj}}t}
$$

となる。

この単一 diagonal operator では、$\rho_{01}$、$\rho_{12}$、$\rho_{02}$ の三つの純粋位相減衰率を独立に設定できない。この制約を API、UI、報告書へ明記する。

- **diagonal operator**: 基底表示で対角成分だけを持つ演算子。

将来、独立な coherence rate を必要とする場合は、複数の diagonal collapse operator または noise-spectrum model を別 version として導入する。

## 4.5 coherence の期待減衰率

人口遷移も含める場合、各準位から外へ出る total rate を、

$$
r_0
=
\gamma_{01}^{\uparrow}
$$

$$
r_1
=
\gamma_{10}^{\downarrow}
+
\gamma_{12}^{\uparrow}
$$

$$
r_2
=
\gamma_{21}^{\downarrow}
$$

とする。

このとき coherence の期待減衰率は、

$$
\Gamma_{01}
=
\frac12(r_0+r_1)
+
\gamma_{\phi,\mathrm{adj}}
$$

$$
\Gamma_{12}
=
\frac12(r_1+r_2)
+
\gamma_{\phi,\mathrm{adj}}
$$

$$
\Gamma_{02}
=
\frac12(r_0+r_2)
+
4\gamma_{\phi,\mathrm{adj}}
$$

とする。PULSE-B-DISSIPATION で解析式と数値解を比較する。

---

# 5. 数値計算経路の分離

## 5.1 既存 constant path の保存

- **constant path**: 区間中に Hamiltonian が一定である既存計算経路。
- **time-dependent path**: Hamiltonian が時間によって変わる新しい計算経路。

既存 solver 全体を一律に Provider 化しない。次の二経路を分離する。

```python
evolve_constant_segment(...)
evolve_time_dependent_segment(...)
```

既存 gate-level モデルは `evolve_constant_segment` を使い続ける。

新しい pulse model だけが `evolve_time_dependent_segment` を使用する。

## 5.2 初期実装の backend

時間依存経路の初期版は Python/NumPy reference 実装に限定する。

- **reference implementation**: 正しさを優先する基準実装。
- **backend**: 数値計算を実行する内部実装。
- **callback**: 数値積分中に関数を呼び出して値を取得する仕組み。
- **cache**: 再計算を避けるために値を保存して再利用する仕組み。

既存 NumPy constant kernel の行列 cache を維持し、時間依存 callback を既存経路へ混入させない。Rust backend へ Python callback を渡さない。

## 5.3 時間依存 Hamiltonian の境界

```python
class TimeDependentHamiltonian(Protocol):
    def evaluate(self, local_time_us: float) -> Matrix:
        ...
```

RK4 の各 stage で、

$$
H(t),
\qquad
H\left(t+\frac{h}{2}\right),
\qquad
H\left(t+\frac{h}{2}\right),
\qquad
H(t+h)
$$

を評価する。

stage 呼び出し順序を validation log で記録する。

- **stage**: Runge-Kutta 法の一つの時間刻み内部で行う中間評価。
- **validation log**: 検証時に保存する実行記録。

## 5.4 segment と event

- **segment**: 一定時間続く連続時間発展区間。
- **event**: 測定、reset、将来の離散 CPTP channel など、時刻境界で適用する操作。

```text
continuous segment
  H(t) + Lindblad dissipation
        ↓
discrete event
  measurement / reset / CPTP channel
        ↓
next continuous segment
```

Pulse Phase は continuous segment を拡張する。厳密 CPTP event は後続 Phase で実装する。

---

# 6. 内部時間刻み policy

- **policy**: 数値計算で採用する規則。
- **internal step**: snapshot 間隔とは独立した、数値積分内部の時間刻み。
- **spectral diameter**: Hermitian 行列の最大固有値と最小固有値の差。単位行列成分に依存せず、状態間の相対位相を生む最大角周波数差を表す。

snapshot 数だけで internal step を決めてはならない。

## 6.1 Hamiltonian scale

時刻 $t$ の Hamiltonian scale を、

$$
G_H(t)
=
\lambda_{\max}(H(t))
-
\lambda_{\min}(H(t))
$$

と定義する。

二準位モデルでは、

$$
G_H(t)
=
\sqrt{\Omega(t)^2+\Delta^2}
$$

と一致する。

qutrit では、$\alpha$、$\Delta$、$\sqrt2\Omega_x$、$\sqrt2\Omega_y$ を含む Hamiltonian 全体から spectral diameter を計算する。これにより、非調和性を刻み条件から落とさない。

内部刻みは、

$$
h\max_t G_H(t)
\le
\varepsilon_H
$$

を満たすようにする。

$\varepsilon_H$ は収束検証で決める無次元閾値である。

## 6.2 包絡線 scale

Gaussian pulse では、

$$
h\le\frac{\sigma}{N_\sigma}
$$

を追加する。

$N_\sigma$ は収束検証により決定する。

DRAG を有効にする場合は、$d\Omega_x/dt$ の変化も同じ $\sigma$ 制約で解像できることを確認する。

## 6.3 散逸 scale

二準位では、保守的に、

$$
G_D^{(2)}
=
\gamma_\downarrow
+
\gamma_\uparrow
+
\gamma_\phi
$$

とする。

$$
hG_D^{(2)}
\le
\varepsilon_D
$$

を満たすようにする。

qutrit では、最も速い人口・coherence 減衰を見落とさないため、

$$
G_D^{(3)}
=
\gamma_{10}^{\downarrow}
+
\gamma_{01}^{\uparrow}
+
\gamma_{21}^{\downarrow}
+
\gamma_{12}^{\uparrow}
+
4\gamma_{\phi,\mathrm{adj}}
$$

を初期の保守的 scale とする。

$$
hG_D^{(3)}
\le
\varepsilon_D
$$

を満たすようにする。

## 6.4 最終 step 選択

$$
h_{\max}
=
\min
\left(
 h_H,
 h_{\mathrm{envelope}},
 h_D,
 h_{\mathrm{user\ cap}}
\right)
$$

とする。

- **user cap**: 利用者または検証スクリプトが指定する最大内部刻み上限。

既定値は実装時に固定せず、PULSE-CONV-2LEVEL と PULSE-CONV-QUTRIT の結果から決める。

## 6.5 diagnostics

各計算結果へ次を保存する。

```text
hamiltonian_scale_max_rad_per_us
dissipation_scale_per_us
envelope_step_limit_us
selected_internal_step_cap_us
actual_internal_step_min_us
actual_internal_step_max_us
actual_internal_step_count
step_limit_reason
```

- **diagnostics**: 内部計算条件や状態を確認するための診断情報。

---

# 7. density-matrix cleanup の監査

- **cleanup**: 数値誤差による小さな非エルミート成分や trace ずれを補正する後処理。
- **correction norm**: cleanup 前後の密度行列差の大きさ。
- **checkpoint**: 検証指標を記録する指定時点。

production 経路の cleanup が数値誤差を隠していないか確認する。

## 7.1 cleanup 前

```text
raw_trace_error
raw_hermiticity_error
raw_minimum_eigenvalue
```

## 7.2 cleanup 後

```text
clean_trace_error
clean_hermiticity_error
clean_minimum_eigenvalue
```

## 7.3 補正量

$$
\Delta\rho_{\mathrm{cleanup}}
=
\rho_{\mathrm{after}}
-
\rho_{\mathrm{before}}
$$

$$
\|\Delta\rho_{\mathrm{cleanup}}\|_F
$$

を記録する。

- **Frobenius norm**: 行列要素の絶対値二乗和の平方根で定義される行列 norm。

validation-only の no-clean trajectory を用意し、短時間かつ十分細かい刻みで production cleanup trajectory と比較する。

cleanup correction が刻み細分化で減少しない場合、または raw minimum eigenvalue が許容範囲を系統的に下回る場合は合格としない。

---

# 8. パルス包絡線

## 8.1 矩形パルス

$$
\Omega(t)=
\begin{cases}
\Omega_0,&0\le t\le\tau_p\\
0,&\text{otherwise}
\end{cases}
$$

矩形パルスは Rabi 振動と符号規約の検証に使う。ただし Hamiltonian が区間内で一定なので、時間依存 RK4 stage 評価の主検証には使わない。

## 8.2 可換な時間依存 Hamiltonian

$$
H(t)=\frac{\Omega(t)}2\sigma_x
$$

では、

$$
[H(t_1),H(t_2)]=0
$$

であるため、

$$
U(t)
=
\exp\left[
-\frac{i\sigma_x}{2}
\int_0^t\Omega(s)ds
\right]
$$

という解析解を使える。

Gaussian pulse をこの検証に用い、各 RK4 stage で正しい時刻の Hamiltonian が評価されているか確認する。

## 8.3 Gaussian pulse の timing specification

Gaussian では、独立入力を次の二つに限定する。

```text
sigma_us
truncation_sigma
```

パルス時間は、

$$
\boxed{
\tau_p
=
2N_{\mathrm{trunc}}\sigma
}
$$

として内部で導出する。

$$
t_s=0
$$

$$
t_c=N_{\mathrm{trunc}}\sigma
$$

$$
t_e=2N_{\mathrm{trunc}}\sigma
$$

とする。

API で `pulse_duration_us`、`sigma_us`、`truncation_sigma` の三つを同時に自由入力させない。

response には、

```text
derived_pulse_duration_us
pulse_center_us
pulse_start_us
pulse_end_us
```

を返す。

## 8.4 Gaussian 有限区間正規化

$$
g(t)
=
\exp\left[
-\frac{(t-t_c)^2}{2\sigma^2}
\right]
$$

有限区間面積を、

$$
A_{\mathrm{finite}}
=
\int_{t_s}^{t_e}g(t)dt
$$

とする。

無限区間近似 $\sigma\sqrt{2\pi}$ を、そのまま target-angle 正規化へ使わない。

## 8.5 振幅入力方式

次の二モードを排他的に選ぶ。

### target-angle mode

$$
\theta_{\mathrm{target}}
=
\int_{t_s}^{t_e}\Omega(t)dt
$$

から peak amplitude を内部導出する。

### peak-amplitude mode

peak amplitude を入力し、実際の pulse area と回転角を出力する。

```text
amplitude_mode = target_rotation_angle
amplitude_mode = peak_amplitude
```

- **mode**: 排他的に選ぶ入力方式。

## 8.6 DRAG

Gaussian 主成分を $\Omega_x(t)$ とし、直交成分を、

$$
\boxed{
\Omega_y(t)
=
\beta\frac{d\Omega_x(t)}{dt}
}
$$

とする。

$\Omega_y$ の単位は $\mathrm{rad}/\mu\mathrm{s}$、$d\Omega_x/dt$ の単位は $\mathrm{rad}/\mu\mathrm{s}^2$ なので、

$$
\boxed{[\beta]=\mu\mathrm{s}}
$$

である。

API と UI では、

```text
drag_beta_us
```

を使用する。

- **DRAG**: Derivative Removal by Adiabatic Gate。主包絡線の時間微分に比例する直交成分を加え、leakage や位相誤差を抑える方法。

$\beta\sim1/\alpha$ は初期探索値の目安であり、符号と最適値は Hamiltonian・位相規約に依存する。唯一の理論値として固定しない。

---

# 9. API 設計

初期版は既存 `/api/simulate` と分離する。

```text
POST /api/pulse/simulate
```

- **payload**: API に送る入力データ本体。
- **response**: API が返す出力データ本体。
- **discriminated mode**: `input_mode` などの識別子によって、使用可能な入力 field を明確に分ける方式。

## 9.1 二準位 Gaussian 入力例

```json
{
  "model_id": "driven_two_level_rwa_experimental_v1",
  "initial_state": "0",
  "pulse": {
    "shape": "gaussian",
    "amplitude_mode": "target_rotation_angle",
    "target_rotation_angle_rad": 3.141592653589793,
    "sigma_us": 0.8,
    "truncation_sigma": 4.0,
    "phase_rad": 0.0,
    "detuning_rad_per_us": 0.0,
    "drag_beta_us": 0.0
  },
  "total_simulation_time_us": 20.0,
  "environment": {
    "input_mode": "physical",
    "device_quality": 1.0,
    "temperature_mk": 20.0,
    "flux_noise_phi0": 0.0,
    "qubit_frequency_ghz": 5.0,
    "t1_max_us": 100.0,
    "tphi_max_us": 100.0
  },
  "snapshot_options": {
    "uniform_count": 101,
    "custom_times_us": [0.0, 6.4, 20.0]
  }
}
```

この例では、

$$
\tau_p
=
2\times4\times0.8
=
6.4\ \mu\mathrm{s}
$$

である。

## 9.2 direct-rate mode

検証・専門家用には、次を許可する。

```json
{
  "environment": {
    "input_mode": "direct_rates",
    "gamma_down_per_us": 0.02,
    "gamma_up_per_us": 0.003,
    "gamma_phi_per_us": 0.015
  }
}
```

- **direct rates**: 温度などから導出せず、散逸率を直接入力する方式。
- **physical input**: 温度、周波数、品質などの物理パラメータから散逸率を導く方式。

二つの mode の field を混在させない。

## 9.3 pulse duration と観測時間

```text
pulse duration
```

と、

```text
total simulation time
```

を分離する。

$$
0<\tau_p\le T_{\mathrm{total}}
$$

とする。

パルス終了後の、

```text
pulse end → idle evolution → final observation
```

を観測可能にする。

## 9.4 qutrit 入力例

```json
{
  "model_id": "driven_transmon_qutrit_rwa_experimental_v1",
  "initial_state": "0",
  "transmon": {
    "anharmonicity_mhz": -250.0,
    "gamma21_over_gamma10_zero_temperature": 2.0,
    "qutrit_dephasing_model": "number_operator_single_rate_v1"
  }
}
```

内部 diagnostics では、

```text
anharmonicity_rad_per_us = -1570.7963267948965
```

を返す。

## 9.5 qutrit direct-rate mode

```json
{
  "environment": {
    "input_mode": "direct_qutrit_rates",
    "gamma_10_down_per_us": 0.02,
    "gamma_01_up_per_us": 0.003,
    "gamma_21_down_per_us": 0.04,
    "gamma_12_up_per_us": 0.005,
    "gamma_phi_adjacent_per_us": 0.015
  }
}
```

rate 名は遷移方向を明示する。`gamma21` のような曖昧な名称だけを使わない。

## 9.6 応答

```text
model_id
frame = rotating
approximation = RWA
requested_time_us
actual_time_us
pulse_active
Omega_x_rad_per_us
Omega_y_rad_per_us
detuning_rad_per_us
anharmonicity_rad_per_us
population_0
population_1
population_2
leakage_probability
fidelity_metrics
raw_physicality_metrics
cleanup_metrics
step_diagnostics
```

二準位モデルでは `population_2` と `leakage_probability` を `null` とする。

---

# 10. QuTiP adapter の拡張

現行の二準位専用、

```python
dims=[[2] * n_qubits, [2] * n_qubits]
```

という前提を一般化する。

新しい境界は、

```python
subsystem_dimensions: tuple[int, ...]
```

を受け取る。

例:

```text
1 qubit        -> (2,)
2 qubits       -> (2, 2)
1 qutrit       -> (3,)
qubit + qutrit -> (2, 3)  # 将来用
```

QuTiP へは、

```python
dims=[list(subsystem_dimensions), list(subsystem_dimensions)]
```

を渡す。

Pulse Phase では QuantaScope が生成した Hamiltonian、density matrix、collapse operator をそのまま `Qobj` に変換し、QuTiP の spin operator や destroy operator からモデルを再構築しない。

---

# 11. fidelity と定常状態

- **fidelity**: 二つの量子状態の近さを表す指標。

散逸下では同じ名称を使い回さず、次を分離する。

## 11.1 無散逸 trajectory との比較

```text
fidelity_to_closed_pulse_trajectory
```

## 11.2 目標状態との比較

```text
final_state_fidelity_to_target
```

## 11.3 qutrit 指標

```text
full_qutrit_state_fidelity
computational_subspace_conditional_fidelity
leakage_probability
```

- **conditional fidelity**: 計算部分空間に残ったという条件の下で、射影後に再正規化して計算する fidelity。

再正規化の有無を response と報告書へ明記する。

## 11.4 駆動中と pulse 後の定常状態

パルス駆動中は、単純な熱平衡人口、

$$
P_1^{\mathrm{eq}}
=
\frac{\gamma_\uparrow}
{\gamma_\downarrow+\gamma_\uparrow}
$$

へ向かうとは限らない。

連続駆動下では、駆動と散逸が釣り合う optical Bloch steady state が現れる。

- **optical Bloch steady state**: 駆動と散逸が同時に存在するときの定常状態。
- **steady state**: 時間微分がゼロとなる状態。

説明は次のように分ける。

```text
pulse active:
  driven open-system trajectory
  optical Bloch analytic solution または QuTiP reference と比較

pulse finished, idle interval:
  thermal equilibrium population へ緩和
```

---

# 12. Pulse Baseline A

Pulse Baseline A は、二準位 control-envelope model の実装・検証を完了する段階である。

## A0: 仕様固定と既存経路保護

### 実装

- 基底、$\sigma_y$、$\Delta$、phase、単位を定数と文書へ固定
- `driven_two_level_rwa_experimental_v1` を追加
- `/api/pulse/simulate` の schema を追加
- `physical` と `direct_rates` を discriminated mode として分離
- 既存 constant path を変更しない

### 検証

- $\sigma_y$ 行列
- phase の正方向
- $\Delta$ の正負
- 単位変換
- API の排他的 field validation

### 完了条件

- V1 から V7 が再成功
- 既存 `/api/simulate` の response が変化しない

## A1: 時間依存専用 RK4 経路

### 実装

```text
evolve_time_dependent_segment
```

を Python/NumPy reference として追加する。

### 検証

各 step で、

```text
t
t + h/2
t + h/2
t + h
```

が評価されることを記録する。

cleanup 前後の指標を同時に取得する。

## A2: 可換 Gaussian trajectory

$$
H(t)=\frac{\Omega(t)}2\sigma_x
$$

について、

$$
U(t)
=
\exp\left[
-\frac{i\sigma_x}{2}
\int_0^t\Omega(s)ds
\right]
$$

との全 trajectory 比較を行う。

### 指標

- maximum element error
- Frobenius error
- trace distance
- Bloch vector error
- observed convergence order
- raw cleanup correction norm

- **observed convergence order**: 刻みを細かくしたときに誤差が何次で減少するかを数値から推定した値。

## A3: 矩形パルスと Rabi 振動

共鳴条件、

$$
\Delta=0,
\qquad
\phi=0
$$

で、

$$
P_1(t)
=
\sin^2\left(\frac{\Omega_0t}{2}\right)
$$

と比較する。

- $X_\pi$
- $X_{\pi/2}$
- 2周期以上の Rabi oscillation
- pulse 終了後の idle 状態保持

## A4: Gaussian 有限区間正規化

- $\tau_p=2N_{\mathrm{trunc}}\sigma$ の検証
- target-angle mode
- peak-amplitude mode
- $3\sigma,4\sigma,5\sigma$ 切断比較
- pulse area と回転角の一致

## A5: phase と detuning

### phase

- $\phi=0$: $+x$
- $\phi=\pi/2$: $+y$
- $\phi=\pi$: $-x$
- $\phi=-\pi/2$: $-y$

人口だけでなく、

- $\rho_{01}$ の複素位相
- $\langle\sigma_x\rangle$
- $\langle\sigma_y\rangle$
- rotating-frame Bloch trajectory

を比較する。

### detuning

矩形パルスで、

$$
\Omega_{\mathrm{eff}}
=
\sqrt{\Omega^2+\Delta^2}
$$

を用いた解析解と比較する。

正負の $\Delta$ を用い、人口が同じでも coherence phase と Bloch trajectory が異なることを確認する。

## A6: 散逸と pulse 後 idle

$$
\frac{d\rho}{dt}
=
-i[H_{\mathrm{rot}}(t),\rho]
+
\mathcal D[L_\downarrow]\rho
+
\mathcal D[L_\uparrow]\rho
+
\mathcal D[L_\phi]\rho
$$

を計算する。

### 検証

- pulse 中の driven open-system trajectory
- pulse 終了後の idle relaxation
- `physical` mode
- `direct_rates` mode
- `fidelity_to_closed_pulse_trajectory`
- `final_state_fidelity_to_target`
- cleanup 前 physicality

駆動中の人口を単純な熱平衡式へ直接比較しない。

## A7: PULSE-CONV-2LEVEL

UI の既定 step policy を決める前に実施する。

### 対象

1. 可換 Gaussian Hamiltonian
2. detuned rectangular pulse
3. Gaussian + dissipation
4. pulse 後 idle

### 無次元指標

```text
h * max(G_H)
h / sigma
h * G_D
```

### 出力

- error vs step
- observed order
- raw physicality
- cleanup correction
- runtime
- 推奨 $\varepsilon_H,\varepsilon_D,N_\sigma$

## A8: QuTiP 二準位比較

同一の、

$$
\rho(0),
\quad
H(t),
\quad
L_k,
\quad
t_j
$$

を QuantaScope と QuTiP に渡す。

対象:

- Gaussian 共鳴 pulse
- phase pulse
- 正負 detuning
- 散逸あり pulse
- pulse 後 idle

## A9: gate-level 対応

- $X_\pi$: 現行 X gate と比較
- $X_{\pi/2}$: 独立 unitary と比較
- $Y_\pi$: 独立 unitary と比較
- $Y_{\pi/2}$: 独立 unitary と比較

比較経路:

```text
closed two-level pulse
closed gate-level effective Hamiltonian
independent target unitary
```

現行未対応の RX、RY gate が実装済みであるかのように記述しない。

## A10: Baseline A 凍結

- API schema を version 固定
- 二準位検証報告書を作成
- model limitations を明記
- V1 から V7 と A0 から A9 を再実行

この時点で Pulse Baseline A を完了とする。

---

# 13. Pulse Extension B

Pulse Extension B は、三準位 transmon、leakage、qutrit 散逸、DRAG を追加する段階である。

## B0: qutrit 基底と adapter

- 3×3 density matrix
- $a,a^\dagger,n$
- `subsystem_dimensions=(3,)`
- QuTiP adapter の一般化
- `anharmonicity_mhz` から内部 $\alpha$ への変換

### 検証

- $a|1\rangle=|0\rangle$
- $a|2\rangle=\sqrt2|1\rangle$
- $n|j\rangle=j|j\rangle$
- $-250\ \mathrm{MHz}\to-1570.7963\ \mathrm{rad}/\mu\mathrm{s}$

## B1: 閉じた qutrit 駆動と leakage

### 検証

- $\Omega\to0$ で自由発展
- 弱い pulse で二準位モデルへ近づく
- 強い pulse で leakage が増える条件
- $|\alpha|$ を大きくしたとき leakage が減る条件
- $P_0+P_1+P_2=1$

「増える」「減る」は固定条件下の比較結果として報告し、普遍的な実機性能とは主張しない。

## B2: qutrit 散逸

本計画第4節の規約を実装する。

### 検証

- $|1\rangle$ の $1\to0$ 指数緩和
- $|2\rangle$ の $2\to1$ 指数緩和
- 各遷移の詳細釣り合い
- 有限温度 Gibbs population
- $\rho_{01},\rho_{12},\rho_{02}$ の解析減衰率
- pulse 中と pulse 後 idle の leakage 変化

## B3: PULSE-CONV-QUTRIT

UI 実装より前に実施する。

### 対象

1. qutrit free phase evolution
2. qutrit Gaussian leakage
3. qutrit + dissipation

DRAG is intentionally excluded here because it is introduced in B4. B4 must
run its own DRAG on/off convergence checks after the base qutrit step policy is
established.

### 刻み条件

- $h\max G_H$
- $h/\sigma$
- $hG_D^{(3)}$

を記録する。

$\alpha$ を含む spectral diameter に対して収束することを確認する。

## B4: DRAG

$$
\Omega_y(t)
=
\beta\frac{d\Omega_x(t)}{dt}
$$

を実装する。

### parameter sweep

- **parameter sweep**: パラメータを複数値へ変えて結果を比較する方法。

```text
drag_beta_us
```

を複数値で走査し、

- maximum leakage
- leakage at pulse end
- target fidelity
- phase error

を同時に評価する。

少なくとも一つの固定条件で、適切な $\beta$ により Gaussian 単独より leakage が低下することを確認する。

DRAG on/off の刻み細分化もこのPhaseで実施し、B3のqutrit step policyで
十分か、追加のderivative解像条件が必要かを判定する。

## B5: QuTiP qutrit 比較

同じ 3×3 Hamiltonian、collapse operator、初期状態、時刻列を QuTiP へ渡す。

対象:

- closed Gaussian qutrit pulse
- leakage trajectory
- qutrit dissipation
- DRAG on/off
- pulse 後 idle

## B6: Pulse Lab UI

PULSE-CONV-2LEVEL と PULSE-CONV-QUTRIT が完了するまで、通常利用者向けの既定 step policy を UI へ固定しない。

UI は独立画面、

```text
Pulse Lab / Experimental
```

とする。

### 入力

- model ID
- initial state
- pulse shape
- amplitude mode
- target angle または peak amplitude
- $\sigma$
- truncation
- total simulation time
- phase
- detuning
- environment input mode
- transmon anharmonicity
- DRAG beta
- expert internal-step cap

### 可視化

- rotating-frame Bloch trajectory
- $\Omega_x(t),\Omega_y(t)$
- $P_0(t),P_1(t),P_2(t)$
- leakage
- fidelity 指標
- raw/clean physicality
- pulse active / idle 区間
- internal-step diagnostics

### 表示上の注意

```text
rotating-frame RWA control-envelope experimental model
```

を常時表示し、hardware-calibrated pulse reproduction と誤解させない。

## B7: Extension B 凍結

- qutrit API schema を version 固定
- B0 から B6 の統合検証報告書を作成
- Baseline A と V1 から V7 を再実行
- model limitations を更新

この時点で Pulse Extension B を完了とする。

---

# 14. テスト・成果物

各検証で次を生成する。

```text
validation_results/
  pulse_<id>.json
  pulse_<id>.csv
  pulse_<id>_trajectory.png
  pulse_<id>_error.png
  pulse_<id>_convergence.png

docs/validation/
  pulse-<id>-report.md
```

各 JSON へ次を含める。

```text
base_git_commit
python_version
numpy_version
scipy_version
qutip_version
model_id
frame
approximation
input_payload
internal_units
step_policy
cleanup_policy
tolerances
pass_fail
scope_and_limitations
```

- **scope**: 検証が対象とする範囲。
- **limitation**: 検証またはモデルが対象としない制限事項。

---

# 15. 回帰条件

各 milestone 完了時に次を実行する。

1. V1 から V7
2. 完了済み Pulse validation
3. API schema test
4. frontend build
5. NumPy/Python reference 一致
6. QuTiP comparison
7. `git diff --check`

- **regression**: 変更によって既存機能が壊れること。

許容誤差は、結果を通すために黙って緩めない。変更する場合は、理由、旧値、新値、影響を報告する。

---

# 16. 完了条件

## 16.1 Pulse Baseline A 完了条件

- rotating frame、RWA、detuning、phase、単位が固定されている
- constant path と time-dependent path が分離されている
- Gaussian の解析 trajectory と一致する
- square、Gaussian、phase、detuning が検証済み
- physical/direct-rate environment が分離されている
- pulse 中の散逸と pulse 後 idle が検証済み
- PULSE-CONV-2LEVEL が完了している
- QuTiP 二準位比較が成功している
- V1 から V7 が維持されている

## 16.2 Pulse Extension B 完了条件

- qutrit Hamiltonian と非調和性単位が固定されている
- $|2\rangle$ leakage が保存・表示される
- qutrit 散逸規約が解析解で検証されている
- qutrit dephasing model の制約が表示される
- PULSE-CONV-QUTRIT が完了している
- DRAG による leakage 低減を固定条件で確認している
- QuTiP qutrit 比較が成功している
- Pulse Lab UI が近似と単位を正しく表示する
- Baseline A と V1 から V7 が維持されている

---

# 17. 本 Phase が証明しないこと

Pulse Extension B まで完了しても、次は証明しない。

- GHz 搬送波を直接時間分解した laboratory-frame 再現
- 特定メーカーまたは特定デバイスへの校正済み再現
- 多量子ビット pulse-level entangling gate の実機再現
- cross-talk
- 周波数依存 noise spectrum
- 非 Markov 環境
- 強結合環境
- 任意有限 RK4 step の厳密 CPTP 性
- readout resonator の詳細モデル
- 3準位を超える高励起状態の leakage

- **cross-talk**: ある制御信号が意図しない別の量子ビットや準位へ影響すること。
- **noise spectrum**: noise 強度を周波数ごとに表したもの。
- **readout resonator**: 超伝導量子ビットの状態読み出しに使う共振器。

UI と報告書では、

```text
pulse-level hardware reproduction
```

ではなく、

```text
rotating-frame RWA control-envelope experimental model
```

と表記する。

---

# 18. CPTP Phase と Rust Phase への接続

## 18.1 CPTP Phase

Pulse Phase は連続時間 segment を担当する。

CPTP Phase では、

- measurement
- reset
- calibrated discrete noise channel
- Kraus map

を event として追加する。

```text
pulse continuous segment
        ↓
strict CPTP discrete event
        ↓
next continuous segment
```

有限 RK4 step を厳密 CPTP map と呼ばない。

## 18.2 Rust Phase

Rust 移植は次の順で行う。

1. Python/NumPy reference の入出力を固定
2. envelope を callback ではなく列挙型と parameter で表現
3. Rust 側で各 RK4 stage の $H(t)$ を構成
4. stage ごとの微分を比較
5. cleanup 前後の指標を比較
6. 二準位と qutrit の最終状態を比較
7. Python/NumPy と一致後に production backend へ昇格

- **enum**: 取り得る種類をあらかじめ列挙したデータ型。
- **production backend**: 通常利用で正式に使う計算実装。

---

# 19. 推奨開発順序

```text
現在の gate-level V1-V7 を基準として凍結
        ↓
Pulse Baseline A
  A0  physics / units / API specification
  A1  time-dependent NumPy reference path
  A2  analytic Gaussian trajectory
  A3  square / Rabi
  A4  finite Gaussian normalization
  A5  phase / detuning
  A6  dissipation + post-pulse idle
  A7  PULSE-CONV-2LEVEL
  A8  QuTiP two-level comparison
  A9  gate-level / target-unitary comparison
  A10 baseline report and freeze
        ↓
Pulse Extension B
  B0  qutrit basis / unit conversion / QuTiP dims
  B1  closed qutrit + leakage
  B2  qutrit dissipation
  B3  PULSE-CONV-QUTRIT
  B4  DRAG
  B5  QuTiP qutrit comparison
  B6  Pulse Lab UI / visualization
  B7  extension report and freeze
        ↓
strict CPTP Phase
        ↓
Rust time-dependent backend Phase
        ↓
final integrated physical/numerical validation report
```

---

# 20. 着手判定

Pulse Baseline A は、本計画書の規約で実装開始可能とする。

Pulse Extension B は、第4節の qutrit dissipation 規約、第6節の qutrit step policy、第10節の QuTiP dimensions 一般化を先にテスト仕様へ落とし込んだ後に着手する。

最初の実装作業は **A0: 仕様固定と既存経路保護** とする。
