
> **Implemented model history**
>
> The gate-aware Hamiltonian Lindblad path is implemented and validated.
> This file preserves the implementation plan. Use
> `docs/physics/model_identity.md` and `docs/validation/` for current claims.



---


## 目的

現在の標準モデルは、実装上は次の形です。

$$
\rho_{\mathrm{prepared}}
=
U_{\mathrm{circuit}}\rho_0U_{\mathrm{circuit}}^\dagger
$$

$$
\rho(t)
=
\mathcal{E}_{\mathrm{env}}(t)
[
\rho_{\mathrm{prepared}}
]
$$

これは **post-circuit degradation model** です。
つまり、理想回路で準備された状態が、その後に環境で劣化するモデルです。

Phase 7.7 では、これを次の形へ変更します。

$$
\rho_{k+1}
=
\exp(\mathcal{L}_k \tau_k)\rho_k
$$

$$
\mathcal{L}_k\rho
=
-i[H_k,\rho]
+
\sum_j
\mathcal{D}[L_{\downarrow,j}]\rho
+
\sum_j
\mathcal{D}[L_{\uparrow,j}]\rho
+
\sum_j
\mathcal{D}[L_{\phi,j}]\rho
$$

これにより、**各ゲート・各columnの実行時間中にも環境ノイズが作用する**ようにします。

---

# 1. Phase 7.7 の位置づけ

## 正式名称

```text
Phase 7.7: Gate-aware Effective-Hamiltonian Lindblad Simulation
```

## 内部モデル名

```text
gate_aware_hamiltonian_lindblad_v1
```

## 旧モデル名

```text
post_circuit_degradation_v1
```

## 目的の違い

|モデル|内容|扱い|
|---|---|---|
|`post_circuit_degradation_v1`|理想回路後に環境劣化|legacy / comparison|
|`gate_aware_split_step_v1`|ゲート後にduration分ノイズ|fallback / 比較用|
|`gate_aware_hamiltonian_lindblad_v1`|ゲートHamiltonianとLindbladを同時発展|Phase 7.7 標準候補|

---

# 2. 既存コードから再利用するもの

## そのまま再利用

|既存要素|用途|
|---|---|
|`CircuitConfig`, `GateColumn`, `GateOperation`|回路定義|
|`EnvironmentConfig`|環境入力|
|`compute_environment_rates()`|(\gamma_\downarrow,\gamma_\uparrow,\gamma_\phi) 生成|
|`multi_qubit_environment_collapse_operators()`|Lindblad operators 生成|
|`lindblad_rhs()`|Lindblad RHS|
|`rk4_step()`|RK4 時間発展|
|`clean_density_matrix()`|trace正規化・Hermitian化|
|`output_probabilities()`|測定基底確率|
|`_fidelity_series()`|Fidelity|
|`_purity_series()`|Purity|
|`run_simulation(config)`|public API|

`EnvironmentConfig` は既に `model`, `input_mode`, normalized入力、physical入力、`ideal_reference` を持ちます。
環境ratesも `gamma_down_per_us`, `gamma_up_per_us`, `gamma_phi_per_us`, `t1_effective_us`, `t2_effective_us` を統一的に返します。

---

# 3. Phase 7.7 の数式仕様

## 3.1 初期状態

ユーザーが指定した初期状態を

$$
|s_0\rangle,\ |s_1\rangle,\ldots,|s_{n-1}\rangle
$$

とします。

全体状態は

$$
|\psi_0\rangle

|s_0\rangle\otimes |s_1\rangle\otimes\cdots\otimes |s_{n-1}\rangle
$$

密度行列は

$$
\rho_0

|\psi_0\rangle\langle\psi_0|
$$

です。

これは既存の `initial_density_matrix(initial_states)` を使います。

---

## 3.2 column unitary

回路は column 単位で処理します。

ある column (k) に含まれるゲート集合を

$$
g_{k,1}, g_{k,2},\ldots,g_{k,m}
$$

とします。

各ゲートの全Hilbert空間上のユニタリを

$$
U_{k,r}
$$

とすると、column 全体のユニタリを

$$
U_k
=
U_{k,m}\cdots U_{k,2}U_{k,1}
$$

とします。

同じ column 内では、通常は同じ量子ビットを複数ゲートが占有しないよう validation します。`circuit_validation.py` には同じ step の qubit overlap を検出する処理があります。

---

## 3.3 gate duration

