# QuantaScope 物理モデル確定計画書

> **監査済み実行計画**
>
> 2026-07-25 時点で、本書を B-7 後の物理モデル最終化ロードマップとする。
> Pulse Extension B の数値・API・UI freeze は
> `PASS WITH RESTRICTIONS` である。履歴上の B-7 manifest は当時の
> dirty tree を保持するが、Phase 0 の scoped commit、clean freeze、
> validation、tag は完了した。
>
> Phase 1 の参照 revision は
> `quantascope-python-reference-pulse-b-v1` とする。

## 1. 文書の目的

本計画書は、QuantaScope の物理モデルを最終的に確定するまでの開発、検証、監査、文書化の順序を定めるものである。

現時点で QuantaScope には、以下の検証済みモデルが存在する。

- gate-aware Hamiltonian-Lindblad model
- two-level rotating-frame RWA control-envelope model
- three-level transmon qutrit rotating-frame RWA model
- leakage、transition-specific dissipation、DRAG を含む pulse model

ただし、現段階では以下が未完了である。

- Rust 側での時間依存 pulse model の再現
- 明示的かつ正式な CPTP 写像の構成
- 実機データを用いた物理モデル妥当性の監査
- gate-aware mode と pulse mode を横断した最終的な物理モデル確定
- 最終仕様書および説明資料の作成

今後は次の順序で進める。

```text
Phase 0  現行 Python 参照実装の clean freeze
Phase 1  Rust backend の更新と接続
Phase 2  CPTP 写像の正式・明示的構成
Phase 3  QuTiP および実機による物理モデル妥当性監査
Phase 4  物理モデル確定と説明ドキュメント作成
```

---

## 2. 用語

### 2.1 backend

backend とは、実際に数値計算を行う内部実装を指す。本計画では主に Python / NumPy backend と Rust backend を扱う。

### 2.2 parity

parity とは、二つの実装が同一の入力に対して同一の結果を与えることをいう。本計画では、Python 実装と Rust 実装の一致を意味する。

### 2.3 audit

audit とは、モデル、実装、出力、記録が定められた規約と証拠に基づいて監査可能であることをいう。

### 2.4 calibration

calibration とは、実機データに合わせてモデルのパラメータを決定することをいう。

### 2.5 validation

validation とは、モデルまたは実装が目的に対して妥当であるかを検証することをいう。

### 2.6 verification

verification とは、実装が定められた数式や仕様を正しく実現しているかを確認することをいう。

### 2.7 CPTP

CPTP は completely positive and trace preserving の略であり、日本語では完全正値かつトレース保存と表す。

### 2.8 Kraus representation

Kraus representation は、量子チャネルを複数の演算子によって表す方法である。

### 2.9 Choi matrix

Choi matrix は、線形写像が完全正値であるかを確認するために用いる行列表現である。

### 2.10 freeze

freeze とは、モデルの数式、単位、符号規約、API contract、検証結果を固定し、その後は同じ version の意味を変更しないことをいう。

---

## 3. 現在の基準モデル

### 3.1 gate-aware model

gate-aware mode では、理想ゲートに対応する有効 Hamiltonian と Lindblad 散逸を同じ時間発展の中で扱う。

$$
\frac{d\rho}{dt}
=
-i[H_{\mathrm{gate}},\rho]
+
\sum_k
\left(
L_k\rho L_k^\dagger
-
\frac{1}{2}
\left\{
L_k^\dagger L_k,\rho
\right\}
\right)
$$

### 3.2 two-level pulse model

$$
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
$$

$$
\Delta
=
\omega_d-\omega_q
$$

### 3.3 qutrit pulse model

$$
H(t)
=
-\Delta n
+
\frac{\alpha}{2}n(n-1)
+
\frac{\Omega_x(t)}{2}
\left(
a+a^\dagger
\right)
+
\frac{\Omega_y(t)}{2}
\left[
-i
\left(
a-a^\dagger
\right)
\right]
$$

$$
\alpha
=
\omega_{12}-\omega_{01}
$$

