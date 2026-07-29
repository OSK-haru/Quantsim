# QuantaScope 開発・物理モデル確定 進捗報告書

**報告基準日:** 2026年7月29日
**文書区分:** 正式計画照合済み修正版
**対象:** gate-aware mode / Pulse mode / Rust backend / explicit CPTP path

## 0. 監査基準

本書は、次の正式資料と現在のリポジトリ状態を基準として、
`quantascope_status_report_2026-07-29.md` の内容を修正したものである。

- [物理モデル最終化計画](../../requirements/quantascope_physical_model_finalization_plan.md)
- [Physical Model Finalization Execution Index](README.md)
- [Phase 2: Explicit CPTP Path](phase2-explicit-cptp-path.md)
- [Explicit CPTP Model Freeze](../../validation/cptp-model-freeze.md)
- [Model Identity](../../physics/model_identity.md)

添付された原文は日本語部分に広範囲な文字化けがあったため、本書では内容を
UTF-8の日本語として再構成している。

---

## 1. 総合判定

**現在の開発は継続可能である。**

Python参照実装、Rust RK4 parity、Pulse Baseline A、Pulse Extension B、
explicit CPTP Pulse path、およびPulse API/UI統合までは完了している。

現在の正式な到達点は次のとおりである。

```text
Phase 0: Clean Python reference freeze        COMPLETE
Phase 1: Rust parity                          COMPLETE
Phase 2: Explicit CPTP path                   COMPLETE
Phase 3A: Independent QuTiP audit             PARTIAL
Phase 3B: Hardware observable audit           NOT STARTED
Phase 4: Final model decision/documentation   PLANNED
```

次に実施すべき正式フェーズは、**Phase 3Aの未完了部分であるfrozen CPTP pathと
QuTiPの直接比較**である。

gate-aware explicit CPTP、Pulse Sequence Editor、Pulse専用State Explorer、
circuit-to-pulse compilationは有力な将来候補だが、現在の物理モデル最終化計画の
次工程として確定してはいない。

---

## 2. 原文からの主要修正

| 項目 | 原文の扱い | 修正版での扱い |
| --- | --- | --- |
| 日本語 | 広範囲に文字化け | UTF-8日本語として再構成 |
| 次期優先順位 | Gate-aware explicit CPTPを最優先 | Phase 3A CPTP-to-QuTiP監査を優先 |
| Gate-aware CPTP | 正式Phase 3として記載 | 将来の計画変更候補として分離 |
| QuTiP監査 | 全体を未完了と読める | 既存RK4比較は完了、frozen CPTP比較が未完了 |
| clean freeze | 現在もworking tree cleanと読める | freeze時点の履歴的事実として限定 |
| Pulse State Explorer | 全面未実装 | 専用Explorerは未実装だが、qutrit heatmap等の部分表示は存在 |
| 最終freeze | Explicit CPTP freezeと混同可能 | CPTP freeze完了、全物理モデルの最終freezeは未完了 |

---

## 3. 現在の物理モデル

### 3.1 Gate-aware mode

Gate-aware modeでは、各ゲート列に対応する有効HamiltonianとMarkov型Lindblad
散逸を同一時間区間で扱う。

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

現在選択可能な数値経路は次のとおりである。

```text
Python fixed-step RK4
Rust fixed-step RK4
```

Gate-aware `run_simulation` にはexplicit CPTP経路を接続していない。

### 3.2 Two-level Pulse mode

二準位Pulse modelは、回転座標系とRWAの下で次のHamiltonianを用いる。

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

detuning規約は次である。

$$
\Delta=\omega_d-\omega_q
$$

Frozen identity:

```text
model_id: driven_two_level_rwa_experimental_v1
contract_version: pulse-baseline-a-v1
```

### 3.3 Qutrit Pulse mode

三準位transmon modelは、基底順序`|0>, |1>, |2>`を固定し、次の回転座標系
Hamiltonianを用いる。

$$
H(t)
=
-\Delta n
+
\frac{\alpha}{2}n(n-1)
+
\frac{\Omega_x(t)}{2}(a+a^\dagger)
+
\frac{\Omega_y(t)}{2}\left[-i(a-a^\dagger)\right]
$$