各ゲート (g) に duration を与えます。

[
\tau_g
]

単位は (\mu s) です。

初期デフォルト案：

|Gate|duration|
|---|--:|
|`I`|(0.00\ \mu s)|
|`H`|(0.02\ \mu s)|
|`X`|(0.02\ \mu s)|
|`Z`|(0.00\ \mu s)|
|`CNOT`|(0.20\ \mu s)|
|`Measure`|(0.00\ \mu s)|

`GateOperation.params["duration_us"]` があれば上書きします。`GateOperation` はすでに `params: dict[str, float]` を持つため、この拡張に使えます。

column duration は、

$$
\tau_k
=
\max_{g\in \mathrm{column}\ k}\tau_g
$$

です。

---

## 3.4 有効ゲートHamiltonian

Phase 7.7 では、ゲートを一瞬で適用するのではなく、時間 (\tau_k) の間に Hamiltonian で生成します。

対象 column のユニタリを
$$
U_k
$$

とします。

現在サポートしている主なゲート (H,X,Z,CNOT) は、いずれも

$$
U^2=I
$$

を満たす Hermitian unitary です。
その場合、次の有効 Hamiltonian を使えます。

$$
H_k
=
\frac{\pi}{2\tau_k}
(I-U_k)
$$

このとき、

$$
e^{-iH_k\tau_k}

U_k
$$

が成り立ちます。

### 証明

$$U_k^2=I$$ なので、固有値は $$\lambda=\pm 1$$)です。

$$
H_k
=
\frac{\pi}{2\tau_k}(I-U_k)
$$

に対して、(U_k) の固有値 (\lambda) に対応する (H_k) の固有値は

$$
\mu
=
\frac{\pi}{2\tau_k}(1-\lambda)
$$

です。

$$
\lambda=1
\Rightarrow
\mu=0
$$

$$
e^{-i\mu\tau_k}=1
$$

$$
\lambda=-1
\Rightarrow
\mu=\frac{\pi}{\tau_k}
$$

$$
e^{-i\mu\tau_k}
=
 e^{-i\pi}

-1
$$

よって、

$$
e^{-iH_k\tau_k}=U_k
$$

です。

---

## 3.5 Lindblad operators

環境入力から、既存の統一環境モデルで

$$
\gamma_\downarrow,\quad
\gamma_\uparrow,\quad
\gamma_\phi
$$

を計算します。

$$
L_{\downarrow,j}
=
\sqrt{\gamma_\downarrow}\ \sigma_-^{(j)}
$$

$$
L_{\uparrow,j}
=
\sqrt{\gamma_\uparrow}\ \sigma_+^{(j)}
$$

$$
L_{\phi,j}
=
\sqrt{\frac{\gamma_\phi}{2}}\ Z^{(j)}
$$

です。

既存の `multi_qubit_environment_collapse_operators(n_qubits, rates)` がこの生成に使えます。

---

## 3.6 column中の時間発展

各 column (k) の noisy state は、

$$
\frac{d\rho}{dt}

-i[H_k,\rho]
+
\sum_j\mathcal{D}[L_{\downarrow,j}]\rho
+
\sum_j\mathcal{D}[L_{\uparrow,j}]\rho
+
\sum_j\mathcal{D}[L_{\phi,j}]\rho
$$

で $$\tau_k$$ だけ発展します。

ここで、

$$
\mathcal{D}[L]\rho
=
L\rho L^\dagger
-

\frac{1}{2}
\left(
L^\dagger L\rho+\rho L^\dagger L
\right)  $$


です。

したがって、

$$
\rho_k^{\mathrm{noisy}}
\mapsto
\rho_{k+1}^{\mathrm{noisy}}
=
\exp(\mathcal{L}_k\tau_k)
\rho_k^{\mathrm{noisy}}
$$

です。

---

## 3.7 ideal state の更新

Fidelity の比較対象として、ideal state も同時に追跡します。

ただし ideal state にはノイズを入れません。

$$
\rho_{k+1}^{\mathrm{ideal}}
=
U_k\rho_k^{\mathrm{ideal}}U_k^\dagger
$$

最終 Fidelity は、


$$F=

\mathrm{Tr}
\left[
\rho_{\mathrm{final}}^{\mathrm{noisy}}
\rho_{\mathrm{final}}^{\mathrm{ideal}}
\right]  $$


です。

時系列 Fidelity は、


