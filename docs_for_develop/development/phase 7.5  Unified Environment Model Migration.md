> **Implemented migration history**
>
> The unified physical environment and normalized compatibility path are now
> implemented. This is the original migration plan, not a current task list.
> Canonical rate conventions are in `docs/physics/rate-naming-convention.md`.


# 新モデル統合プロセス計画

結論から言うと、これは **Phase 7.5: Unified Environment Model Migration** として実施するのが妥当です。

目的は、旧モデルと新モデルを横並びに残すことではなく、

```text
旧正規化モデル
  → 互換・簡易入力レイヤーへ降格

新物理モデル
  → Yuragi-Striderの標準環境モデルへ昇格
```

にすることです。

現在の構造を見る限り、すでに `run_simulation(config)` が安定入口であり、core と UI を分離する方針も明記されています。
さらに、`simulator.py` 側では `NORMALIZED_ENVIRONMENT_MODEL` と `PHYSICAL_ENVIRONMENT_MODEL` の分岐が入り、物理モデルでは `gamma_down`, `gamma_up`, `gamma_phi_total` を使う構造がすでに見えています。

したがって、今回はゼロから作るのではなく、**既存の二重モデル構造を統一モデル構造へ整理する改修**です。

---

# Phase 7.5 の最終ゴール

## 目標構造

```text
Beginner normalized input
  temperature_parameter
  magnetic_field_parameter
  noise_level
        ↓
NormalizedToPhysicalMapper
        ↓
UnifiedEnvironmentConfig

Expert physical input
  device_quality
  temperature_mk
  flux_noise_phi0
  qubit_frequency_ghz
        ↓
UnifiedEnvironmentConfig

UnifiedEnvironmentConfig
        ↓
EnvironmentRates
  gamma_down_per_us
  gamma_up_per_us
  gamma_phi_per_us
  n_th
  T1_effective_us
  T2_effective_us
        ↓
run_simulation(config)
```

重要なのは、**モデルは1つ、入力モードが2つ**という構造にすることです。

```text
Environment model:
  generic_superconducting_open_system_v1

Input mode:
  normalized
  physical
```

---

# 現状から見た課題

## 現状の良い点

現在の `CircuitConfig` は JSON-friendly な構成で、`GateOperation`, `GateColumn`, `CircuitConfig` が `to_dict()` / `from_dict()` を持っています。React移行や保存形式との相性は良いです。

また、`.qscope.json` 形式では `circuit`, `environment`, `simulation`, `ui` を分ける方針になっており、ロード後は `SimulationConfig` に変換して validation に通す設計です。

## 現状の問題

今は概念的にこうなっています。

```text
normalized_phenomenological_v1
  temperature / magnetic_field / noise_level
  gamma1 / gammaphi

superconducting_qubit_profile_v1
  device_quality / temperature_mk / flux_noise_phi0
  gamma_down / gamma_up / gamma_phi_total
```

このままだと、UI・保存・Expert表示・React移行で毎回、

```text
旧モデルの場合
新モデルの場合
```

の分岐が増えます。

統合後は、

```text
normalized input mode
physical input mode
```

の分岐だけにします。

---

# Phase 7.5 実装ステップ

## Step 0: 現状固定

まず、現在の動作を壊さないために安定版を固定します。

```powershell
git status
python -m unittest discover -s tests
python -m pre_commit run --all-files
git add -A
git commit -m "Stabilize before unified environment model migration"
git checkout -b phase7-5-unified-environment-model
```

## 完了条件

```md
- [ ] 1-qubit H/X/Z が動く
- [ ] 2-qubit Bell が動く
- [ ] Compare が動く
- [ ] Expert physical model が動く
- [ ] Save / Load / Export が動く
- [ ] Open Config後のUI同期が壊れていない
```

---

# Step 1: 新しいモデルIDを定義する

## 目的

旧モデル名・新モデル名をUI上で並べるのをやめ、統一モデル名を導入します。

## 推奨ID

```python
UNIFIED_ENVIRONMENT_MODEL = "generic_superconducting_open_system_v1"
INPUT_MODE_NORMALIZED = "normalized"
INPUT_MODE_PHYSICAL = "physical"
```

