# 2トランズモン結合Pulseモデル

## 目的と境界

Pulse Labで、局所Pulseが結合相手へ与える影響、`|10>`と`|01>`の励起交換、計算部分空間外への漏れを観察するためのモデルである。各トランズモンを3準位に打ち切るため、全Hilbert空間は `3 x 3 = 9` 次元になる。

実装は演算子のテンソル埋め込みを一般化しやすい形にしているが、公開APIは計算量を制御するため `N=2` に固定する。実機校正モデルではない。

## 出発点となる一般式

弱非調和振動子としてのトランズモンと、横方向の容量結合、古典driveを考える。`hbar = 1` とすると、lab frameの一般的な出発点は

```text
H_lab(t)
  = sum_i [omega_i n_i + alpha_i/2 n_i(n_i - 1)]
  + g (a_0 + a_0^dagger)(a_1 + a_1^dagger)
  + Omega(t) cos(omega_d t + phi)(a_k + a_k^dagger)
```

である。

- `a_i`, `a_i^dagger`: トランズモン `i` の消滅・生成演算子
- `n_i = a_i^dagger a_i`: 励起数演算子
- `omega_i`: `|0>-|1>` 角周波数
- `alpha_i < 0`: 非調和性
- `g`: 横方向結合
- `Omega(t)`: drive包絡
- `k`: drive対象

Duffing項 `alpha_i n_i(n_i-1)/2` は、準位エネルギーを `E_m = m omega_i + alpha_i m(m-1)/2` とする標準的な弱非調和振動子近似から来る。

## 回転座標系とRWAへの変形

drive周波数で回転する座標系へ移り、高速回転項を落とす。プロジェクトでは

```text
Delta_i = omega_d - omega_i
```

という符号規約を用いるため、局所対角項は

```text
H_local,i = -Delta_i n_i + alpha_i/2 n_i(n_i - 1)
```

となる。これは既存の単一qutritモデルの

```text
diag(0, -Delta_i, -2 Delta_i + alpha_i)
```

と同じ規約である。

結合項を展開すると `a_0 a_1`, `a_0 a_1^dagger`, `a_0^dagger a_1`, `a_0^dagger a_1^dagger` が現れる。RWAでは、和周波数付近で高速回転する同時生成・同時消滅項を落とし、励起数を保存する交換項を残す。

```text
H_exchange = J(a_0^dagger a_1 + a_0 a_1^dagger)
```

この変形を行う理由は、現在のPulse Lab全体が回転座標系RWAモデルであり、その近似階層を維持するためである。強結合・超短Pulse・lab-frame効果を扱う場合、この省略は再検討が必要になる。

I/Q driveは

```text
H_drive,k(t)
  = 1/2 [Omega_x(t)(a_k + a_k^dagger)
       + i Omega_y(t)(a_k - a_k^dagger)]
```

として局所部分系 `k` に作用させる。2チャネルを有効にした場合は

```text
H_drive(t) = H_drive,0(t) + H_drive,1(t)
```

とし、各チャネルが独立の包絡、位相、離調、DRAG係数を持つ。同時driveを1つの合成包絡へ潰さない理由は、異なる部分系へ作用するテンソル演算子とチャネル固有位相を保持するためである。Gaussian DRAGでは既存モデルと同じく

```text
Omega_Q(t) = beta d Omega_G(t) / dt
```

を用いる。

以上から、実装Hamiltonianは

```text
H(t)
  = sum_i [-Delta_i n_i + alpha_i/2 n_i(n_i - 1)]
  + J(a_0^dagger a_1 + a_0 a_1^dagger)
  + H_drive,k(t)
```

となる。

## 3準位への打ち切り

各局所演算子を

```text
a = [[0, 1, 0],
     [0, 0, sqrt(2)],
     [0, 0, 0]]
```

へ打ち切る。`sqrt(2)` は調和振動子の行列要素 `a|m> = sqrt(m)|m-1>` から来る。高い準位を捨てるのは計算量を `9 x 9` 密度行列に抑えながら、最低限のleakageを残すためである。強いdriveでは高準位省略が不正確になり得る。