$$
\alpha<0
$$

$$
P_{\mathrm{leak}}(t)
=
\rho_{22}(t)
$$

$$
\Omega_y(t)
=
\beta
\frac{d\Omega_x(t)}{dt}
$$

### 3.4 現在の制約

- 回転座標系
- 回転波近似
- 単一量子ビットまたは単一 qutrit pulse
- 最大三準位
- Markov 型 Lindblad 環境
- 固定刻み RK4
- 任意の有限刻みに対する厳密 CPTP 保証なし
- 実機校正なし
- Rust time-dependent backend 未接続
- 複数量子ビット pulse 未対応
- circuit-to-pulse compilation 未対応

## 3.5 実装前に固定する拘束条件

以下は Phase 1 以降の実装で変更してはならない監査条件である。

### 3.5.1 raw evolution と cleanup の分離

現在の density-matrix cleanup は、Hermitian 化、負固有値 clipping、
trace normalization を含む数値的後処理である。一般に線形な量子チャネル
として扱えず、CPTP 写像の証拠にはならない。

Python-Rust parity は、

1. cleanup 前の raw state
2. raw physicality diagnostics
3. cleanup correction
4. cleanup 後の表示 state

を分離して比較する。cleanup を物理発展演算子に含めてはならない。

### 3.5.2 Kraus channel と Lindblad semigroup の役割分離

amplitude damping、phase damping、reset などの明示的 Kraus channel は、
離散 event または教育用 channel として扱う。

複数の散逸過程と Hamiltonian が同時に作用する連続発展の主経路は、
GKSL generator から構成する

$$
\mathcal E_{\Delta t}
=
\exp(\Delta t\mathcal L)
$$

とする。個別 Kraus channel の順次適用は一般に operator-splitting
近似であり、同時 Lindblad 発展と厳密に同一とは限らない。近似を採用する
場合は順序、誤差次数、step refinement を明示する。

### 3.5.3 時間依存 CPTP 経路

時間依存 pulse では各区間に非負 rate を持つ GKSL generator
`L(t*)` を選び、

$$
\mathcal E_k=\exp(\Delta t_k\mathcal L(t_k^*))
$$

を構成する。各区間 map の Choi 行列と trace preservation を監査し、
その合成を CPTP 経路と呼ぶ。

この区間 map が CPTP であることと、元の時間順序指数関数への近似誤差が
小さいことは別の主張である。後者は step refinement と QuTiP 比較で
検証する。

### 3.5.4 measurement の正確な分類

測定結果を捨てた全測定 map は CPTP である。一方、個別 outcome に条件付けた
map は CP かつ trace-nonincreasing であり、単独では TP ではない。
API と文書では channel、instrument、conditioned state を区別する。

### 3.5.5 qutrit reset の意味

`reset to computational subspace` は一意な物理操作ではない。
`|2>` を `|0>` または `|1>` のどちらへ移すか、coherence をどう扱うか、
確率的か測定条件付きかを数学契約で固定するまで実装しない。
標準の qutrit Lindblad 環境へ暗黙に追加してはならない。

### 3.5.6 Choi convention

Choi 行列の基底順序、正規化済み最大エンタングル状態を使うか否か、
vectorization の順序、固有値 tolerance、dimension scaling を C0 で固定する。
異なる convention の Choi 行列を数値だけで比較してはならない。

### 3.5.7 hardware validation の条件

Phase 3B は利用可能な公開 dataset または監査可能な cloud-hardware
実験を先に選定し、利用規約、費用、再配布可否、測定 uncertainty、
SPAM correction の扱いを登録してから開始する。データ入手経路が未確定の
場合は Phase 3A 完了後も Phase 3B を未完了として扱い、物理モデル名を
`validated` へ変更しない。

---

# Phase 0: 現行 Python 参照実装の Clean Freeze

**Current status:** COMPLETE

## 4. 目的

Rust 実装、CPTP 実装、実機監査の参照元となる Python / NumPy 実装を一意に固定する。

## 5. 必須作業