$$
\alpha=\omega_{12}-\omega_{01}
$$

リーク確率は計算部分空間内で再正規化せず、

$$
P_{\mathrm{leak}}(t)=\rho_{22}(t)
$$

と定義する。

Gaussian DRAGのquadratureは、

$$
\Omega_y(t)=\beta\frac{d\Omega_x(t)}{dt}
$$

である。

Frozen identity:

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
```

---

## 4. 完了済み検証・実装

### 4.1 Gate-aware V1-V7

| Validation | 内容 | 状態 |
| --- | --- | --- |
| V1 | Zero-dissipation unitary limit | PASS |
| V2 | Zero-temperature excitation limit / detailed balance | PASS |
| V3 | Excited-state exponential decay | PASS |
| V4 | Pure dephasing convention | PASS |
| V5 | Finite-temperature equilibrium | PASS |
| V6 | Fixed-step RK4 convergence | PASS |
| V7 | QuTiP shared-equation comparison | PASS |

V7は、同一の初期状態、Hamiltonian、collapse operators、時刻列を用いた
shared-equation comparisonである。これは数値solverの一致を検証するが、
実機妥当性を証明するものではない。

### 4.2 Pulse Baseline A

完了済み項目:

- Square pulse
- Finite Gaussian pulse
- Target-angle / peak-amplitude mode
- Phase / positive and negative detuning
- Pulse中の散逸とpulse後idle
- Physical environment / direct-rate input
- Analytic trajectory validation
- QuTiP comparison
- Convergence study
- Bounded Pulse API

判定:

```text
PASS
```

### 4.3 Pulse Extension B

完了済み項目:

- Three-level transmon truncation
- Leakage
- Transition-specific upward/downward rates
- 0-1 / 1-2 transitionごとのthermal occupation
- Number-operator dephasing
- Adjacent/adjacent/two-level coherenceの`1:1:4`減衰関係
- Gaussian DRAG
- Qutrit convergence
- Qutrit RK4-to-QuTiP comparison
- Qutrit Pulse API
- Pulse Lab UI

判定:

```text
PASS WITH RESTRICTIONS
```

### 4.4 Python reference freeze

Reference tag:

```text
quantascope-python-reference-pulse-b-v1
```

これはfreeze実行時点のPython参照実装を固定する履歴的なtagである。
現在のworking treeが常にcleanであることを意味しない。

### 4.5 Rust RK4 parity

次のPython/Rust一致を確認済みである。

- Lindblad RHS
- RK4 stage Hamiltonians
- Raw RK4 step
- Cleaned trajectory
- Two-level Gaussian pulse
- Qutrit DRAG / leakage / idle
- Gate-aware Bell / CNOT / idle
- API backend selection

Backend contract:

```text
python
rust
auto
```

Pulse APIの既定値は`python`である。

---

## 5. Explicit CPTP Phase

### 5.1 Frozen mathematical contract

```text
freeze_id: quantascope_explicit_cptp_v1
public_evolution_method: explicit_cptp
evolution_method_id: explicit_cptp_midpoint_gksl_v1
Choi convention: unnormalized_input_output_row_major_v1
CP tolerance: 1e-12
TP tolerance: 1e-12
```

### 5.2 実装済みchannel

Qubit:

- Amplitude damping
- Generalized amplitude damping
- Phase damping
- Depolarizing
- Deterministic reset to `|0>`
- Computational-basis measurement channel
- Outcome-conditioned CP trace-nonincreasing maps

Qutrit:

- `|1> -> |0>` / `|0> -> |1>`
- `|2> -> |1>` / `|1> -> |2>`
- Number-operator dephasing
- Explicit incoherent leakage event
- Computational-basis measurement channel/instrument

### 5.3 GKSL exponential

定数generatorに対して、

$$
\mathcal{E}_{\Delta t}
=
\exp(\Delta t\mathcal{L})
$$

を構成する。Python/Rustともにscaling-and-squaring Pade(13)を用いる。

### 5.4 Time-dependent Pulse approximation

時間依存Hamiltonianは各区間の中点で固定する。

$$
\mathcal{E}(T)
\approx
\mathcal{E}_N
\circ\cdots\circ
\mathcal{E}_1
$$

$$
\mathcal{E}_k
=
\exp\left[
\Delta t_k\mathcal{L}(t_{k,\mathrm{mid}})
\right]
$$

Frozen approximation policy:

```text
midpoint_piecewise_constant_v1
```

保証される内容:

- 各interval mapがCPTP
- checkpointまでの合成mapがCPTP
- Python/Rustで同じChoi規約とtoleranceを使用
- density-matrix cleanupを使用しない

保証されない内容:

- midpoint近似と連続時間の厳密解が任意の刻みで完全一致すること
- 実機校正精度
- non-Markovian dynamics
- laboratory-frame carrier dynamics

### 5.5 API/UI integration

Pulse APIとPulse Labは次を選択できる。

```text
fixed_step_rk4
explicit_cptp
```

Backward compatibilityのため、既定値は`fixed_step_rk4`である。

### 5.6 Comparison result

C8のaccepted casesでは、刻み幅を細かくするとRK4/CPTP差が減少した。

Finest-grid trace distance:

| Case | Trace distance |
| --- | ---: |
| Constant qubit open system | `1.52e-9` |
| Two-level Gaussian open system | `1.22e-5` |
| Constant qutrit open system | `3.14e-10` |

全accepted casesの集約値:

```text
maximum CPTP state trace error: approximately 4.55e-14
minimum accepted CPTP state eigenvalue: approximately 1.14e-3
maximum Choi TP residual: approximately 7.78e-14
```

C10判定:

```text
PASS WITH RESTRICTIONS
```

Freeze tag:

```text
quantascope-explicit-cptp-v1
```

---

## 6. 現在のUI実装範囲

### 6.1 Gate-aware UI

実装済み:

- Circuit Studio
- Gate-aware simulation workspace
- Circuit result drawers
- Snapshot-based State Explorer

### 6.2 Pulse UI

実装済み:

- Two-level / qutrit selection
- Square / Gaussian pulse
- Phase / detuning / environment
- DRAG
- RK4 / explicit CPTP selection
- Population / leakage timeline
- Pulse-end / final-state summary
- Qutrit density-matrix heatmap
- CPTP diagnostics drawer

未実装:

- Multi-segment Pulse Sequence Editor
- Pulse専用の時系列State Explorer
- Virtual Z / phase-frame operation
- Repeat / sweep editor
- Circuit-to-pulse compiler

---

## 7. 正式計画上の未完了事項

### 7.1 Phase 3A: QuTiP audit extension

**状態: PARTIAL**

既存のgate-aware RK4、two-level Pulse RK4、qutrit Pulse RK4については、
QuTiPとのshared-equation comparisonが存在する。

未完了なのは主に次である。

- Frozen two-level explicit CPTP pathとQuTiP高精度解の直接比較
- Frozen qutrit explicit CPTP pathとQuTiP高精度解の直接比較
- Python/Rust CPTP出力を同じQuTiP基準へ接続した統合監査
- Tolerance、失敗artifact、近似誤差の事前登録
- Solver agreementとhardware validityの明確な分離

### 7.2 Phase 3B: Hardware observable audit

**状態: NOT STARTED**

必要な内容:

- Calibration set / validation setの分離
- Gate-aware observablesの比較
- Pulse observables、leakage、DRAGの比較
- UncertaintyとSPAM errorの記録
- Model discrepancyの分類
- 不一致結果を含む全artifactの保存

実機アクセスまたは監査可能な公開datasetがない場合、結果を捏造せず、
監査protocolとdataset選定条件までを先に固定する。

### 7.3 Phase 4: Final model decision and documentation

**状態: PLANNED**

Phase 3の証拠を統合した後にのみ、最終model version、適用範囲、limitations、
public-facing explanationを確定する。

Explicit CPTP model freezeの完了は、QuantaScope全物理モデルの最終freeze完了を
意味しない。

---

## 8. 正式な次期実行順序

現在の正式計画に従う実行順序は次のとおりである。

```text
1. Phase 3A audit contractの再確認
2. Two-level explicit CPTP vs QuTiP
3. Qutrit explicit CPTP vs QuTiP
4. Python / Rust / RK4 / CPTP / QuTiP統合比較
5. Phase 3A監査報告と失敗artifact保存
6. Phase 3B dataset/access可否の判断
7. Hardware observable audit
8. Phase 4 final model decision
9. Final technical/public documentation
```

### Go条件

- 同一の$\rho(0)$、$H(t)$、$L_k$、時刻列を使用
- QuTiP側へ温度等を直接渡さず、QuantaScopeと同一のcollapse operatorsを渡す
- RK4/CPTP/QuTiPの比較条件を一致させる
- Toleranceを実行前に固定
- 失敗ケースも保存
- 数値一致と実機妥当性を混同しない

---

## 9. 正式計画外の将来候補

次は有力な拡張だが、現行Phase 3の必須工程ではない。

### 9.1 Gate-aware explicit CPTP

候補となる構成:

```text
Gate-aware CPTP contract
Single-qubit open-system gate map
Multi-qubit gate map
Idle/environment map
Measurement channel/instrument
Circuit channel composition
RK4 comparison
Python/Rust parity
API/UI integration
Separate freeze
```

この開発をPhase 3Aより先に行う場合は、正式計画書を改訂し、QuTiP監査の
entry conditionとPhase番号を変更する必要がある。

### 9.2 Product/UI extensions

- Pulse Sequence Editor
- Pulse専用State Explorer
- Circuit-to-pulse compilation
- Pulse calibration/sweep UI

これらは物理モデル最終化とは別のproduct roadmapとして管理する。

---

## 10. 現在地

```text
Gate-aware V1-V7                     COMPLETE
Pulse Baseline A                     COMPLETE
Pulse Extension B                    COMPLETE
Qutrit / leakage / DRAG              COMPLETE
Python reference freeze              COMPLETE
Rust RK4 parity                      COMPLETE
Explicit qubit/qutrit channels       COMPLETE
Standalone Choi audit                COMPLETE
Channel composition                  COMPLETE
GKSL exponential map                 COMPLETE
Time-dependent CPTP composition      COMPLETE
Python-Rust CPTP parity              COMPLETE
Pulse API / Pulse Lab CPTP           COMPLETE
Explicit CPTP model freeze           COMPLETE