既存互換のため、旧IDは残します。

```python
NORMALIZED_ENVIRONMENT_MODEL = "normalized_phenomenological_v1"  # deprecated
PHYSICAL_ENVIRONMENT_MODEL = "superconducting_qubit_profile_v1"  # deprecated alias
```

## 方針

|ID|扱い|
|---|---|
|`generic_superconducting_open_system_v1`|新標準|
|`normalized_phenomenological_v1`|legacy load / migration|
|`superconducting_qubit_profile_v1`|legacy alias / migration|

## 完了条件

```md
- [ ] 新しい `UNIFIED_ENVIRONMENT_MODEL` が定義されている
- [ ] 旧モデルIDは削除せず deprecated として残る
- [ ] validation が新モデルIDを受け入れる
```

---

# Step 2: EnvironmentConfigを統一する

## 目的

`EnvironmentConfig` を「モデル分岐」ではなく「入力モード分岐」にする。

## 推奨構造

```python
@dataclass
class EnvironmentConfig:
    model: str = "generic_superconducting_open_system_v1"
    input_mode: str = "normalized"

    # normalized input
    temperature: float = 0.0
    magnetic_field: float = 0.0
    noise_level: float = 0.0

    # physical input
    device_quality: float = 0.8
    temperature_mk: float = 15.0
    flux_noise_phi0: float = 1e-6
    qubit_frequency_ghz: float = 5.0

    # optional
    observation_strength: float | None = None
    observation_frequency: float | None = None
```

既存コードでは `environment.environment_model` を見ているので、短期的には property で互換性を残します。

```python
@property
def environment_model(self) -> str:
    return self.model
```

ただし、移行完了後の正本は `model` + `input_mode` です。

---

# Step 3: Normalized input を physical input に写像する

## 目的

Beginnerの正規化スライダーを、新標準モデルへの簡易入力に変換する。

## 関数案

```python
def map_normalized_to_physical(environment: EnvironmentConfig) -> PhysicalEnvironmentInputs:
    ...
```

## 推奨写像

### Temperature

```python
temperature_mk = 10.0 + 90.0 * temperature_parameter
```

つまり：

|temperature_parameter|temperature_mk|
|--:|--:|
|0.0|10 mK|
|0.5|55 mK|
|1.0|100 mK|

### Magnetic field parameter

これは実磁場そのものではなく、当面は flux noise amplitude への簡易写像にします。

```python
flux_noise_phi0 = flux_min * (flux_max / flux_min) ** magnetic_field_parameter
```

例：

```python
flux_min = 1e-6
flux_max = 1e-5
```

### Noise level

```python
device_quality = 1.0 - noise_level
```

つまり：

|noise_level|device_quality|
|--:|--:|
|0.0|1.0|
|0.5|0.5|
|1.0|0.0|

これは直感的です。

```text
noise_level が高い
  → device quality が低い
  → T1_base / Tphi_base が短い
```

## 完了条件

```md
- [ ] normalized input から physical input へ変換できる
- [ ] temperature_parameter を上げると temperature_mk が上がる
- [ ] magnetic_field_parameter を上げると flux_noise_phi0 が上がる
- [ ] noise_level を上げると device_quality が下がる
- [ ] 変換結果が finite である
```

---

# Step 4: EnvironmentRatesを標準化する

## 目的

solverが見る散逸率を完全に統一する。

## 新構造

```python
@dataclass(frozen=True)
class EnvironmentRates:
    model: str
    input_mode: str

    n_th: float

    gamma_down_per_us: float
    gamma_up_per_us: float
    gamma_phi_per_us: float

    gamma_phi_base_per_us: float
    gamma_phi_flux_per_us: float

    t1_base_us: float
    tphi_base_us: float
    t1_effective_us: float
    t2_effective_us: float

    device_quality: float
    temperature_mk: float
    flux_noise_phi0: float
    qubit_frequency_ghz: float
```

互換のために alias も derived_parameters に入れます。

```python
"gamma1_per_us": rates.gamma_down_per_us
"gammaphi_per_us": rates.gamma_phi_per_us
"gamma_phi_per_us": rates.gamma_phi_per_us
"t1_us": rates.t1_effective_us
"t2_us": rates.t2_effective_us
```

