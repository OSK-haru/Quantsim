# 2トランズモン Pulseモデル：QuTiP独立比較監査 v2（廃止モデルの記録）

> **記録用。** 対象モデルは廃止され、ネットワークモデルへ統合された。本文が
> 挙げる `scripts/validate_pulse_transmon_pair_qutip.py`、
> `validation_pulse/transmon_pair_qutip.py`、および
> `validation_results/pulse_transmon_pair_qutip_audit.{json,csv}` はモデルと
> 一緒に削除済みで、再実行はできない。現行の結合ネットワークに対する同種の
> 独立比較は `validation_pulse/transmon_network_qutip.py` と
> `tests/test_pulse_transmon_network_qutip.py` にあり、RK4・明示的CPTPとも
> PASS している。

## 結論

`driven_coupled_transmon_pair_rwa_experimental_v1` を、QuTiP 5.2.3で独立に再構成した参照モデルと比較した。事前に固定した7ケース、93チェックポイントはすべて合格した。

- 最大密度行列要素差: `1.50715459732017e-7`
- 最大Frobenius差: `4.022127354496616e-7`
- 最大trace distance: `2.852272379730294e-7`
- 最大population差: `7.094204972774021e-8`
- 最大leakage差: `9.048294535851653e-8`
- 本体solver: Rust固定刻みRK4
- 参照solver: QuTiP `mesolve` / adaptive DOP853

この結果は、現在の方程式に対する数値実装の一致を示す。実機transmonの校正精度や、RWA・3準位打ち切りそのものの物理的妥当性を保証するものではない。

## 監査範囲

| ケース | 対象 | 事前許容値 | 最大要素差 | 最大leakage | 結果 |
|---|---|---:|---:|---:|---|
| `sweep_uncoupled_resonant` | `J=0`, 共鳴 | `2e-6` | `5.462e-10` | `0.1459` | PASS |
| `sweep_moderate_exchange_detuned` | `J=8`, 離調あり | `2e-6` | `5.045e-10` | `0.1455` | PASS |
| `sweep_strong_exchange_opposite_detuning` | `J=30`, 符号の異なる離調 | `2e-6` | `3.816e-10` | `0.1559` | PASS |
| `nonzero_dissipation_long_idle` | 非ゼロ散逸、長いidle | `8e-6` | `1.356e-9` | `0.0281` | PASS |
| `simultaneous_two_channel_drag` | 同時2drive、位相、DRAG | `1.2e-5` | `1.507e-7` | `0.1267` | PASS |
| `strong_drive_high_leakage` | 強drive、高leakage | `2e-5` | `1.677e-9` | `0.9399` | PASS |
| `correlated_quasi_static_ensemble` | 相関準静的ノイズ、9標本 | `1.2e-5` | `5.204e-10` | `0.1166` | PASS |

強driveケースでは、計算基底外populationが最大約94%まで上がる意図的なstress条件を使った。したがって、今回の一致は低leakage近似領域だけの結果ではない。ただし、この領域では3準位より上の実準位が無視できないため、実機予測値としては使えない。

## QuTiPとの仕様差をどう合わせたか

### 1. 基底順序とtensor順序

本体は

```text
|00>, |01>, |02>, |10>, |11>, |12>, |20>, |21>, |22>
```

の順で9次元行列を保持する。QuTiP側は `tensor(q0, q1)` と `dims=[[3,3],[3,3]]` を使った。この場合も右側の `q1` が速く変化するため、行列の置換や転置をせず直接比較できる。

### 2. 単位系

本体の内部単位は時間 `us`、角周波数 `rad/us`、散逸率 `1/us` である。QuTiPは単位を自動変換しないため、時刻配列をそのまま `us` とみなし、Hamiltonian係数を `rad/us`、collapse係数を `sqrt(1/us)` で渡した。

入力の非調和性はMHzなので、両側で

```text
alpha[rad/us] = 2*pi*alpha[MHz]
```

とした。`1 MHz = 1 cycle/us` であるためである。

### 3. 回転座標系、離調、非調和性

各transmonの局所Hamiltonianは一般的なDuffingモデルを回転座標系・RWAへ移した

```text
H_i = -Delta_i n_i + (alpha_i/2) n_i(n_i-I)
```

を使う。ここで `Delta=omega_drive-omega_01` と定義するため、number項は `-Delta*n` になる。QuTiP側でも3×3行列をコピーせず、この演算子式から独立に構築した。レベルエネルギーは `0, -Delta, -2Delta+alpha` となる。