$$F_k
=
\mathrm{Tr}
\left[
\rho_k^{\mathrm{noisy}}
\rho_k^{\mathrm{ideal}}
\right]  $$既存コードの `_fidelity_series()` は

[
$$\mathrm{Tr}(\rho\sigma)  $$
]

を使っているので、そのまま再利用できます。

---

## 3.8 Purity

Purity は従来通りです。

$$
P_k
=
\mathrm{Tr}
\left[
(\rho_k^{\mathrm{noisy}})^2
\right]
]
$$
既存の `_purity_series()` を再利用します。

---

## 3.9 idle evolution

全ゲートの合計時間を

$$
T_{\mathrm{gate}}
=
\sum_k\tau_k
$$

とします。

ユーザー指定の観測時間を


$$T_{\mathrm{sim}}  $$


とします。

もし


$$T_{\mathrm{sim}}>T_{\mathrm{gate}} $$


なら、残り時間

$$
T_{\mathrm{idle}}=

T_{\mathrm{sim}}-T_{\mathrm{gate}}
$$

について

[
H=0
]

で環境発展させます。

$$
\frac{d\rho}{dt}

\sum_j\mathcal{D}[L_{\downarrow,j}]\rho
+
\sum_j\mathcal{D}[L_{\uparrow,j}]\rho
+
\sum_j\mathcal{D}[L_{\phi,j}]\rho
]
$$
これは、回路終了後の保持・待機時間の劣化を表します。

もし

[
$$T_{\mathrm{sim}}<T_{\mathrm{gate}}$$
]

なら、以下のどちらかを採用します。

推奨：

```text
total simulation time is automatically extended to total_gate_duration_us
```

つまり、

# [
$$T_{\mathrm{actual}}

\max(T_{\mathrm{sim}},T_{\mathrm{gate}})  $$
]

にします。

---

# 4. 実装ワークフロー

## Step 0: 現状固定

```bash
git status
python -m unittest discover -s tests
git add -A
git commit -m "Stabilize before phase 7.7 gate-aware Lindblad"
git checkout -b phase7-7-gate-aware-lindblad
```

---

## Step 1: モード名を追加

追加する内部定数：

```python
POST_CIRCUIT_DEGRADATION_MODEL = "post_circuit_degradation_v1"
GATE_AWARE_SPLIT_STEP_MODEL = "gate_aware_split_step_v1"
GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL = "gate_aware_hamiltonian_lindblad_v1"
```

ただし、`run_simulation(config)` の public API は変えません。

---

## Step 2: gate duration utilities を追加

追加関数：

```python
DEFAULT_GATE_DURATIONS_US = {
    "I": 0.0,
    "H": 0.02,
    "X": 0.02,
    "Z": 0.0,
    "CNOT": 0.20,
    "MEASURE": 0.0,
}
```

```python
def gate_duration_us(gate: GateOperation) -> float:
    ...
```

```python
def column_duration_us(column: GateColumn) -> float:
    ...
```

---

## Step 3: gate matrix utilities を追加

既存の `apply_gate_operation()` は直接 state に作用させます。
Phase 7.7 では column unitary (U_k) が必要なので、ゲート行列を返す関数を追加します。

```python
def gate_unitary(gate: GateOperation, n_qubits: int) -> Matrix:
    ...
```

中身は既存の

```python
expand_single_qubit_gate(...)
expand_cnot(...)
```

を使います。

```python
def column_unitary(column: GateColumn, n_qubits: int) -> Matrix:
    ...
```

---

## Step 4: 有効 Hamiltonian を追加

```python
def effective_hamiltonian_from_involution(
    unitary: Matrix,
    duration_us: float,
) -> Matrix:
    ...
```

数式：

[
H=
\frac{\pi}{2\tau}
(I-U)
]

注意：

- (\tau=0) の場合は Hamiltonian を作らない

- (U^2\approx I) でない場合は error または split-step fallback

- (U^\dagger\approx U) でない場合も error または fallback


---

## Step 5: gate-aware Hamiltonian simulation loop を追加

新しい内部関数：

```python
def _simulate_circuit_gate_aware_hamiltonian(
    config: SimulationConfig,
    duration_us: float,
    time_steps: int,
    collapse_ops: list[Matrix],
    max_environment_rate_per_us: float,
) -> tuple[list[float], list[Matrix], list[Matrix], dict[str, float]]:
    ...
```

処理：