## 注意

`gamma1` は今後、厳密には `gamma_down` の低温近似です。
UI上ではなるべく新表記を優先します。

```text
Preferred:
  gamma_down
  gamma_up
  gamma_phi

Compatibility:
  gamma1
  gammaphi
```

---

# Step 5: collapse operator を統一する

## 目的

旧 `multi_qubit_collapse_operators` と新 `multi_qubit_physical_collapse_operators` を最終的に一本化する。

## 新関数

```python
def multi_qubit_environment_collapse_operators(
    n_qubits: int,
    rates: EnvironmentRates,
) -> list[Matrix]:
    ...
```

中身は常にこれです。

```text
sqrt(gamma_down) * sigma_minus
sqrt(gamma_up)   * sigma_plus
sqrt(gamma_phi / 2) * sigma_z
```

旧モデル相当では：

```text
gamma_up = 0
gamma_down = gamma1
gamma_phi = gammaphi
```

になります。

現在の `simulator.py` では、物理モデル時に `multi_qubit_physical_collapse_operators(...)`、旧モデル時に `multi_qubit_collapse_operators(...)` を呼び分けています。
この分岐を最終的に `EnvironmentRates -> collapse_operators` に統一します。

---

# Step 6: simulator.py の分岐を整理する

## 現在

```text
if environment.environment_model == PHYSICAL_ENVIRONMENT_MODEL:
    compute_physical_rates(...)
    multi_qubit_physical_collapse_operators(...)
else:
    map_environment_to_t1_t2(...)
    t1_t2_to_gammas(...)
    multi_qubit_collapse_operators(...)
```

## 統合後

```python
rates = compute_environment_rates(config.environment)

collapse_ops = multi_qubit_environment_collapse_operators(
    config.circuit.logical_qubits,
    rates,
)

derived_parameters = environment_rates_to_derived_parameters(rates)
```

この形にする。

## 完了条件

```md
- [ ] `_run_weak_coupling_lindblad` から旧モデル・新モデルの大きな分岐が消える
- [ ] `compute_environment_rates()` が唯一のrates生成入口になる
- [ ] collapse operator生成が統一される
- [ ] 旧configでも simulation が動く
```

---

# Step 7: validation.py を入力モード対応にする

現在の validation は、normalized の `temperature`, `magnetic_field`, `noise_level` を常に検証し、physical model の場合に `device_quality`, `temperature_mk`, `flux_noise_phi0`, `qubit_frequency_ghz` も検証しています。

統合後は、以下のように変えます。

## 方針

```text
input_mode == normalized:
  normalized fields を必須検証
  physical fields は derived または optional

input_mode == physical:
  physical fields を必須検証
  normalized fields は無視または optional
```

## 追加 validation

```text
model == generic_superconducting_open_system_v1
input_mode in {"normalized", "physical"}
```

## 完了条件

```md
- [ ] normalized input mode では正規化値だけが必須
- [ ] physical input mode では物理単位値だけが必須
- [ ] 旧 `environment_model` が来た場合は migration warning
- [ ] invalid input_mode で error
```

---

# Step 8: config schema を更新する

現状の config format は `environment` を serialized `EnvironmentConfig` として持ち、ロード後は validation に通す方針です。
ここを v1.1 に上げるのが妥当です。

## 新 `.qscope.json`

```json
{
  "schema_version": "1.1",
  "kind": "yuragi_strider.config",
  "environment": {
    "model": "generic_superconducting_open_system_v1",
    "input_mode": "normalized",
    "normalized": {
      "temperature_parameter": 0.2,
      "magnetic_field_parameter": 0.1,
      "noise_level": 0.3
    },
    "physical": {
      "device_quality": 0.7,
      "temperature_mk": 28.0,
      "flux_noise_phi0": 1.3e-6,
      "qubit_frequency_ghz": 5.0
    }
  }
}
```

## 物理入力モード

```json
{
  "environment": {
    "model": "generic_superconducting_open_system_v1",
    "input_mode": "physical",
    "physical": {
      "device_quality": 0.5,
      "temperature_mk": 50.0,
      "flux_noise_phi0": 2.0e-5,
      "qubit_frequency_ghz": 5.0
    }
  }
}
```