1. 現在の未 commit 変更を整理する。
2. gate-aware V1-V7 を再実行する。
3. Pulse Baseline A の全検証を再実行する。
4. Pulse Extension B の全検証を再実行する。
5. frontend build、lint、API smoke test を再実行する。
6. working tree が clean であることを確認する。
7. freeze artifact を再生成する。
8. Git tag を付与する。

変更整理では、少なくとも次を分離する。

- Python 参照物理実装
- API contract
- frontend
- validation code と artifacts
- documentation
- 本計画と無関係な既存変更

tag 対象 commit に何を含めるかを記録し、untracked file を無条件に追加しない。

推奨 tag:

```text
quantascope-python-reference-pulse-b-v1
```

## 6. 記録項目

```text
git_commit
git_tag
working_tree_clean
python_version
numpy_version
scipy_version
qutip_version
frontend_dependency_versions
source_file_hashes
validation_artifact_hashes
OpenAPI_hash
```

## 7. 完了条件

- 全検証が PASS
- working tree が clean
- Python 参照実装の commit と tag が一意
- 主要成果物の hash が記録済み
- Rust phase で参照する version が明確

---

# Phase 1: Rust Backend 更新・接続

**Current status:** PLANNED; Phase 0 clean tag required

## 8. 目的

凍結済み Python / NumPy 参照実装を Rust で再現し、gate-aware mode と pulse mode の双方で高速かつ再現可能な backend を構築する。

この phase では物理モデルを変更しない。Rust 実装は、既存 Python 物理モデルの忠実な再実装とする。

## 9. 対象モデル

```text
gate_aware_hamiltonian_lindblad_v1
driven_two_level_rwa_experimental_v1
driven_transmon_qutrit_rwa_experimental_v1
```

## 10. Rust 側で実装する構成要素

### 10.1 線形代数

- 複素行列
- 共役転置
- 行列積
- commutator
- anti-commutator
- trace
- Frobenius norm
- Hermiticity error
- eigenvalue evaluation
- density-matrix cleanup

cleanup は raw evolution とは別の診断・表示処理として実装し、raw parity
成立前に適用しない。

### 10.2 演算子

- Pauli operators
- lowering operator
- raising operator
- qutrit annihilation operator
- qutrit number operator
- gate-aware effective Hamiltonian
- two-level pulse Hamiltonian
- qutrit pulse Hamiltonian
- collapse operators

### 10.3 時間発展

- constant Hamiltonian path
- time-dependent Hamiltonian path
- RK4 stage evaluation
- pulse segment
- idle segment
- snapshot scheduling
- final partial step
- cleanup 前後の診断

## 11. Python-Rust 一致検証

### R1: 演算子一致

$$
\varepsilon_A
=
\max_{i,j}
\left|
A_{ij}^{\mathrm{Python}}
-
A_{ij}^{\mathrm{Rust}}
\right|
$$

### R2: Lindblad 右辺一致

$$
\dot{\rho}
=
-i[H,\rho]
+
\sum_k
\left(
L_k\rho L_k^\dagger
-
\frac{1}{2}
\left\{
L_k^\dagger L_k,\rho
\right\}
\right)
$$

$$
\varepsilon_{\dot{\rho}}
=
\max_{i,j}
\left|
\dot{\rho}_{ij}^{\mathrm{Python}}
-
\dot{\rho}_{ij}^{\mathrm{Rust}}
\right|
$$

### R3: RK4 stage 一致

$$
k_1,\quad k_2,\quad k_3,\quad k_4
$$

### R4: 1 step 一致

$$
\varepsilon_{\mathrm{step}}
=
\max_{i,j}
\left|
\rho_{ij,\mathrm{Python}}
-
\rho_{ij,\mathrm{Rust}}
\right|
$$

### R5: trajectory 一致

- gate-aware unitary
- gate-aware open system
- square pulse
- Gaussian pulse
- detuned pulse
- dissipative pulse
- pulse followed by idle
- qutrit leakage
- qutrit dissipation
- DRAG

### R6: backend 切替

```text
backend: python
backend: rust
backend: auto
```