Frozen CPTP-to-QuTiP audit            NOT STARTED
Hardware observable audit            NOT STARTED
Final physical-model decision         NOT STARTED
Final public documentation            NOT STARTED

Gate-aware explicit CPTP              FUTURE CANDIDATE
Pulse Sequence Editor                 FUTURE CANDIDATE
Pulse-specific State Explorer         FUTURE CANDIDATE
Circuit-to-pulse compilation          FUTURE CANDIDATE
```

---

## 11. 現在のGit状態に関する注意

Freeze時のsource commitとtagは次のとおりである。

```text
source commit: 06d1c46
manifest commit: 4a82e75
tag: quantascope-explicit-cptp-v1
```

ただし、2026年7月29日の照合時点では、CPTP freezeとは無関係な未commit変更が
2件残っている。

```text
docs/validation/performance_notes.md
validation_results/pulse_extension_b_markdown_links.json
```

したがって、「clean freeze」はtag作成時の履歴的freezeを指し、現在のworking
tree全体がcleanであるという意味では使用しない。

---

## 12. 結論

QuantaScopeは、gate-aware Hamiltonian-Lindblad model、two-level/qutrit Pulse
model、leakage、DRAG、Python/Rust backend、fixed-step RK4、explicit CPTP
GKSL exponential path、Choi auditを統合した小規模な教育・研究用シミュレーター
として、Phase 2まで完了している。

現在主張できるのは、固定した数理契約の下での数値整合性と、constructed
interval mapsのCPTP性である。

現在はまだ次を主張しない。

- Calibrated hardware model
- 任意の量子デバイスに対する予測精度
- Gate-aware回路全体のexplicit CPTP保証
- Multi-qubit Pulse control
- Non-Markovian dynamics
- Laboratory-frame carrier simulation

次の正式作業は、frozen explicit CPTP pathをQuTiP高精度解と直接比較する
Phase 3A監査拡張である。