## legacy migration

v1.0 config:

```json
{
  "environment": {
    "environment_model": "normalized_phenomenological_v1",
    "temperature": 0.2,
    "magnetic_field": 0.1,
    "noise_level": 0.3
  }
}
```

読み込み時に：

```text
model = generic_superconducting_open_system_v1
input_mode = normalized
normalized.temperature_parameter = old.temperature
normalized.magnetic_field_parameter = old.magnetic_field
normalized.noise_level = old.noise_level
```

へ変換します。

---

# Step 9: result log format を更新する

現状の result log は `derived_parameters` に T1/T2/gamma values を含む方針です。
統合後は以下を追加します。

```json
"derived_parameters": {
  "environment_model": "generic_superconducting_open_system_v1",
  "input_mode": "normalized",

  "n_th": 0.0001,

  "gamma_down_per_us": 0.02,
  "gamma_up_per_us": 0.00001,
  "gamma_phi_per_us": 0.03,

  "gamma1_per_us": 0.02,
  "gammaphi_per_us": 0.03,

  "t1_effective_us": 50.0,
  "t2_effective_us": 20.0,

  "device_quality": 0.7,
  "temperature_mk": 28.0,
  "flux_noise_phi0": 1.3e-6,
  "qubit_frequency_ghz": 5.0
}
```

互換表記を残すことで、既存ExportやExpert表示が壊れにくくなります。

---

# Step 10: UIを「モデル選択」から「入力モード選択」に変える

## Before

```text
Environment model:
  normalized_phenomenological_v1
  superconducting_qubit_profile_v1
```

## After

```text
Environment input mode:
  Simple normalized controls
  Expert physical units
```

## Beginner Mode

固定：

```text
input_mode = normalized
```

表示：

```text
Temperature parameter
Magnetic field parameter
Noise level
```

ただし、内部では統一モデルへ変換される。

## Expert Mode

選択可能：

```text
Input Mode:
  Normalized
  Physical Units
```

Physical Units 選択時：

```text
Device Quality
Temperature [mK]
Flux Noise Amplitude [Phi0]
Qubit Frequency [GHz]
```

## Expert Inspector

常に表示：

```text
Environment Model:
  generic_superconducting_open_system_v1

Input Mode:
  normalized / physical

Derived:
  n_th
  gamma_down
  gamma_up
  gamma_phi
  T1 effective
  T2 effective
```

---

# Step 11: テスト計画

## 新規テスト

```text
tests/test_unified_environment.py
tests/test_environment_migration.py
tests/test_unified_environment_simulation.py
```

## `test_unified_environment.py`

```text
- normalized input maps to finite physical inputs
- temperature_parameter increase raises temperature_mk
- magnetic_field_parameter increase raises flux_noise_phi0
- noise_level increase lowers device_quality
- physical input computes finite rates
- gamma_down >= gamma_up at low temperature
- gamma_phi >= 0
- n_th increases with temperature_mk
```

## `test_environment_migration.py`

```text
- legacy normalized config migrates to unified normalized input
- legacy physical config migrates to unified physical input
- schema_version 1.0 loads
- schema_version 1.1 loads
```

## `test_unified_environment_simulation.py`

```text
- 1-qubit H runs with normalized input mode
- 1-qubit H runs with physical input mode
- 2-qubit Bell runs with normalized input mode
- 2-qubit Bell runs with physical input mode
- output probabilities sum to 1
- derived_parameters include gamma_down/gamma_up/gamma_phi
```

## 既存テストで特に守るもの

```text
- gate execution
- two qubit simulation
- bell circuit
- compare workflow
- config IO
- result export
- validation
```

---

# Step 12: 移行完了後の廃止整理

Phase 7.5 完了直後に旧コードを完全削除しない方がよいです。

## 直後

```text
旧関数:
  残す
  deprecated comment を付ける

旧モデルID:
  load/migration only
```

## Plus実装前

```text
UIから旧モデル選択を消す
docsにlegacy migrationを書く
```

## 提出前

```text
削除せず残す
ただしUIには出さない
```

旧config互換は提出時まで残した方が安全です。

---

