# VALIDATION-3: Excited-state exponential decay

## Codexへの指示

QuantaScopeのLindblad時間発展について、初期状態 \(|1\rangle\) の励起状態占有確率が、純粋な下向き緩和のみの条件で既知の指数関数に従うことを検証してください。

この検証は、環境入力の妥当性ではなく、**既知の散逸率を与えたときのLindbladソルバーとcollapse operator実装**を解析解と比較するものです。

結果を合わせるためにproduction physicsを変更してはいけません。失敗した場合は誤差と原因候補を記録してください。

---

## 1. 検証する物理系

一量子ビットを用います。

初期状態:

```text
rho(0) = |1><1|
```

Hamiltonian:

```text
H = 0
```

collapse operator:

```text
L_down = sqrt(gamma_down) * sigma_minus
```

無効化するもの:

```text
gamma_up = 0
gamma_phi = 0
all gates = none
measurement noise = none
additional channels = none
```

このとき解析解は

```text
P1(t) = rho_11(t) = exp(-gamma_down * t)
P0(t) = rho_00(t) = 1 - exp(-gamma_down * t)
rho_01(t) = rho_10(t) = 0
```

です。

ここでは

```text
gamma_population_relaxation_per_us = gamma_down_per_us
T1 = 1 / gamma_down_per_us
```

です。これは `gamma_up=0` の特殊条件だから成立します。有限温度一般では `1/T1 = gamma_down + gamma_up` であることを報告書に明記してください。

---

## 2. 検証の分離

### 主検証

既知のrateを直接指定し、温度・device quality・flux noiseからの変換を介さずにソルバーを検証してください。

利用可能な既存のdirect-rate入力経路があれば使用してください。

存在しない場合:

- production UIを変更しない。
- テスト専用fixtureまたは低レベルsolver entry pointを使う。
- production rate conversionを書き換えない。
- 追加したテスト用経路が本番APIへ露出しないようにする。

### 補助検証

可能であれば、physical modeの `T=0` から得た `gamma_down` を読み取り、同じ解析式と比較するend-to-endケースを一つ追加してください。

ただし、profile由来の `gamma_phi` が残る場合でも、初期状態が対角なので占有確率には影響しません。それでも主検証では `gamma_phi=0` を明示して、純粋な下向き緩和を隔離してください。

---

## 3. 時間とrateのテスト行列

少なくとも次を検証してください。

| Case | `gamma_down_per_us` | `T1` | 観測時間 |
|---|---:|---:|---:|
| V3-1 | `0.01` | `100 us` | `0 ... 500 us` |
| V3-2 | `0.05` | `20 us` | `0 ... 100 us` |
| V3-3 | `0.10` | `10 us` | `0 ... 50 us` |

各ケースで、少なくとも次の無次元時刻を含めてください。

```text
t/T1 = 0, 0.25, 0.5, 1, 2, 3, 5
```

snapshot request機構を利用できる場合、これらの時刻をcustom snapshotとして指定してください。

`requested_time_us` と実際の `time_us` が異なる場合は両方を記録し、解析解は実際の `time_us` で評価してください。補間した密度行列を作らないでください。

---

## 4. 独立解析解

解析解はproduction solver、RK4、collapse operator生成関数を再利用せず、検証コード内の単純な式で計算してください。

```python
expected_p1 = math.exp(-gamma_down_per_us * time_us)
expected_p0 = 1.0 - expected_p1
```

reference側でproductionの時間発展関数を呼び出してはいけません。

---

## 5. 比較量

各snapshotで次を記録してください。

```text
time_us
requested_time_us
t_over_t1
simulated_p1
analytic_p1
absolute_error_p1
relative_error_p1
simulated_p0
analytic_p0
absolute_error_p0
rho01_abs
rho10_abs
trace_error
hermiticity_error
minimum_eigenvalue
```

ケース全体では次を集計してください。

```text
max_abs_error_p1
rmse_p1
max_abs_error_p0
max_off_diagonal_abs
max_trace_error
max_hermiticity_error
minimum_density_eigenvalue
```

さらに、ゼロでない範囲について

```text
log(P1(t)) = -gamma_down * t
```

を最小二乗で当てはめ、

```text
fitted_gamma_down_per_us
relative_gamma_fit_error
```

を記録してください。

`P1` が丸め誤差レベルまで小さくなった点は対数fitから除外してください。

---

## 6. 許容誤差

既存のRK4精度と内部substep方針を監査したうえで、根拠のある許容誤差を定めてください。

初期候補:

```text
max_abs_error_p1 <= 1e-6
rmse_p1 <= 1e-7
max_off_diagonal_abs <= 1e-10
trace_error <= 1e-10
hermiticity_error <= 1e-10
minimum_eigenvalue >= -1e-10
relative_gamma_fit_error <= 1e-4
```

既存実装の精度が十分高い場合は厳しくしてよいです。

許容誤差を結果を見て恣意的に緩めないでください。変更する場合は理由を報告書に記録してください。

---

## 7. 物理健全性チェック

各ケースで次を確認してください。

### 7.1 初期条件