```text
1. initial noisy state = initial density matrix
2. initial ideal state = initial density matrix
3. times = [0]
4. states = [noisy]
5. ideal_states = [ideal]
6. elapsed = 0
7. for each column:
     U_col = column_unitary(column)
     tau = column_duration_us(column)
     ideal = U_col ideal U_col†
     if tau == 0:
         noisy = U_col noisy U_col†
     else:
         H_col = effective_hamiltonian_from_involution(U_col, tau)
         noisy = evolve with H_col + collapse_ops for tau
     elapsed += tau
     record elapsed, noisy, ideal
8. if duration_us > elapsed:
     evolve idle with H=0 for remaining duration
     record samples
```

---

## Step 6: time series の扱い

最小実装では、次を記録します。

```text
t = 0
after each column
after idle samples
```

idle部分は既存の `time_steps` を使って分割してよいです。

より細かくするなら、column中もサンプルしますが、Phase 7.7 の初回では必須ではありません。

---

## Step 7: diagnostics を追加

追加する diagnostics / derived parameters：

```text
simulation_mode = gate_aware_hamiltonian_lindblad_v1
gate_aware_noise = true
hamiltonian_mode = effective_involution_generator
total_gate_duration_us
idle_duration_us
actual_duration_us
gate_duration_model
post_circuit_degradation = false
```

---

## Step 8: Expert Inspector の Assumptions 更新

追加する説明：

```text
Gate-aware mode uses effective Hamiltonians that reproduce ideal gates over assigned gate durations.
Noise acts during gate/column execution through a Lindblad master equation.
This is not pulse-level hardware control.
No leakage, crosstalk, drive calibration error, or non-Markovian memory is modeled.
```

`expert_data.py` にはすでに assumptions があり、現在も「no pulse-level control」「not research-grade full simulator」といった制限が記載されています。
ここに Phase 7.7 の前提を追記します。

---

## Step 9: テスト追加

追加テスト：

```text
tests/test_gate_aware_hamiltonian_lindblad.py
```

必須テスト：

1. ideal reference + H

2. ideal reference + Bell

3. zero rates equivalence

4. longer CNOT duration degrades more

5. more columns degrade more

6. idle duration causes additional degradation

7. post-circuit model and gate-aware model differ under finite rates

8. diagnostics include total gate duration and simulation mode


---

# 5. Codex 指示文

以下をそのまま渡せる形で使ってください。