# Codex指示文

```text
Task:
Implement Phase 7.5: Unified Environment Model Migration.

Goal:
Unify the old normalized environment model and the new physical-unit superconducting-qubit-inspired model into a single standard environment model. The simulator should use one unified rates pipeline based on gamma_down, gamma_up, and gamma_phi. Beginner normalized controls must remain available as a simple input mode, while Expert physical controls expose the physical-unit input mode.

Required changes:

1. Add unified environment model constants
   - Add UNIFIED_ENVIRONMENT_MODEL = "generic_superconducting_open_system_v1"
   - Add INPUT_MODE_NORMALIZED = "normalized"
   - Add INPUT_MODE_PHYSICAL = "physical"
   - Keep old model IDs as deprecated aliases for migration:
     - normalized_phenomenological_v1
     - superconducting_qubit_profile_v1

2. Update EnvironmentConfig
   - Add model field with default UNIFIED_ENVIRONMENT_MODEL
   - Add input_mode field with default INPUT_MODE_NORMALIZED
   - Keep normalized fields:
     - temperature
     - magnetic_field
     - noise_level
   - Keep physical fields:
     - device_quality
     - temperature_mk
     - flux_noise_phi0
     - qubit_frequency_ghz
   - Preserve backward compatibility with old configs.

3. Add normalized-to-physical mapper
   - Implement map_normalized_to_physical(environment)
   - Map:
     - temperature parameter [0,1] to temperature_mk, e.g. 10-100 mK
     - magnetic_field parameter [0,1] to flux_noise_phi0 using log interpolation
     - noise_level [0,1] to device_quality = 1 - noise_level
   - Return finite physical inputs.

4. Add unified EnvironmentRates
   - Implement compute_environment_rates(environment)
   - For input_mode="normalized", first map normalized inputs to physical inputs.
   - For input_mode="physical", use physical inputs directly.
   - Compute:
     - n_th
     - gamma_down_per_us
     - gamma_up_per_us
     - gamma_phi_per_us
     - gamma_phi_base_per_us
     - gamma_phi_flux_per_us
     - t1_base_us
     - tphi_base_us
     - t1_effective_us
     - t2_effective_us
   - Include compatibility aliases in derived parameters:
     - gamma1_per_us = gamma_down_per_us
     - gammaphi_per_us = gamma_phi_per_us
     - t1_us = t1_effective_us
     - t2_us = t2_effective_us

5. Unify collapse operator generation
   - Add multi_qubit_environment_collapse_operators(n_qubits, rates)
   - Always use:
     - sqrt(gamma_down) * sigma_minus
     - sqrt(gamma_up) * sigma_plus
     - sqrt(gamma_phi / 2) * sigma_z
   - For legacy low-temperature equivalent, gamma_up may be approximately zero.

6. Update simulator.py
   - Replace environment_model branching in _run_weak_coupling_lindblad with:
     - rates = compute_environment_rates(config.environment)
     - collapse_ops = multi_qubit_environment_collapse_operators(...)
     - derived_parameters = environment_rates_to_derived_parameters(rates)
   - Keep run_simulation(config) public API unchanged.
   - Do not change gate execution or metrics.

7. Update validation
   - Validate model == UNIFIED_ENVIRONMENT_MODEL for new configs.
   - Validate input_mode in {"normalized", "physical"}.
   - For normalized input mode, validate temperature/magnetic_field/noise_level in [0,1].
   - For physical input mode, validate device_quality, temperature_mk, flux_noise_phi0, qubit_frequency_ghz.
   - Accept old environment_model values only for migration or compatibility.

8. Update save/load schema
   - Move config schema to 1.1.
   - Save:
     - environment.model
     - environment.input_mode
     - environment.normalized
     - environment.physical
   - Load old 1.0 configs and migrate them to the unified model.
   - Existing .qscope.json files must still load.

9. Update result export
   - Include unified environment model and input_mode in derived_parameters.
   - Include gamma_down/gamma_up/gamma_phi.
   - Keep gamma1/gammaphi aliases for compatibility.
   - Do not break existing .qscope.result.json export tests.

10. Update UI
   - Replace Environment Model selector with Environment Input Mode selector.
   - Beginner Mode uses normalized input mode by default.
   - Expert Mode can choose normalized or physical units.
   - Do not show old model IDs in the normal UI.
   - Do not show normalized sliders when physical input mode is active.
   - Do not show physical controls when normalized input mode is active.
   - Expert Inspector should show unified derived rates for both input modes.

11. Tests
   - Add tests/test_unified_environment.py
   - Add tests/test_environment_migration.py
   - Add tests/test_unified_environment_simulation.py
   - Ensure existing tests still pass.

Acceptance criteria:
   - Existing tests pass.
   - Beginner Mode behavior remains simple.
   - Expert Mode can switch input mode, not model.
   - Normalized input mode runs through the unified environment model.
   - Physical input mode runs through the unified environment model.
   - run_simulation(config) still works.
   - Compare still works.
   - Save/Load still works for old and new configs.
   - Result export still works.
   - Derived parameters include gamma_down, gamma_up, gamma_phi, n_th, T1/T2 effective.
   - Legacy gamma1/gammaphi fields remain available as aliases.
   - Old model IDs do not appear as primary UI choices.
   - No React migration is done in this phase.
   - No strong coupling is implemented in this phase.

Constraints:
   - Do not change circuit execution.
   - Do not change fidelity definition.
   - Do not change purity definition.
   - Do not change effective operation time definition.
   - Do not add external dependencies.
   - Do not remove legacy config loading.
   - Do not implement React, FastAPI, Rust, QuTiP, or strong coupling in this phase.
```

