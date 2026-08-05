# 数値計算・独立solver監査

## 対象

この文書は、行列指数、時間依存generatorの区分近似、fixed-step RK4、
QuTiP比較、およびPython/Rust parityの根拠と役割分担を扱う。

## 1. Higham

**区分:** `METHOD BASIS`

N. J. Higham, "The scaling and squaring method for the matrix exponential
revisited," *SIAM Journal on Matrix Analysis and Applications* 26,
1179-1193 (2005).
[DOI: 10.1137/04061101X](https://doi.org/10.1137/04061101X)

### 文献の内容

matrix exponentialに対するscaling-and-squaring法をbackward errorの観点から
解析し、double precisionでPadé degree 13を用いる構成を示す。

### QuantaScopeで使用した内容

- dense Liouvillian matrixの指数計算
- scaling-and-squaring
- Padé(13)

### 使用箇所

- `core/cptp_liouvillian.py`
- `core/cptp_rust.py`
- `rust_kernels/quantascope_rust/src/lib.rs`
- `tests/test_cptp_liouvillian.py`
- `tests/test_cptp_rust_parity.py`

### この文献だけでは支えないもの

- QuantaScope実装が自動的に正しいこと
- Choi conventionやvectorization order
- 大規模疎行列への性能

これらは独立テスト、SciPy reference、Python/Rust parityで別に検証する。

## 2. Al-Mohy and Higham

**区分:** `METHOD BASIS`

A. H. Al-Mohy and N. J. Higham,
"A new scaling and squaring algorithm for the matrix exponential,"
*SIAM Journal on Matrix Analysis and Applications* 31, 970-989 (2009).
[DOI: 10.1137/09074721X](https://doi.org/10.1137/09074721X)

### 文献の内容

overscalingによる精度低下を扱い、matrix exponentialのscaling選択を改良する。

### QuantaScopeでの位置づけ

現行実装の直接的なalgorithm contractはHigham (2005)型Padé(13)である。
この論文は、scaling選択とoverscalingが数値誤差要因になることを確認するための
補助文献として使用する。

### 使用箇所

- `core/cptp_liouvillian.py`のthresholdとscalingのレビュー
- 将来の極端なLiouvillian normに対するstress test設計

## 3. Blanes et al.

**区分:** `METHOD BASIS`

S. Blanes, F. Casas, J. A. Oteo, and J. Ros,
"The Magnus expansion and some of its applications,"
*Physics Reports* 470, 151-238 (2009).
[DOI: 10.1016/j.physrep.2008.11.001](https://doi.org/10.1016/j.physrep.2008.11.001)

### 文献の内容

時間依存線形微分方程式に対するMagnus expansionと、指数写像を用いる
時間積分法を体系的に整理する。

### QuantaScopeで使用した内容

時間依存Hamiltonianに対して、各区間でgeneratorを代表点評価し、
指数mapを時間順序で合成する方針の数値解析上の背景として参照する。

### 使用箇所

- `core/cptp_piecewise.py`
- `core/cptp_evolution.py`
- `validation_cptp/qutip_audit.py`
- `docs/validation/cptp-qutip-comparison.md`

### 重要な制限

QuantaScopeの現行方式はfull Magnus integratorではない。
`midpoint_piecewise_constant_v1`という中点固定の区分指数近似である。
したがって、このレビューを根拠に高次Magnus法を実装済みとは主張しない。

## 4. Johansson, Nation, and Nori

**区分:** `VALIDATION BASIS`

J. R. Johansson, P. D. Nation, and F. Nori,
"QuTiP: An open-source Python framework for the dynamics of open quantum
systems," *Computer Physics Communications* 183, 1760-1772 (2012).
[DOI: 10.1016/j.cpc.2012.02.021](https://doi.org/10.1016/j.cpc.2012.02.021)

### 文献の内容

Hamiltonian、density matrix、collapse operatorsを用いた開放量子系の
master-equation solverを提供するQuTiPの設計と用途を述べる。

### QuantaScopeで使用した内容

- 同一の`rho(0)`、`H(t)`、`L_k`、時刻列をQuTiPへ直接渡す。
- QuantaScopeと異なるsolverで同じ数理問題を解く。
- solver agreementとhardware validityを分離する。

### 使用箇所

- `validation_pulse/qutip_adapter.py`
- `validation_pulse/qutrit_qutip.py`
- `validation_cptp/qutip_audit.py`
- `scripts/validate_qutip_comparison.py`
- `scripts/validate_cptp_qutip_comparison.py`

### 固定した監査条件

```text
QuTiP version: 5.2.3
solver: mesolve
method: DOP853
atol: 1e-12
rtol: 1e-12
normalize_output: false
```

これらの具体的なtoleranceはQuTiP論文から一意に導かれた値ではなく、
QuantaScopeの独立solver監査contractである。

## 5. Fixed-step RK4とrefinement

**区分:** `PROJECT DECISION`

現行RK4 pathは古典的な4段4次Runge-Kutta法を使用する。QuantaScopeでは、
method名だけを根拠に精度を仮定せず、次で監査する。

- 解析解との比較
- step halving
- observed order
- raw trace / Hermiticity / minimum eigenvalue
- cleanup correction norm
- QuTiP比較

### 使用箇所

- `core/simulator.py`
- `core/pulse_evolution.py`
- `scripts/validate_time_step_convergence.py`
- `validation_pulse/qutrit_convergence.py`
- `docs/validation/validation-6-time-step-convergence.md`

RK4は有限stepでCPTPを保証しないため、explicit CPTP pathと役割を分ける。

## 6. Python/Rust parity

**区分:** `VALIDATION BASIS`

Python/Rust一致は外部論文ではなく、同じ数式を二つの実装で再現した
software verificationである。

比較対象:

- 演算子
- Lindblad RHS
- RK4 stage
- raw step
- trajectory
- Liouvillian exponential
- Choi matrix
- CPTP composition

### 使用箇所

- `tests/test_rust_lindblad_rhs_kernel.py`
- `tests/test_rust_rk4_kernel.py`
- `tests/test_rust_time_dependent_parity.py`
- `tests/test_cptp_rust_parity.py`
- `tests/test_cptp_qutip_comparison.py`
- `docs/development/physical-model-finalization/phase1-rust-parity.md`
- `docs/development/physical-model-finalization/phase3a-qutip-audit.md`