```text
Task:
Implement Phase 7.7: Gate-aware Effective-Hamiltonian Lindblad Simulation.

Background:
The current simulator applies the full circuit ideally first and then applies Lindblad environment evolution afterward. This is a post-circuit state degradation model. It is useful for visualizing degradation of a prepared state, but it does not model noise during gate execution. For Yuragi-Strider to behave more like a quantum circuit simulator, the model must include environmental time evolution during each gate or circuit column.

Goal:
Add a new gate-aware simulation mode:
  gate_aware_hamiltonian_lindblad_v1

This mode should process the circuit column by column. For each column, construct an effective Hamiltonian that generates the column unitary over its assigned duration, then evolve the noisy density matrix under both the gate Hamiltonian and Lindblad dissipators during that duration.

Do not implement pulse-level transmon dynamics. This is an effective-Hamiltonian gate-level model, not a calibrated hardware pulse simulator.

Mathematical specification:

For each column k:
  U_k = product of all gate unitaries in the column
  tau_k = max duration_us of gates in the column

For supported Hermitian involutory gates/columns where U_k^2 ≈ I:
  H_k = (pi / (2 * tau_k)) * (I - U_k)

This satisfies:
  exp(-i H_k tau_k) = U_k

The noisy state evolves as:
  d rho / dt =
      -i [H_k, rho]
      + sum_j D[sqrt(gamma_down) sigma_-^(j)] rho
      + sum_j D[sqrt(gamma_up) sigma_+^(j)] rho
      + sum_j D[sqrt(gamma_phi / 2) Z^(j)] rho

where:
  D[L]rho = L rho L† - 1/2 * (L†L rho + rho L†L)

The ideal state evolves as:
  rho_ideal <- U_k rho_ideal U_k†

Fidelity at each recorded point:
  F = Re Tr(rho_noisy rho_ideal)

Purity:
  P = Re Tr(rho_noisy^2)

Required implementation details:

1. Preserve public API
   - Keep run_simulation(config) as the public entry point.
   - Do not break SimulationConfig or SimulationResult.
   - Do not add external dependencies.

2. Reuse existing components
   - Reuse compute_environment_rates().
   - Reuse multi_qubit_environment_collapse_operators().
   - Reuse lindblad_rhs(), rk4_step(), clean_density_matrix().
   - Reuse initial_density_matrix().
   - Reuse fidelity/purity/output probability logic.
   - Reuse CircuitConfig, GateColumn, and GateOperation.

3. Add simulation mode labels
   - Add:
       post_circuit_degradation_v1
       gate_aware_split_step_v1
       gate_aware_hamiltonian_lindblad_v1
   - The new Phase 7.7 mode is:
       gate_aware_hamiltonian_lindblad_v1
   - Keep old post-circuit behavior only as legacy/internal comparison if needed.

4. Add gate duration utilities
   - Add default durations in microseconds:
       I: 0.0
       H: 0.02
       X: 0.02
       Z: 0.0
       CNOT: 0.20
       Measure: 0.0
   - Allow gate.params["duration_us"] to override defaults.
   - Add:
       gate_duration_us(gate)
       column_duration_us(column)
   - column_duration_us = max gate duration in that column.

5. Add unitary builders
   - Add:
       gate_unitary(gate, n_qubits)
       column_unitary(column, n_qubits)
   - Reuse expand_single_qubit_gate() and expand_cnot().
   - Measure should be treated as identity/no-op for now.

6. Add effective Hamiltonian builder
   - Add:
       effective_hamiltonian_from_involution(unitary, duration_us)
   - Formula:
       H = (pi / (2 * duration_us)) * (I - U)
   - If duration_us == 0:
       do not construct H; apply U directly.
   - Validate approximately:
       U† ≈ U
       U^2 ≈ I
   - If unsupported, raise a clear error or fall back to split-step mode with a warning.

7. Add gate-aware Hamiltonian simulation loop
   - Add an internal function:
       _simulate_circuit_gate_aware_hamiltonian(...)
   - Algorithm:
       a. Initialize noisy_state from initial states.
       b. Initialize ideal_state from initial states.
       c. Record t=0.
       d. For each circuit column in step order:
            U_col = column_unitary(column, n_qubits)
            tau = column_duration_us(column)
            ideal_state = U_col ideal_state U_col†
            if tau == 0:
                noisy_state = U_col noisy_state U_col†
            else:
                H_col = effective_hamiltonian_from_involution(U_col, tau)
                noisy_state = evolve with H_col and collapse_ops for tau
            record elapsed time, noisy_state, ideal_state
       e. If config.duration_us > total_gate_duration_us:
            evolve noisy_state under H=0 for remaining idle time
            record idle samples
       f. If config.duration_us < total_gate_duration_us:
            actual duration should be total_gate_duration_us
            add diagnostic warning or field.

8. Time series behavior
   - At minimum record:
       t=0
       after each column
       after idle samples
   - Preserve compatibility with UI expectations.
   - Fidelity and purity arrays must have the same length as times.
   - output_probabilities should be computed from the final noisy state.

9. Diagnostics and derived parameters
   - Add:
       simulation_mode = gate_aware_hamiltonian_lindblad_v1
       gate_aware_noise = true
       hamiltonian_mode = effective_involution_generator
       total_gate_duration_us
       idle_duration_us
       actual_duration_us
       gate_duration_model
   - Keep existing derived environment parameters:
       gamma_down_per_us
       gamma_up_per_us
       gamma_phi_per_us
       t1_effective_us
       t2_effective_us
       n_th
   - Keep legacy aliases:
       gamma1_per_us
       gammaphi_per_us
       t1_us
       t2_us

10. Expert Inspector assumptions
   - Update assumptions to include:
       "Gate-aware mode uses effective Hamiltonians that reproduce ideal gates over assigned durations."
       "Noise acts during gate/column execution via a Lindblad master equation."
       "This is not pulse-level hardware control."
       "No leakage, crosstalk, drive calibration error, or non-Markovian memory is modeled."

11. Tests
   Add tests/test_gate_aware_hamiltonian_lindblad.py with:

   Test 1: Noiseless H
     - ideal_reference=True
     - H on |0>
     - final fidelity ≈ 1
     - final purity ≈ 1
     - P(0)≈0.5, P(1)≈0.5

   Test 2: Noiseless Bell
     - H q0, CNOT q0 -> q1
     - ideal_reference=True
     - final fidelity ≈ 1
     - final purity ≈ 1
     - P(00)≈0.5, P(11)≈0.5
     - P(01)≈0, P(10)≈0

   Test 3: Zero rates equivalence
     - With gamma_down=gamma_up=gamma_phi=0, gate-aware Hamiltonian mode matches ideal unitary behavior.

   Test 4: Longer CNOT duration causes more degradation
     - Same Bell circuit and same finite environment.
     - Compare CNOT duration 0.20 us vs 2.00 us.
     - Longer duration should have lower or equal final fidelity.

   Test 5: Idle duration causes additional degradation
     - Same circuit and environment.
     - Longer config.duration_us after gate completion should reduce or not improve fidelity.

   Test 6: Gate-aware differs from post-circuit model
     - Under finite rates and nonzero gate durations, gate-aware result should differ from post-circuit degradation.

   Test 7: Diagnostics
     - Result diagnostics or derived parameters include:
         simulation_mode
         total_gate_duration_us
         idle_duration_us
         gate_aware_noise
         hamiltonian_mode

Acceptance criteria:
   - Existing tests pass.
   - New gate-aware tests pass.
   - run_simulation(config) still works.
   - Ideal reference circuits remain ideal.
   - With finite rates, longer gate durations degrade fidelity.
   - Gate-aware mode no longer applies the full circuit ideally before noise.
   - The old post-circuit degradation behavior is not the default user-facing interpretation.
   - No external dependencies are added.

Constraints:
   - Do not implement pulse-level transmon dynamics.
   - Do not implement leakage to |2>.
   - Do not implement crosstalk.
   - Do not implement readout error.
   - Do not implement non-Markovian dynamics.
   - Do not change fidelity definition.
   - Do not change purity definition.
   - Do not change EnvironmentRates.
   - Do not remove legacy config compatibility.
   - Do not start React/FastAPI/QuTiP/Rust work in this phase.
```