### 4. I/Q driveと位相の符号

本体の局所driveは

```text
H_drive = [(Omega_x-i*Omega_y)a + (Omega_x+i*Omega_y)a.dag()]/2
```

である。QuTiP側では同値な

```text
Omega_x*(a+a.dag())/2 - i*Omega_y*(a-a.dag())/2
```

として構築した。特にY成分の符号を明示的に合わせた。位相とDRAG直交成分は、まず `I=Omega(t)`, `Q=beta*dOmega/dt` を作り、その後

```text
Omega_x = I*cos(phi) - Q*sin(phi)
Omega_y = I*sin(phi) + Q*cos(phi)
```

で回転した。

### 5. GaussianとDRAG

Gaussianは中心を `k*sigma`、有限supportを `[0, 2*k*sigma]` とし、target angleからpeakを

```text
Omega_peak = theta / [sigma*sqrt(2*pi)*erf(k/sqrt(2))]
```

で求める。QuTiP側は本体のenvelopeクラスを呼ばず、この式と

```text
dOmega/dt = -((t-t_center)/sigma^2)*Omega(t)
```

を再実装した。support端を含める規約も一致させた。

### 6. 交換結合

2transmon間はRWA下の励起数保存型

```text
H_J = J*(a0.dag()*a1 + a0*a1.dag())
```

を使った。入力 `J` はすでに `rad/us` なので、QuTiP側で `2*pi` や `1/2` を追加していない。

### 7. collapse演算子

各transmonへ次を独立に埋め込んだ。

```text
sqrt(gamma_10) |0><1|
sqrt(gamma_01) |1><0|
sqrt(gamma_21) |1><2|
sqrt(gamma_12) |2><1|
sqrt(2*gamma_phi) n
```

QuTiPのLindblad dissipatorは `D[L]rho = L rho L.dag() - {L.dag()L,rho}/2` である。`L=sqrt(2*gamma_phi)n` とすると、隣接準位coherence `rho_01`, `rho_12` の純粋位相緩和率が `gamma_phi` になり、`rho_02` は準位差の二乗により `4*gamma_phi` で減衰する。本体のrate定義とこれを一致させた。

### 8. 相関準静的ノイズ

一般的な二変量正規分布から、独立標準正規変数 `z0,z1` に対して

```text
delta0 = sigma0*z0
delta1 = sigma1*(r*z0 + sqrt(1-r^2)*z1)
```

とするCholesky変換を使った。期待値は各軸3点のGauss-Hermite、合計9標本で評価した。QuTiP監査側は本体の標本生成関数を使わず、node、weight、`sqrt(2)`による標準正規への変換から再生成した。これにより、同じ確率分布と離散積分規約を合わせつつ、実装は独立にした。

### 9. solverとvectorization

本体は固定刻みRK4で、観測点においてHermitian化・trace正規化・微小負固有値のcleanupを行う。QuTiPはadaptive DOP853、`atol=rtol=1e-12`、`normalize_output=False` とし、本体のcleanupを適用していない。QuTiPの最大刻みはGaussianで少なくとも `sigma/64`、squareで `duration/128`、さらにHamiltonian scaleから制約した。

QuTiPと本体ではsuperoperatorのvectorization順序が異なり得る。そのため、Liouvillian配列を直接比較せず、同じ初期密度行列を同じ時刻まで発展させた9×9密度行列を比較した。これは転置規約の見かけの差を避けつつ、実際の物理写像を比較する方法である。

## 監査中に検出・修正した不具合

一様観測時刻とpulse終端が浮動小数点精度内で重なると、idle segmentへ同じ時刻が2回渡される場合があった。これは物理モデルではなくcheckpoint境界処理の不具合で、`checkpoint_times_us must be strictly increasing` により実行が停止していた。

時刻列を `1e-14 us` の許容差で正規化し、segment分割後にも狭義単調増加を保証するよう修正した。回帰テストを追加している。

## 再現方法

```powershell
.venv\Scripts\python.exe scripts\validate_pulse_transmon_pair_qutip.py
```

生成物:

- `validation_results/pulse_transmon_pair_qutip_audit.json`: 条件、version、全体集計、仕様対応表
- `validation_results/pulse_transmon_pair_qutip_audit.csv`: 93チェックポイントの誤差と物理性指標

監査コードは `validation_pulse/transmon_pair_qutip.py` にあり、QuTiP側のHamiltonian、collapse演算子、Gaussian、DRAG、準静的noiseを公開request仕様から独立構成している。
