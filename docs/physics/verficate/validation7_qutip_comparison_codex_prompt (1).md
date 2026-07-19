# VALIDATION-7: QuTiPとの同一条件比較 実装指示

## 使用モデル

このタスクは **GPT-5.5 Codex** で実施してください。

## 目的

QuantaScopeの現行LindbladソルバーとQuTiPの `mesolve` に、**完全に同一の数学的入力**を与え、各時刻の密度行列が数値許容誤差内で一致するか検証してください。

比較対象は次の4要素です。

\[
H,\qquad \rho(0),\qquad \{t_k\},\qquad \{L_j\}
\]

この検証の中心は、温度や磁束をQuTiPへ直接入力することではありません。

```text
QuantaScopeの物理入力
        ↓
QuantaScopeの既存変換層
        ↓
H、初期密度行列、時刻、collapse operators
        ├─ QuantaScope solver
        └─ QuTiP mesolve
```

QuTiP側で温度、周波数、`device_quality`、磁束ノイズ、\(T_1\)、\(T_\phi\)からrateを再計算してはいけません。QuantaScopeが生成した行列とrateを、そのままQuTiPへ渡してください。

---

# 1. 最重要の禁止事項

1. **本番の物理式、rate規約、API、UI、solver defaultを変更しないこと。**
2. 結果を一致させる目的で、Hamiltonian、collapse operator、bit order、係数、単位を黙って変更しないこと。
3. QuTiP側で物理パラメータ変換を再実装しないこと。
4. QuTiPの `sigmam()`、`sigmap()` を無監査で使用しないこと。
5. 測定確率だけで合否を決めないこと。密度行列の複素要素を比較すること。
6. QuTiPの出力正規化で数値誤差を隠さないこと。
7. 不一致が出た場合、閾値を緩めてPASSにしないこと。原因候補と実測値を報告すること。

---

# 2. QuTiPをproduction依存にしない

QuTiPは検証専用依存として扱ってください。

推奨:

```text
requirements-validation.txt
```

または既存のdependency管理にvalidation extraがある場合は、そこへ追加してください。

例:

```text
qutip>=5.2,<6
```

ただし既存のPython、NumPy、SciPyとの依存衝突が生じる場合は、production環境を壊さず、専用venvを使用してください。

検証結果には必ず次を記録してください。

```text
Python version
QuTiP version
NumPy version
SciPy version
OS
Git commit
QuantaScope backend
```

QuTiPが未導入の場合、通常のproduction test全体を壊さないよう、QuTiP統合テストは明示的skip可能にしてください。一方、検証スクリプトを直接実行した場合は、必要なインストール方法を示して明確に失敗させてください。

---

# 3. 基底規約とbit orderの監査

## 3.1 QuTiPの演算子名を信用して変換しない

QuantaScopeでは、基底を

\[
|0\rangle=\begin{pmatrix}1\\0\end{pmatrix},\qquad
|1\rangle=\begin{pmatrix}0\\1\end{pmatrix}
\]

とし、下向き遷移を

\[
\sigma_-=|0\rangle\langle1|
=\begin{pmatrix}0&1\\0&0\end{pmatrix}
\]

として扱っている前提です。

QuTiPのspin operator名は、プロジェクトのground/excited状態の呼び方と見かけ上逆に見える場合があります。したがって主比較では、次のように**QuantaScopeの実行時行列から直接 `Qobj` を構築**してください。

```python
qutip.Qobj(
    numpy.asarray(quanta_matrix, dtype=complex),
    dims=[[2] * n_qubits, [2] * n_qubits],
)
```

主比較で次を再構成してはいけません。

```python
qutip.sigmam()
qutip.sigmap()
qutip.tensor(...)
```

これらは独立監査用に使用しても構いませんが、まず行列要素と作用を明示的に照合してください。

## 3.2 必須のbasis audit

次を自動テストしてください。

- `sigma_down @ |1> = |0>`
- `sigma_down @ |0> = 0`
- `sigma_up @ |0> = |1>`
- `sigma_up @ |1> = 0`
- `sigma_z |0> = +|0>`
- `sigma_z |1> = -|1>`
- QuantaScope行列を `Qobj.full()` へ戻したとき要素が一致する

## 3.3 多量子ビット順序

QuantaScopeは **q0をMSB** として扱います。

2量子ビットでは、基底順序を明示的に

```text
|00>, |01>, |10>, |11>
```

として監査してください。

次を確認してください。

- `|10>` の非ゼロindex
- q0へXを作用させた結果
- q1へXを作用させた結果
- CNOT(control=q0, target=q1)の全基底作用
- QuTiPへ渡したQobjの `dims`, `shape`, `full()`