---

# 6. Phase 7.7 チェックリスト

```md
## Phase 7.7 Checklist

### Model naming

- [ ] `post_circuit_degradation_v1` を legacy/comparison として定義
- [ ] `gate_aware_split_step_v1` を fallback/comparison として定義
- [ ] `gate_aware_hamiltonian_lindblad_v1` を追加
- [ ] UI/Expert説明で標準候補を gate-aware として説明

### Gate duration

- [ ] default gate durations を定義
- [ ] `gate.params["duration_us"]` override に対応
- [ ] `gate_duration_us(gate)` を追加
- [ ] `column_duration_us(column)` を追加
- [ ] total gate duration を diagnostics に出す

### Unitary / Hamiltonian

- [ ] `gate_unitary(gate, n_qubits)` を追加
- [ ] `column_unitary(column, n_qubits)` を追加
- [ ] `effective_hamiltonian_from_involution(U, tau)` を追加
- [ ] \(U^\dagger \approx U\) を検査
- [ ] \(U^2 \approx I\) を検査
- [ ] duration 0 の場合は direct unitary apply

### Simulation loop

- [ ] 初期状態から noisy_state を開始
- [ ] 初期状態から ideal_state を開始
- [ ] columnごとに ideal_state を更新
- [ ] columnごとに noisy_state を Hamiltonian + Lindblad で発展
- [ ] gate中に noise が作用する
- [ ] 残り時間は idle noise として発展
- [ ] times / fidelity / purity の長さを一致させる

### Outputs

- [ ] Fidelity は noisy vs ideal at same stage
- [ ] Purity は noisy state の \(\mathrm{Tr}(\rho^2)\)
- [ ] Output probabilities は final noisy state
- [ ] Effective Operation Time は新timesで計算
- [ ] derived_parameters に環境ratesを保持
- [ ] diagnostics に gate-aware 情報を追加

### Tests

- [ ] Noiseless H
- [ ] Noiseless Bell
- [ ] Zero rates equivalence
- [ ] Longer CNOT duration degradation
- [ ] Idle duration degradation
- [ ] Gate-aware vs post-circuit difference
- [ ] Diagnostics keys
- [ ] 既存テスト全通過

### Docs / Expert

- [ ] `Expert Inspector > assumptions` 更新
- [ ] 「effective Hamiltonian gate-level model」と明記
- [ ] pulse-levelではないと明記
- [ ] leakage / crosstalk / calibration errorなしと明記
- [ ] 旧 post-circuit degradation model の説明を legacy として整理
```

---
