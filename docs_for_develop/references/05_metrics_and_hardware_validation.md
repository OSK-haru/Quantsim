# 評価指標・実機監査・不確かさ

## 対象

この文書は、state fidelity、trace distance、leakage、randomized
benchmarking、SPAM-aware characterization、およびcalibration/holdout分離を
扱う。

## 1. Jozsa

**区分:** `FOUNDATIONAL`

R. Jozsa, "Fidelity for mixed quantum states,"
*Journal of Modern Optics* 41, 2315-2323 (1994).
[DOI: 10.1080/09500349414552171](https://doi.org/10.1080/09500349414552171)

### 文献の内容

混合状態間fidelityの定義と基本性質を整理する。

### Yuragi-Striderで使用した内容

一般のdensity matrix比較では、

$$
F(\rho,\sigma)
=
\left[
\operatorname{Tr}
\sqrt{\sqrt{\rho}\sigma\sqrt{\rho}}
\right]^2
$$

を基準とする。比較対象が純粋状態なら、

$$
F
=
\langle\psi|\rho|\psi\rangle
$$

へ簡約する。

### 使用箇所

- `core/simulator.py`
- `api/pulse_service.py`
- `api/pulse_qutrit_service.py`
- `validation_pulse/qutrit_drag.py`

### 注意

Yuragi-Striderの画面では、closed trajectory fidelity、target-state fidelity、
completion fidelity、final fidelityを区別する。同じfidelityという語でも
reference stateが異なるため、値を直接混同しない。

## 2. Fuchs and van de Graaf

**区分:** `METHOD BASIS`

C. A. Fuchs and J. van de Graaf,
"Cryptographic distinguishability measures for quantum-mechanical states,"
*IEEE Transactions on Information Theory* 45, 1216-1227 (1999).
[DOI: 10.1109/18.761271](https://doi.org/10.1109/18.761271)

### 文献の内容

量子状態のdistinguishability measureを整理し、trace distanceとfidelityを
関係づける不等式を与える。

### Yuragi-Striderで使用した内容

$$
D_{\mathrm{tr}}(\rho,\sigma)
=
\frac{1}{2}\|\rho-\sigma\|_1
$$

をRK4/CPTP/QuTiP間のstate difference評価に用いる。

### 使用箇所

- `core/cptp_comparison.py`
- `validation_pulse/qutip_adapter.py`
- `validation_cptp/qutip_audit.py`
- `validation_results/cptp_qutip_comparison.csv`

### この文献だけでは支えないもの

- 現行のacceptance tolerance
- hardware prediction errorの許容値
- trajectory全体の集約方法

これらは監査開始前にYuragi-Strider側で事前登録する。

## 3. Wood and Gambetta

**区分:** `VALIDATION BASIS`

C. J. Wood and J. M. Gambetta,
"Quantification and characterization of leakage errors,"
*Physical Review A* 97, 032306 (2018).
[DOI: 10.1103/PhysRevA.97.032306](https://doi.org/10.1103/PhysRevA.97.032306)

### 文献の内容

計算部分空間より大きなHilbert空間におけるleakageとseepageを定量化し、
average gate fidelityと合わせた評価方法を示す。

### Yuragi-Striderで使用した内容

- `|2>` populationを計算部分空間外へのleakageとして独立表示する。
- computational-subspace内で再正規化したfidelityだけを示さない。
- leakageとtarget fidelityを同時に監査する。

### 使用箇所

- `core/pulse_qutrit_open_system.py`
- `api/pulse_qutrit_service.py`
- `validation_pulse/qutrit_drag.py`
- `frontend/src/pages/PulseLabPage.tsx`

### この文献だけでは支えないもの

- 現行UIの`P_leak = rho_22`が一般の多準位leakage全体を表すこと
- leakage randomized benchmarkingを実装済みであること

## 4. Magesan, Gambetta, and Emerson

**区分:** `FUTURE AUDIT`

E. Magesan, J. M. Gambetta, and J. Emerson,
"Scalable and robust randomized benchmarking of quantum processes,"
*Physical Review Letters* 106, 180504 (2011).
[DOI: 10.1103/PhysRevLett.106.180504](https://doi.org/10.1103/PhysRevLett.106.180504)

### 文献の内容

gate setの平均error rateを推定するscalable randomized benchmarkingを示し、
time-dependent、gate-dependent errorを含む条件を解析する。

### Yuragi-Striderでの使用方針

- 将来のGate-aware hardware auditにおけるgate error評価候補
- depth dependenceとsequence decayの評価候補
- state preparation / measurement errorとgate errorを区別する設計参考

### 現在の状態

Randomized benchmarkingは未実装であり、V8の必須endpointではない。
文献は将来拡張の候補根拠として登録する。

## 5. Blume-Kohout et al.

**区分:** `FUTURE AUDIT`

R. Blume-Kohout et al.,
"Demonstration of qubit operations below a rigorous fault tolerance threshold
with gate set tomography," *Nature Communications* 8, 14485 (2017).
[DOI: 10.1038/ncomms14485](https://doi.org/10.1038/ncomms14485)

### 文献の内容

gate set tomographyによって、state preparation、measurement、gateを
self-consistentにcharacterizeする方法を実機で示す。

### Yuragi-Striderでの使用方針

- SPAM errorをモデル誤差へ誤帰属しないための監査設計参考
- simple probability comparisonより厳密な将来監査候補

### 現在の状態

GSTは未実装であり、Yuragi-Striderがfault-tolerance thresholdを満たすという
主張は行わない。

## 6. Kennedy and O'Hagan

**区分:** `VALIDATION BASIS`

M. C. Kennedy and A. O'Hagan,
"Bayesian calibration of computer models,"
*Journal of the Royal Statistical Society: Series B* 63, 425-464 (2001).
[DOI: 10.1111/1467-9868.00294](https://doi.org/10.1111/1467-9868.00294)

### 文献の内容

computer modelのparameter calibration、prediction uncertainty、および
model discrepancyを分離して扱う枠組みを示す。

### Yuragi-Striderで使用した内容

- calibrationに使うdataとholdout prediction dataを分離する。
- parameter uncertaintyとmodel discrepancyを区別する。
- fit後に同じdataで合否を判定しない。
- 実機と不一致の結果も保存する。

### 使用箇所

- `docs/physics/監査方針/validation8_real_hardware_observable_validation_plan.md`
- `docs/development/physical-model-finalization/phase3b-dataset-selection.md`
- `tests/test_phase3b_dataset_registry.py`

### 現在の状態

`QHAD-v1`のdataset contractとcalibration/holdout分離は設計済みだが、
formal hardware holdout監査は未実施である。