`auto` は Rust が利用可能な場合に Rust を選択し、失敗時は Python に戻る。fallback が起きた場合は response metadata と log に明示する。

## 12. Rust phase の設計原則

```text
EvolutionMethod
├── FixedStepRk4
├── ExplicitCptpChannel
├── LiouvillianExponential
└── FutureAdaptiveMethod
```

## 13. 完了条件

- Python-Rust 演算子一致
- Python-Rust Lindblad RHS 一致
- Python-Rust RK4 stage 一致
- Python-Rust trajectory 一致
- gate-aware V1-V7 が Rust path でも PASS
- Pulse Baseline A が Rust path でも PASS
- Pulse Extension B が Rust path でも PASS
- backend metadata が API から確認可能
- Rust failure 時の fallback が監査可能
- Python 参照実装の挙動が変化していない

---

# Phase 2: CPTP 写像の正式・明示的構成

**Current status:** PLANNED; Phase 1 RK4 parity required

## 14. 目的

QuantaScope における物理的な量子チャネルを、完全正値かつトレース保存であることが明示できる形で構成する。

現在の RK4 は高精度な数値積分法であるが、任意の有限 step において CPTP を保証しない。そのため、RK4 を置き換えるのではなく、CPTP を保証する別の発展方式を追加する。

## 15. Kraus 表示

$$
\mathcal{E}(\rho)
=
\sum_k
K_k
\rho
K_k^\dagger
$$

$$
\sum_k
K_k^\dagger K_k
=
I
$$

## 16. Choi 行列

$$
J(\mathcal{E})
=
\sum_{i,j}
|i\rangle\langle j|
\otimes
\mathcal{E}
\left(
|i\rangle\langle j|
\right)
$$

$$
\lambda_{\min}
\left(
J(\mathcal{E})
\right)
\geq
-\varepsilon_{\mathrm{CP}}
$$

## 17. 対象チャネル

### 17.1 qubit channel

- amplitude damping
- generalized amplitude damping
- phase damping
- depolarizing
- reset
- measurement

measurement は outcome を捨てた CPTP map と、outcome 別の CP
trace-nonincreasing instrument に分ける。

### 17.2 qutrit channel

- transition-specific downward channel
- transition-specific upward channel
- qutrit dephasing channel
- leakage-aware channel
- reset to computational subspace
- qutrit measurement

reset と measurement は連続 Lindblad 発展へ暗黙に混合せず、離散 event
として別 contract にする。

## 18. 連続 Lindblad 発展の CPTP 化

$$
\mathcal{E}_{\Delta t}
=
\exp
\left(
\Delta t\,\mathcal{L}
\right)
$$

時間依存 Hamiltonian に対しては、区間分割によって次のように近似する。

$$
\mathcal{E}(T)
\approx
\mathcal{E}_{N}
\circ
\mathcal{E}_{N-1}
\circ
\cdots
\circ
\mathcal{E}_{1}
$$

各区間写像が CPTP であれば、それらの合成も CPTP である。

## 19. CPTP phase の小段階

```text
C0  CPTP 数学契約
C1  qubit Kraus channel
C2  qutrit Kraus channel
C3  Choi matrix audit
C4  channel composition
C5  Liouvillian exponential map
C6  pulse segment integration
C7  Python-Rust parity
C8  RK4 との精度・速度比較
C9  API と UI への統合
C10 CPTP model freeze
```

## 20. 必須検証

### 20.1 trace preservation

$$
\left\|
\sum_k
K_k^\dagger K_k
-
I
\right\|
\leq
\varepsilon_{\mathrm{TP}}
$$

### 20.2 complete positivity

$$
\lambda_{\min}
\left(
J(\mathcal{E})
\right)
\geq
-\varepsilon_{\mathrm{CP}}
$$

### 20.3 density-matrix physicality

$$
\operatorname{Tr}
\left[
\mathcal{E}(\rho)
\right]
=
1
$$

$$
\mathcal{E}(\rho)
=
\mathcal{E}(\rho)^\dagger
$$