多量子ビット比較でも、可能な限りQuantaScopeの完成済み行列を直接Qobj化し、QuTiP側のtensor順序による差を混入させないでください。

---

# 4. QuTiP solver設定

QuTiP側は `mesolve` を使用してください。

基準設定:

```python
options = {
    "store_states": True,
    "normalize_output": False,
    "progress_bar": False,
    "method": "dop853",
    "atol": 1e-12,
    "rtol": 1e-12,
    "nsteps": 100000,
}
```

必要なケースでは `max_step` を追加してください。

- idle解析ケースではadaptive solverの収束に任せてもよい
- 有限時間ゲート区間では、最短ゲート時間より十分細かい `max_step` を指定する
- 推奨値は `min(quanta_reference_step_us / 2, shortest_segment_us / 50)`

QuTiPの既定 `normalize_output=True` に依存せず、必ず `False` としてください。trace等の健全性は比較コードで独立に測定してください。

---

# 5. QuantaScope側の比較条件

VALIDATION-6で収束確認済みの経路を使用してください。

高精度比較では、QuantaScope側の最大内部RK4刻みを明示的に

```text
0.03125 us
```

または既存のVALIDATION-6 reference stepへ固定してください。

重要:

- `time_steps`だけを増やして内部刻みを細かくしたことにしない
- 実際のinternal substep capを固定する
- requested snapshot timeとactual timeを記録する
- QuTiPとQuantaScopeで同じ時刻を比較する

production defaultでの比較を追加してもよいですが、高精度比較とは別欄にしてください。

---

# 6. 比較用変換層

検証専用モジュールを作成してください。

例:

```text
validation/qutip_adapter.py
```

最低限、次の責務に分けてください。

```python
as_qutip_operator(matrix, n_qubits)
as_qutip_density_matrix(matrix, n_qubits)
run_qutip_constant_segment(...)
run_qutip_piecewise_segments(...)
compare_density_matrices(...)
```

このadapterは本番physicsへ依存してよいですが、本番physicsからQuTiPへ依存させてはいけません。

依存方向:

```text
validation code -> core
validation code -> qutip
core -X-> qutip
```

---

# 7. 必須検証ケース

## V7-0: 無散逸ユニタリsanity check

目的:

- Hamiltonianの単位
- 時間単位
- Qobj変換
- 位相

を最小条件で監査する。

条件:

```text
1 qubit
initial |0>
finite-duration H gate
collapse operators: empty
```

QuantaScopeとQuTiPの各snapshot密度行列を比較してください。

## V7-1: 下向き緩和のみ

条件:

```text
1 qubit
initial |1>
H = 0
gamma_down = 0.1 /us
gamma_up = 0
gamma_phi = 0
```

同じ `H`, `rho0`, `tlist`, `c_ops` を両solverへ渡します。

## V7-2: 純粋位相緩和のみ

条件:

```text
1 qubit
initial |+>
H = 0
gamma_down = 0
gamma_up = 0
gamma_phi = 0.1 /us
L_phi = sqrt(gamma_phi / 2) sigma_z
```

人口だけでなく複素非対角成分を比較してください。

## V7-3: 有限温度の上向き・下向き遷移

条件例:

```text
1 qubit
initial |1>
H = 0
gamma_down = 0.051 /us
gamma_up = 0.049 /us
gamma_phi = 0
```

平衡人口だけでなく、全時刻の密度行列を比較してください。

## V7-4: 一量子ビット有限時間ゲートと散逸

条件:

```text
initial |0>
H gate duration = 8 us
gamma_down = 0.02 /us
gamma_up = 0.003 /us
gamma_phi = 0.015 /us
```

QuantaScopeの実際のsegment Hamiltonianを取得し、その行列をQuTiPへ渡してください。

ゲートを理想ユニタリとして瞬時適用してはいけません。

## V7-5: 二量子ビットBell型回路と散逸

条件:

```text
initial |00>
column 0: H(q0), duration 8 us
column 1: CNOT(q0 -> q1), duration 16 us
gamma_down = 0.02 /us
gamma_up = 0.003 /us
gamma_phi = 0.015 /us
```

各columnをpiecewise constant segmentとしてQuTiPで順番に解いてください。

比較点:

- initial
- H column boundary
- CNOT column boundary
- final
- 可能なら各segment内部の共通snapshot

## V7-6: 物理入力を経由したend-to-end case

条件例:

```text
1 qubit
Temperature = 100 mK
qubit frequency = 5 GHz
device_quality = 1.0
T1 maximum = 100 us
flux noise = 0
initial |+> または |1>
```

ここではQuantaScopeの既存変換層から、次を一度だけ取得してください。