---

# 進行順チェックリスト

```md
## Phase 7.5 Checklist

### Model / Config

- [ ] `generic_superconducting_open_system_v1` を追加
- [ ] `input_mode` を追加
- [ ] `normalized` input mode を定義
- [ ] `physical` input mode を定義
- [ ] 旧モデルIDを deprecated alias として残す

### Rates

- [ ] `EnvironmentRates` を追加
- [ ] `compute_environment_rates()` を追加
- [ ] normalized → physical mapper を追加
- [ ] `gamma_down` を計算
- [ ] `gamma_up` を計算
- [ ] `gamma_phi` を計算
- [ ] `n_th` を計算
- [ ] T1/T2 effective を計算

### Solver

- [ ] simulator.py の model分岐を削減
- [ ] collapse operators を統一
- [ ] `run_simulation(config)` は維持
- [ ] 1-qubitが動く
- [ ] 2-qubit Bellが動く

### Validation

- [ ] `input_mode` を検証
- [ ] normalized inputs を検証
- [ ] physical inputs を検証
- [ ] legacy model をmigration扱いにする

### Save / Load / Export

- [ ] schema_version 1.1 に更新
- [ ] 旧configを読み込める
- [ ] 新configを保存できる
- [ ] result derived_parameters に新ratesが入る
- [ ] gamma1/gammaphi alias が残る

### UI

- [ ] model selector を input mode selector に変更
- [ ] Beginnerは normalized 固定
- [ ] Expertは normalized / physical を選べる
- [ ] activeでない入力欄は表示しない
- [ ] Expert Inspectorが統一ratesを表示

### Tests

- [ ] `test_unified_environment.py`
- [ ] `test_environment_migration.py`
- [ ] `test_unified_environment_simulation.py`
- [ ] 既存テスト全通過
```

---

# 最終判断

この Phase 7.5 は、Plus機能前に実施する価値が高いです。

理由は明確です。

```text
今後の React UI
Algorithm Presets
Parameter Sweep
Expert Diagnostics
QuTiP Validation
Strong-coupling Preview
Rust Kernel
```

のすべてが、環境モデルと `SimulationConfig` / `SimulationResult` の安定性に依存するからです。

この統一が終われば、React移行時も、

```text
UIは input_mode を選ぶ
Pythonは同じ unified model で計算する
```

だけになるので、かなり安全になります。

**確信度: 高**
理由: 現在のコードはすでに正規化モデルと物理モデルの分岐を持っており、Config/Result/Validation/Simulatorの境界も存在します。ここで統一ratesパイプラインへ整理すれば、既存資産を壊さずに、今後のReact・Sweep・Algorithm・Expert拡張の土台を安定化できます。