$$
\lambda_{\min}
\left[
\mathcal{E}(\rho)
\right]
\geq
-\varepsilon
$$

### 20.4 composition

$$
\mathcal{E}_{2}
\circ
\mathcal{E}_{1}
$$

### 20.5 RK4 比較

$$
D_{\mathrm{tr}}
\left(
\rho_{\mathrm{RK4}},
\rho_{\mathrm{CPTP}}
\right)
=
\frac{1}{2}
\left\|
\rho_{\mathrm{RK4}}
-
\rho_{\mathrm{CPTP}}
\right\|_1
$$

## 21. 完了条件

- Kraus 完全性が確認済み
- Choi 行列が半正定値
- qubit と qutrit の双方で明示的 channel を構成
- channel composition が CPTP
- time-independent Lindblad map が CPTP
- time-dependent pulse に対する区間合成が実装済み
- Python と Rust の CPTP path が一致
- RK4 path との精度比較が完了
- API が evolution method を明示
- CPTP である範囲と近似範囲が文書化済み

---

# Phase 3: QuTiP と実機による物理モデル妥当性監査

**Current status:** PARTIAL

Phase 3A の Python gate-aware、two-level pulse、qutrit pulse 比較は完了済み。
Rust path と CPTP path の比較は未実施である。Phase 3B は監査対象 dataset
または hardware access が未確定のため未開始である。

## 22. 目的

QuantaScope の数値実装と物理モデルを、独立 solver および実機データを用いて監査する。

```text
Phase 3A  QuTiP による数値実装監査
Phase 3B  実機データによる物理モデル監査
```

## 23. Phase 3A: QuTiP による数値実装監査

### 23.1 役割

QuTiP 比較は、同一の数学的問題を別の solver で解いたときに一致するかを確認する。QuTiP 比較だけでは、モデルが実機を正しく表していることまでは証明しない。

### 23.2 同一にする入力

$$
\rho(0)
$$

$$
H(t)
$$

$$
L_k
$$

$$
t_j
$$

### 23.3 gate-aware mode の比較

- zero dissipation
- downward relaxation
- upward excitation
- pure dephasing
- finite-temperature equilibrium
- driven gate segment
- pulse-independent idle
- multi-qubit gate-aware cases

### 23.4 pulse mode の比較

- square pulse
- Gaussian pulse
- phase sweep
- positive and negative detuning
- dissipative pulse
- pulse followed by idle
- qutrit leakage
- transition-specific qutrit dissipation
- DRAG
- CPTP path と QuTiP path の比較

### 23.5 比較指標

$$
\varepsilon_{\max}
=
\max_{i,j,t}
\left|
\rho_{ij}^{\mathrm{QuantaScope}}(t)
-
\rho_{ij}^{\mathrm{QuTiP}}(t)
\right|
$$

$$
\varepsilon_F
=
\left\|
\rho^{\mathrm{QuantaScope}}
-
\rho^{\mathrm{QuTiP}}
\right\|_F
$$

$$
D_{\mathrm{tr}}
=
\frac{1}{2}
\left\|
\rho^{\mathrm{QuantaScope}}
-
\rho^{\mathrm{QuTiP}}
\right\|_1
$$

### 23.6 完了条件

- gate-aware mode が QuTiP と一致
- two-level pulse が QuTiP と一致
- qutrit pulse が QuTiP と一致
- Rust backend が QuTiP と一致
- CPTP path の定義と出力が監査済み
- tolerance が事前登録されている
- solver agreement と hardware validity を混同していない

## 24. Phase 3B: 実機データによる物理モデル監査

### 24.1 役割

実機監査では、QuantaScope の物理モデルが実際の量子デバイスの観測量をどの程度説明または予測できるかを確認する。

### 24.2 データの分割

```text
Calibration set
Validation set
```

Calibration set はモデルパラメータの決定に使う。Validation set は calibration に使用していない条件で予測性能を評価する。

### 24.3 gate-aware mode の監査項目