```text
n_th
gamma_down_per_us
gamma_up_per_us
gamma_phi_per_us
H
collapse operator matrices
```

取得後は、同じ行列を両solverへ渡してください。

QuTiP側で温度や周波数からrateを再計算してはいけません。

---

# 8. piecewise gate evolutionの比較方法

ゲート回路はsegmentごとに解いてください。

```text
rho_0
  ↓ mesolve(H_0, segment 0 times, c_ops)
rho_1
  ↓ mesolve(H_1, segment 1 times, c_ops)
rho_2
  ↓ ...
```

各segmentでは相対時刻 `[0, duration]` を使用しても構いませんが、reportにはglobal timeを記録してください。

segment境界の状態を次segmentの初期状態へ渡します。

QuantaScopeと同様に、idle segmentではzero Hamiltonianを使用してください。

---

# 9. 比較指標

各共通時刻で次を計算してください。

## 必須

```text
maximum absolute matrix-element difference
Frobenius norm difference
trace distance
maximum population difference
maximum coherence difference
trace error of each solver
Hermiticity error of each solver
minimum density-matrix eigenvalue of each solver
```

密度行列差を

\[
\Delta\rho=\rho_{\mathrm{QS}}-\rho_{\mathrm{QuTiP}}
\]

としてください。

trace distanceは

\[
D(\rho,\sigma)=\frac12\|\rho-\sigma\|_1
\]

です。

## 推奨

- fidelity
- purity difference
- final measurement-probability difference
- runtime

fidelityを出す場合、使用した定義がroot fidelityかsquared fidelityかを明記してください。曖昧なら主要合否指標に使わないでください。

---

# 10. 合格基準

まず実測値を保存したうえで、次の暫定基準を使用してください。

| ケース | 最大要素差 | trace distance |
|---|---:|---:|
| V7-0〜V7-3 | `<= 1e-8` | `<= 1e-8` |
| V7-4 | `<= 1e-7` | `<= 1e-7` |
| V7-5 | `<= 2e-7` | `<= 2e-7` |
| V7-6 | `<= 1e-7` | `<= 1e-7` |

全ケースで追加条件:

```text
trace error <= 1e-10
Hermiticity error <= 1e-10
minimum eigenvalue >= -1e-10
all values finite
requested time and actual time consistent
```

閾値を満たさない場合はFAILとし、次を分離して調査してください。

1. basis order
2. qubit order
3. sigma_down / sigma_upの向き
4. Hamiltonianの単位
5. `h` と `hbar` の混同
6. rate単位 `1/us`
7. segment duration
8. collapse operatorの平方根係数
9. pure dephasingの1/2係数
10. QuTiPの自動正規化
11. snapshot/global timeの不一致
12. QuantaScope側のRK4離散化誤差

---

# 11. Liouvillian初期微分監査

可能なら、積分結果に加えて初期時刻の微分を比較してください。

\[
\dot\rho(0)
=
-i[H,\rho(0)]
+
\sum_j\left(
L_j\rho(0)L_j^\dagger
-\frac12\{L_j^\dagger L_j,\rho(0)\}
\right)
\]

QuTiPのLiouvillian APIを使用する場合は、operator vectorizationの規約を正しく扱ってください。規約に不確実性がある場合は、この項目を合否条件にせず、監査結果として報告してください。

初期微分が一致し、時間発展だけが不一致なら、積分設定や時刻境界を優先的に調査できます。

---

# 12. 自動テスト

作成例:

```text
tests/test_validation_qutip_comparison.py
```

必須テスト:

1. basis action audit
2. 1量子ビットQobj round trip
3. 2量子ビットbasis/order audit
4. V7-0 unitary comparison
5. V7-1 downward comparison
6. V7-2 pure-dephasing comparison
7. V7-3 finite-temperature comparison
8. V7-4 driven one-qubit comparison
9. V7-5 two-qubit comparison
10. V7-6 physical-input-path comparison
11. trace/Hermiticity/positivity
12. all values finite
13. missing-QuTiP behavior

検証testはQuTiP未導入時にskip可能で構いませんが、skip理由を明確にしてください。

---

# 13. 再実行スクリプト

作成例:

```text
scripts/validate_qutip_comparison.py
```

実行例:

```bash
python scripts/validate_qutip_comparison.py
```

引数例:

```bash
python scripts/validate_qutip_comparison.py \
  --quanta-step-us 0.03125 \
  --qutip-atol 1e-12 \
  --qutip-rtol 1e-12
```

スクリプトは、各ケースのPASS/FAILと最大差を標準出力へ表示してください。

---

# 14. 生成する成果物