テンソル積の基底順序は

```text
|00>, |01>, |02>, |10>, |11>, |12>, |20>, |21>, |22>
```

である。局所演算子は `q0` なら `A tensor I_3`、`q1` なら `I_3 tensor A` として埋め込む。

## 開放系

全密度行列は局所collapse演算子を用いたGKSL方程式で発展する。

```text
d rho/dt = -i[H(t), rho]
           + sum_i sum_mu D[L_(i,mu)] rho

D[L]rho = L rho L^dagger
          - 1/2 {L^dagger L, rho}
```

局所collapse演算子もHamiltonianと同じテンソル規則で埋め込む。現在はUIとAPIを小さく保つため、2つのトランズモンに同じrate profileを適用する。これは「両者の環境が物理的に同一」という一般論ではなく、入力契約を増やしすぎないMVP上の簡略化である。将来はtransmonごとのrateへ拡張する。

## 相関準静的離調ノイズ

ショット中に一定な離調ベクトルを

```text
delta = (delta_0, delta_1)^T ~ Normal(0, Sigma)
Sigma = [[sigma_0^2, r sigma_0 sigma_1],
         [r sigma_0 sigma_1, sigma_1^2]]
```

とする。独立標準正規変数 `z_0,z_1` からのCholesky変換

```text
delta_0 = sigma_0 z_0
delta_1 = sigma_1 [r z_0 + sqrt(1-r^2) z_1]
```

を使い、各軸3点または5点のGauss-Hermite求積をテンソル積する。したがって完全な9次元軌道を9本または25本計算し、`rho_bar(t) = E_delta[rho(t; delta)]` を密度行列レベルで作る。相関係数を後付けのdephasing rateへ変換しない理由は、準静的Gaussian減衰と一定rate Markov減衰の時間依存が異なるためである。

## Explicit CPTPとRust

`fixed_step_rk4`に加え、各区間のHamiltonianを中点で固定し、9次元GKSL generatorの指数写像を合成する`explicit_cptp`を選択できる。各有限時間mapについて81次元superoperatorのChoi行列を監査し、完全正値性とtrace preservationを確認する。時間依存性自体は中点区分一定近似である。

PythonとRustは同じHamiltonian、collapse演算子、step境界を受け取る。Rust RK4は9次元密度行列のstage計算をdense kernelで行い、Rust CPTPは81次元GKSL superoperatorの指数・合成を行う。`auto`はRust moduleが利用可能ならRust、なければPythonへ解決する。物理式をbackendごとに変更しない。

## leakageと表示量

計算部分空間を

```text
C = span{|00>, |01>, |10>, |11>}
```

とし、leakageを

```text
P_leak = 1 - sum_(s in C) <s|rho|s>
```

で定義する。返却するpurityは9次元の完全な密度行列に対する `Tr(rho^2)` であり、計算部分空間へ再正規化しない。

## 数値step制約の根拠

単一qutritのHamiltonian・散逸・Gaussian幅から得るstep上限に加え、交換結合に

```text
h <= epsilon_J / (4 |J|),  epsilon_J = 0.02
```

を課す。3準位打ち切り後の交換演算子の固有値幅は最大 `4|J|` なので、1 step当たりの最大結合位相を概ね `0.02` 以下へ抑える保守的条件である。これは新しい物理法則ではなく、固定step RK4の離散化誤差を制御する数値条件である。

## 現在の制限

- 2トランズモン、各3準位に固定
- 結合は固定exchange couplingのみ
- 個別環境rate、相関散逸、crosstalk、transfer function、tunable couplerなし
- 実機校正値ではない

数値監査結果は[`../validation/pulse-transmon-pair-numerical-audit.md`](../validation/pulse-transmon-pair-numerical-audit.md)を参照する。

次の拡張では、同じ一般式の `sum_i` と結合graph `sum_(i,j)` を保持したまま、transmon配列とcoupling edge配列をAPI契約へ昇格させる。