- excited-state decay
- idle relaxation
- Ramsey decay
- echo decay
- thermal excited-state population
- single-qubit gate result
- two-qubit gate result
- circuit depth dependence
- gate duration dependence
- idle duration dependence

### 24.4 pulse mode の監査項目

- Rabi oscillation
- Ramsey fringe
- detuning sweep
- amplitude sweep
- pulse-duration sweep
- square and Gaussian comparison
- DRAG beta sweep
- leakage to the third level
- pulse-end population
- post-pulse idle decay
- phase error
- target-state fidelity

### 24.5 評価指標

$$
\varepsilon_P
=
\left|
P_{\mathrm{model}}
-
P_{\mathrm{hardware}}
\right|
$$

$$
\varepsilon_{\mathrm{leak}}
=
\left|
P_{\mathrm{leak}}^{\mathrm{model}}
-
P_{\mathrm{leak}}^{\mathrm{hardware}}
\right|
$$

$$
\varepsilon_{\gamma}
=
\left|
\gamma_{\mathrm{model}}
-
\gamma_{\mathrm{hardware}}
\right|
$$

$$
\varepsilon_{\Omega}
=
\left|
\Omega_{\mathrm{model}}
-
\Omega_{\mathrm{hardware}}
\right|
$$

$$
\varepsilon_{\mathrm{rel}}
=
\frac{
\left|
x_{\mathrm{model}}
-
x_{\mathrm{hardware}}
\right|
}{
\max
\left(
|x_{\mathrm{hardware}}|,
\varepsilon_0
\right)
}
$$

### 24.6 uncertainty

$$
x_{\mathrm{hardware}}
\pm
\sigma_x
$$

$$
z
=
\frac{
x_{\mathrm{model}}
-
x_{\mathrm{hardware}}
}{
\sigma_x
}
$$

### 24.7 model discrepancy

候補要因:

- 三準位打ち切り
- 回転波近似
- Markov 近似
- 定数 rate
- transfer-function distortion
- pulse edge discontinuity
- crosstalk
- calibration drift
- measurement error
- SPAM error
- multi-level leakage
- non-Markovian noise

### 24.8 完了条件

- calibration set と validation set が分離
- gate-aware mode を実機データで監査
- pulse mode を実機データで監査
- leakage と DRAG を実機観測と比較
- uncertainty を考慮
- fit した量と予測した量を明確に分離
- model discrepancy を記録
- 一致しない結果も保存
- 実機との一致範囲と不一致範囲を明示

---

# Phase 4: 物理モデル確定と説明ドキュメント作成

**Current status:** PLANNED; Phase 0-3 completion required

## 25. 目的

Rust parity、CPTP、QuTiP 監査、実機監査の結果を統合し、QuantaScope の物理モデルを正式に確定する。

## 26. モデル version の決定

監査後に数式や rate mapping が変更されなかった場合:

```text
driven_transmon_qutrit_rwa_validated_v1
```

物理式または意味が変更された場合:

```text
driven_transmon_qutrit_rwa_experimental_v2
```

既存の frozen model の意味は変更しない。

## 27. 最終モデル確定条件

- Python 参照実装が clean freeze
- Rust backend が Python と一致
- gate-aware Rust path が検証済み
- pulse Rust path が検証済み
- qubit CPTP channel が明示的に構成済み
- qutrit CPTP channel が明示的に構成済み
- Choi audit が完了
- CPTP composition が検証済み
- QuTiP 数値監査が完了
- gate-aware 実機監査が完了
- pulse 実機監査が完了
- calibration と validation が分離
- model discrepancy が整理済み
- 適用範囲と限界が確定
- 全 regression test が PASS

## 28. 最終成果物

### 28.1 物理モデル仕様書

- 状態空間
- 基底
- 単位
- 符号規約
- gate-aware Hamiltonian
- two-level pulse Hamiltonian
- qutrit Hamiltonian
- collapse operators
- thermal occupation
- dephasing
- leakage
- DRAG
- CPTP channel
- Markov 近似
- RWA
- model version
- 適用範囲
- 非対応領域

### 28.2 数値実装仕様書

