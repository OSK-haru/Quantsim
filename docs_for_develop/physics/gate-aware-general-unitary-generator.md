# Gate-aware一般unitary generator v2

## 目的

従来のGate-awareモデルは、各回路列のunitary `U`がHermitianかつ `U^2=I` である場合に限り、有限時間Hamiltonianへ変換していた。これはH、X、Y、Z、CNOTには使えるが、S、T、一般の位相ゲートや任意角回転には使えない。

量子アルゴリズムで必要な非involutionゲートへ拡張するため、一般の有限次元unitaryからHermitian generatorを構成する。

## 一般式

有限次元unitaryはspectral theoremにより

```text
U = sum_k exp(i theta_k) P_k
```

と書ける。`theta_k`を主値 `(-pi, pi]` から選び、ゲート時間を`tau`とすると、

```text
H_eff = -sum_k (theta_k / tau) P_k
```

と定義できる。このとき

```text
exp(-i H_eff tau) = U
```

が成立する。実装では小行列の固有値分解を行い、構成後にHermitian化とunitary再構成誤差を監査する。非unitary入力や条件の悪い固有系は黙って使用せず拒否する。

## 従来モデルとの互換性

Hamiltonianの対数は一意ではなく、固有位相へ`2*pi*n`を加えたgeneratorも同じ終端unitaryを与える。そのためgeneratorを変更すると、終端状態は同じでもゲート途中のBloch軌道が変わり得る。

既存のH/X/Z/CNOT監査を維持するため、Hermitian involutionでは従来式

```text
H_eff = pi/(2*tau) * (I-U)
```

をそのまま使う。非involutionだけが主固有位相generatorを使用する。診断IDは`effective_unitary_spectral_generator_v2`、互換分岐は`involution_compatibility_branch=true`として開示する。

## 追加ゲート

| Gate | Matrix / action | Default duration | 扱い |
|---|---|---:|---|
| Y | Pauli-Y | `0.02 us` | Xと同じ有限時間gate |
| S | `diag(1,i)` | `0 us` | 既定はVirtual-Z相当 |
| T | `diag(1,exp(i*pi/4))` | `0 us` | 既定はVirtual-Z相当 |

H、T、CNOTが利用できるため、離散ゲート列として普遍的な量子計算を近似できる基礎が整う。S/Tへ正の`duration_us`を指定すれば、一般generatorによる有限時間発展と、その間のLindbladノイズも計算する。

## Gate-awareで表す物理と表さない物理

この変更後もGate-awareは、理想unitaryを有限時間の有効Hamiltonianへ埋め込み、その間に環境由来の緩和・熱励起・位相緩和を作用させる教育用モデルである。

表せるもの:

- gate種類とgate時間によるノイズ曝露時間の違い
- 位相ゲートを含むalgorithm全体のopen-system劣化
- zero-noise limitでの理想回路との一致
- 回路列途中の密度行列、Bloch成分、忠実度

表さないもの:

- 実際のmicrowave waveform、DRAG、伝達関数
- transmonの高準位leakage
- gate固有のcalibration error、crosstalk、周波数混雑
- 実機native gateへのcompiler decomposition

これらはPulse Labまたは将来のcompiler/device layerで扱い、Gate-awareの回路記憶とは分離する。

## 数値監査

- 既存involutionについて旧generatorと要素単位で一致
- S/Tについて`exp(-i H tau)`から元のunitaryを`1e-12`以下で再構成
- 非unitary入力を拒否
- zero-noiseの有限時間S回路で最終忠実度1
- Gate-aware RK4、Explicit CPTP、既存QuTiP比較の回帰を維持

主実装は`core/gates.py::effective_hamiltonian_from_unitary`、Gate-aware接続は`core/simulator.py::_effective_hamiltonian_cached`にある。