```text
P1(0) = 1
P0(0) = 0
```

### 7.2 単調性

```text
P1(t) は非増加
P0(t) は非減少
```

浮動小数点誤差分の小さな許容幅を設けてください。

### 7.3 T1点

```text
P1(T1) = e^-1
```

### 7.4 長時間極限

```text
P1(5*T1) ≈ e^-5
P0(5*T1) ≈ 1 - e^-5
```

### 7.5 密度行列

```text
trace = 1
Hermitian
positive semidefinite within tolerance
off-diagonal elements remain zero
```

### 7.6 collapse operator監査

実際に生成されたoperatorが

```text
sqrt(gamma_down) * sigma_minus
```

であり、upward operatorとdephasing operatorが存在しないことを確認してください。

bit/basis conventionにより `sigma_minus` が逆向きになっていないことを、初期 \(|1\rangle\) が \(|0\rangle\) へ減衰する結果から確認してください。

---

## 8. 時間刻みについて

VALIDATION-6で本格的な収束検証を行うため、今回は主目的を指数減衰への一致に限定します。

ただし、代表ケースV3-1について、通常設定とより細かい内部刻みの結果が大きく異ならないことを補助的に確認してください。

注意:

- publicな `time_steps` が出力snapshot数にしか影響しない場合、それを収束検証と呼ばない。
- 実際のRK4内部step幅を変更できる設定を監査する。
- 内部step幅を変更できない場合、その事実を報告するだけでよい。

---

## 9. 図の生成

実際の計算結果として、少なくとも次のPNGを生成してください。

```text
validation_results/validation3_excited_state_decay.png
```

図には次を含めます。

- 横軸 `t / T1`
- 縦軸 `P1(t)`
- QuantaScope numerical result
- analytic `exp(-t/T1)`
- 各gammaケース
- 凡例
- 軸ラベル
- タイトル

図またはキャプションに必ず

```text
Actual calculation result / 実際の計算結果
```

と明記してください。

可能なら誤差図も別ファイルで生成してください。

```text
validation_results/validation3_excited_state_decay_error.png
```

図の生成は検証結果の可視化であり、production UIの変更ではありません。

---

## 10. 成果物

次を追加してください。

```text
tests/test_validation_excited_state_exponential_decay.py
scripts/validate_excited_state_exponential_decay.py
docs/validation/validation-3-excited-state-exponential-decay.md
validation_results/validation3_excited_state_decay.json
validation_results/validation3_excited_state_decay.csv
validation_results/validation3_excited_state_decay.png
```

CSVは各snapshotを1行にしてください。

JSONには少なくとも次を含めます。

```json
{
  "validation": "VALIDATION-3",
  "model": "one-qubit amplitude damping",
  "initial_state": "|1>",
  "hamiltonian": "zero",
  "gamma_up_per_us": 0.0,
  "gamma_phi_per_us": 0.0,
  "analytic_solution": "P1(t)=exp(-gamma_down*t)",
  "cases": [],
  "overall_pass": true
}
```

---

## 11. 報告書に書く内容

### Purpose

初期励起状態の占有確率が解析的指数減衰に一致するかを確認する。

### Convention

```text
gamma_down: downward transition rate
at gamma_up=0, T1=1/gamma_down
at finite temperature, T1_eff=1/(gamma_down+gamma_up)
```

### Method

- direct known rate
- no gates
- H=0
- one collapse operator
- independent analytic formula

### Results

- rateごとの最大誤差
- fitしたrate
- T1点
- 長時間値
- 物理健全性

### Scope

この検証が証明するもの:

```text
下向きcollapse operatorとLindblad時間発展が解析的amplitude dampingを再現すること
```

この検証が証明しないもの:

```text
温度からrateへの変換全体
finite-temperature equilibrium
pure dephasing convention
QuTiP一致
実機校正
```

---

## 12. 禁止事項

- 結果を通すためproduction solverを変更しない。
- 解析解側でproduction integratorを使わない。
- finite-temperatureの一般式とzero-temperatureの特殊式を混同しない。
- `gamma1_per_us` を新規コードで使用しない。
- 確率だけを比較して密度行列健全性を省略しない。
- 失敗ケースを削除しない。
- 誤差の大きい時刻を恣意的に除外しない。

---

## 13. 実行コマンド

Windows PowerShell向けに、実際のリポジトリ構成に合わせてコマンドを記載してください。例:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_excited_state_exponential_decay
.\.venv\Scripts\python.exe scripts\validate_excited_state_exponential_decay.py
```

---

## 14. 完了条件

- 3種類以上の `gamma_down` で解析解に一致する。
- `P1(T1)=e^-1` を確認する。
- fitから得た減衰率が入力rateに一致する。
- off-diagonal成分が0のまま保たれる。
- trace、Hermiticity、positivityが保たれる。
- collapse operatorの向きが正しい。
- JSON、CSV、実計算図、Markdown報告書が再生成可能である。
- 既存のVALIDATION-1、VALIDATION-2および全回帰テストが通る。
- production physicsに変更がない、または変更が必要だった場合は検証失敗として明示される。