- Python backend
- Rust backend
- RK4
- CPTP path
- Liouvillian exponential
- step policy
- cleanup policy
- backend fallback
- work budget
- error handling
- reproducibility

### 28.3 統合検証報告書

- V1-V7
- Pulse Baseline A
- Pulse Extension B
- Python-Rust parity
- CPTP audit
- Choi audit
- QuTiP comparison
- hardware validation
- uncertainty
- failed cases
- model discrepancy
- final decision

### 28.4 API contract

- model ID
- model version
- backend
- evolution method
- input units
- output units
- warnings
- limitations
- error response
- timeout
- work budget
- compatibility policy

### 28.5 非専門家向け説明文書

```text
理想的な量子回路
↓
現実の量子ビットは環境の影響を受ける
↓
gate-aware model はゲート操作と散逸を同じ時間発展で扱う
↓
pulse model は制御波形、離調、位相、リークを扱う
↓
DRAG はリークを抑える制御方法である
↓
CPTP は密度行列の物理性を保証する枠組みである
↓
Rust は同じ物理モデルを高速に計算する
↓
QuTiP と実機の両方で妥当性を監査する
```

### 28.6 AI 利用開示

- 人間が決定した物理モデル
- AI が提案した実装案
- AI が生成した code
- 人間が確認した検証結果
- 外部資料または教員による確認
- 実機データに基づく最終判断

---

# 29. 全体ロードマップ

```text
Clean Python reference freeze
        ↓
Rust operator parity
        ↓
Rust Lindblad RHS parity
        ↓
Rust RK4 stage parity
        ↓
Rust trajectory parity
        ↓
Rust API integration
        ↓
Explicit qubit CPTP channels
        ↓
Explicit qutrit CPTP channels
        ↓
Choi and trace-preserving audit
        ↓
CPTP channel composition
        ↓
Liouvillian exponential path
        ↓
Python-Rust CPTP parity
        ↓
QuTiP numerical audit
        ↓
Hardware calibration set
        ↓
Hardware validation set
        ↓
Model discrepancy analysis
        ↓
Final physical model selection
        ↓
Technical documentation
        ↓
Public-facing explanation
```

---

# 30. Go / No-Go 判定

各 phase の終了時に、次のいずれかを記録する。

```text
PASS
PASS WITH RESTRICTIONS
RETURN TO PREVIOUS PHASE
FAIL
```

## 30.1 Phase 1 Go 条件

- Python-Rust parity が固定 tolerance 内
- Python path が未変更
- backend fallback が監査可能

## 30.2 Phase 2 Go 条件

- Kraus completeness が成立
- Choi matrix が半正定値
- qubit と qutrit の双方で CPTP channel が成立
- RK4 と CPTP の差が説明可能

## 30.3 Phase 3 Go 条件

- QuTiP comparison が PASS
- hardware calibration と validation が分離
- 不一致が記録されている
- model discrepancy の候補が整理されている

## 30.4 Phase 4 Go 条件

- 最終モデルの version が一意
- 仕様書と検証報告書が一致
- API と UI が同じ制約を表示
- 実機への適用範囲が明示
- 未対応領域が明示

---

# 31. 最終的な確定方針

QuantaScope の最終物理モデルは、単に一つの solver が動くことによって確定しない。

確定には次の五層の証拠を要求する。

```text
1. 解析解との一致
2. QuTiP との一致
3. Python と Rust の一致
4. CPTP 条件の明示的確認
5. 実機データとの比較
```

これらを満たしたとき、QuantaScope は次のように説明できる。

> QuantaScope は、gate-level 有効 Hamiltonian、回転座標系 RWA pulse model、三準位 transmon、リーク、DRAG、Markov 型 Lindblad 散逸、明示的 CPTP channel を統合し、Python、Rust、QuTiP、実機データの複数経路によって検証された教育・研究用量子シミュレーターである。

ただし、実機との完全一致や任意の量子デバイスへの普遍的適用は主張しない。

最終文書では、検証済みの範囲と未検証の範囲を明確に分離する。