```text
validation_results/validation7_qutip_comparison.json
validation_results/validation7_qutip_comparison.csv
validation_results/validation7_qutip_comparison.png
validation_results/validation7_qutip_comparison_error.png
docs/validation/validation-7-qutip-comparison.md
```

## JSONに含めるもの

```text
Git commit
Python / QuTiP / NumPy / SciPy versions
OS
solver options
QuantaScope internal step
basis and bit-order audit
all input matrices
rates
segment definitions
snapshot times
all comparison metrics
PASS / FAIL
scope and limitations
```

行列を保存するとJSONが大きくなるため、各ケースについて少なくともinitial state、Hamiltonian、collapse operatorsを保存し、多量子ビットでは必要に応じて別JSONへ分離して構いません。

## CSV列

```text
case
segment_index
global_time_us
requested_time_us
actual_time_us
matrix_dimension
max_element_difference
frobenius_difference
trace_distance
population_difference
coherence_difference
quanta_trace_error
qutip_trace_error
quanta_min_eigenvalue
qutip_min_eigenvalue
result
```

## PNG 1

代表ケースについて、同一グラフに

- QuantaScope
- QuTiP

の人口または代表密度行列要素を重ねて表示してください。

必ずタイトルへ

```text
Actual calculation result / 実際の計算結果
```

と記載してください。

## PNG 2

各時刻の

```text
maximum matrix-element difference
trace distance
```

を対数軸で表示してください。

---

# 15. 検証報告書の構成

```markdown
# VALIDATION-7: QuTiP Comparison

## Purpose
## Environment and Versions
## What QuTiP Receives
## Basis and Qubit-Order Audit
## Solver Settings
## Test Cases
## Comparison Metrics
## Results
## Failure Analysis, if any
## Interpretation
## Scope and Limitations
## Reproduction Commands
## Files
```

報告書には次を明記してください。

> QuTiPへ温度、磁束、device quality等を直接入力したのではなく、QuantaScopeが生成したHamiltonianとcollapse operatorsを同一条件で入力した。

また、PASSしても次は証明していないことを記載してください。

```text
QuantaScopeの物理パラメータ変換が特定実機へ校正済みであること
非Markov環境での妥当性
強結合領域での妥当性
任意の有限RK4 stepがCPTPであること
すべての回路・量子ビット数で一致すること
QuTiP自体が現実の実機を完全に再現すること
```

---

# 16. 実行コマンド

環境に合わせて調整し、実際に実行してください。

```bash
python -m pip install -r requirements-validation.txt
python -c "import qutip; print(qutip.__version__)"
python -m unittest tests.test_validation_qutip_comparison
python scripts/validate_qutip_comparison.py
python -m unittest discover -s tests
npm.cmd run build
git diff --check
```

Windowsで `python` が異なる環境を指す場合は、QuantaScopeで使用しているvenvのPythonを明示してください。

---

# 17. 完了条件

次をすべて満たしたときのみ完了です。

- [ ] QuTiPは検証専用依存である
- [ ] exact QuantaScope matricesからQobjを構築した
- [ ] basis orderを自動監査した
- [ ] q0=MSBを自動監査した
- [ ] `sigmam` / `sigmap` の名前へ無条件依存していない
- [ ] QuTiPでrateを再計算していない
- [ ] `normalize_output=False` を使用した
- [ ] V7-0〜V7-6を実行した
- [ ] 全共通時刻で密度行列を比較した
- [ ] trace distanceを計算した
- [ ] trace、Hermiticity、positivityを確認した
- [ ] JSON、CSV、PNG、Markdownを生成した
- [ ] exact package versionsとGit commitを記録した
- [ ] production physicsを変更していない
- [ ] 全回帰テストが成功した
- [ ] 不一致があれば原因を隠さず報告した

---

# 18. 参考資料

- [QuTiP: Lindblad Master Equation Solver](https://qutip.readthedocs.io/en/latest/guide/dynamics/dynamics-master.html)
- [QuTiP: Dynamics solver options](https://qutip.readthedocs.io/en/qutip-5.2.x/guide/dynamics/dynamics-options.html)
- [QuTiP: Solver API](https://qutip.readthedocs.io/en/latest/apidoc/solver.html)
- [QuTiP: Quantum Objects](https://qutip.readthedocs.io/en/latest/apidoc/quantumobject.html)
- [QuTiP: Operator functions](https://qutip.readthedocs.io/en/qutip-5.0.x/apidoc/functions.html)

QuTiPの公式文書では、collapse operatorをrateの平方根と散逸演算子の積として `c_ops` に渡し、`mesolve`でLindblad方程式を解く構成が示されています。また、solver optionsから `atol`、`rtol`、`method`、`max_step`、`normalize_output`、`store_states` を設定できます。
