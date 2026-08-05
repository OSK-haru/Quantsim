# QuantaScope React Physical Input Specification

> **Status: Implemented and retained as migration history**
>
> React now sends `input_mode: "physical"` with `circuit_config`,
> `gate_duration_defaults`, and bounded `snapshot_options`. The API still
> accepts normalized mode for compatibility. Circuit editing, drag-and-drop,
> import/export, and arbitrary circuit submission described as future work in
> this document are implemented. For current status, use `docs_for_develop/README.md` and
> the code-level schemas in `api/main.py`.

## 目的

この文書は、QuantaScope の React 版 UI における入力仕様を、物理単位ベースの入力へ統一するための設計メモである。

特に、旧 Streamlit 版で扱っていた入力項目、現在の Python core が受け取れる `EnvironmentConfig` / `SimulationConfig`、React + FastAPI 版で今後採用する入力仕様を照合し、回路編集機能に入る前の土台を固定する。

この文書は、今後 Codex が ParameterPanel、API payload、回路エディタ、gate duration、config import/export を実装する際の参照資料として使う。

---

## 1. 背景

現在の React 版は、API 接続と UI 表示を優先して進めてきたため、`normalized_temperature`、`normalized_magnetic_field`、`noise_level` などの正規化入力を中心にしている。

一方、QuantaScope の本来の方向性は、小規模量子回路を開放量子系として扱い、温度、flux noise、qubit frequency、T1/Tphi、gate duration などを用いて、実機に近い環境での状態劣化を可視化することである。

そのため、Drag & Drop 回路編集に入る前に、React 版の標準入力を physical mode に寄せる。

---

## 2. 基本方針

### 採用方針

React 版の標準入力は、今後は physical mode を基本とする。

```text
React standard input mode:
  physical
```

ただし、既存の normalized mode を即座に削除しない。

```text
normalized mode:
  legacy / simple compatibility path

physical mode:
  React standard path
```

### 理由

- U-22 で物理モデルの説得力を示しやすい。
- gate duration や qubit frequency と自然に接続できる。
- Expert Mode / Model details / Help Q&A と言葉を揃えやすい。
- Drag & Drop 回路編集後も、各 gate の実行時間を物理的に扱える。

---

## 3. 現在の安定境界

今後も以下の流れを壊さない。

```text
React frontend
  ↓ fetch
FastAPI local backend
  ↓ build SimulationConfig
core.run_simulation(config)
  ↓ SimulationResult
core.ui_response.simulation_result_to_ui_response(result)
  ↓ SimulationResponse JSON
React frontend display
```

### 禁止事項

- React 側で Lindblad 計算をしない。
- FastAPI 側で物理計算ロジックを複製しない。
- UI タスクで core physics を勝手に変更しない。
- `SimulationResponse` のトップレベル構造を不用意に変えない。
- `gate_aware_cptp_kraus` を実装済みのように見せない。

---

## 4. Streamlit 版 / 旧仕様で意識していた入力

旧 Streamlit 版または開発初期の思想では、主に次の入力を想定していた。

### 環境・デバイス系

```text
temperature
magnetic / flux noise
qubit frequency
T1 / Tphi maximum
observation / simulation duration
noise_level, beginner mode only
```

### 回路系

```text
logical qubits
initial states
gate columns
gate type
control / target
gate duration
```

### 出力系

```text
final fidelity
final purity
completion fidelity
completion purity
T1 / T2 / Tphi
density matrix, future / expert
Bloch sphere, future
output probabilities
```

---

## 5. Core 側の現状入力モデル

Python core には、normalized と physical の両方の入力 mode がある。

### normalized mode

React 版が現在主に使っている簡易入力。

```text
normalized_temperature
normalized_magnetic_field
noise_level
```

内部では、これらを physical inputs へ写像する。

### physical mode

今後 React 版の標準にする入力。

```text
device_quality
temperature_mk
flux_noise_phi0
qubit_frequency_ghz
t1_max_us
tphi_max_us
ideal_reference
```

### simulation parameters

```text
duration_us
time_steps
fidelity_threshold
simulation_backend
```

---

## 6. React 標準入力案

React の ParameterPanel は、最終的に以下を標準入力として扱う。

### Device / Environment

| UI label | Payload key | Unit / Range | 初期値案 | 説明 |
|---|---|---:|---:|---|
| Device quality | `device_quality` | 0.0 to 1.0 | 0.8 | coherence time の良さを表す抽象値 |
| Temperature | `temperature_mk` | mK, >= 0 | 15.0 | qubit の熱励起に影響 |
| Flux noise | `flux_noise_phi0` | Phi0 scale, >= 0 | 1e-6 | 純粋位相緩和に影響 |
| Qubit frequency | `qubit_frequency_ghz` | GHz, > 0 | 5.0 | thermal occupation の計算に使う |
| T1 max | `t1_max_us` | us, > 0 | 100.0 | device quality mapping の上限 |
| Tphi max | `tphi_max_us` | us, > 0 | 100.0 | pure dephasing time mapping の上限 |

### Simulation

| UI label | Payload key | Unit / Range | 初期値案 | 説明 |
|---|---|---:|---:|---|
| Total simulation duration | `duration_us` | us, > 0 | 2.0 | 回路完了後の idle time を含む総時間 |
| Time steps | `time_steps` | integer >= 2 | 101 | timeline のサンプル数 |
| Fidelity threshold | `fidelity_threshold` | 0.0 to 1.0 | 0.9 | Effective operation time の判定 |

### Backend

| UI label | Payload key | 値 | 説明 |
|---|---|---|---|
| Backend | `simulation_backend` | `python_dense` | 標準 backend |
| Backend preview | `simulation_backend` | `rust_dense_preview` | preview扱い。標準扱いしない |

---

## 7. API payload v2 案

### 最小移行版

まずは、preset-based のまま physical mode を受けられるようにする。

```json
{
  "circuit_preset": "bell",
  "simulation_backend": "python_dense",
  "input_mode": "physical",
  "parameters": {
    "device_quality": 0.8,
    "temperature_mk": 15.0,
    "flux_noise_phi0": 0.000001,
    "qubit_frequency_ghz": 5.0,
    "t1_max_us": 100.0,
    "tphi_max_us": 100.0,
    "duration_us": 2.0,
    "time_steps": 101,
    "fidelity_threshold": 0.9
  }
}
```

### 将来の任意回路版

回路エディタ完成後は、preset ではなく `circuit` を送る。

```json
{
  "circuit": {
    "logical_qubits": 2,
    "initial_states": ["0", "0"],
    "columns": [
      {
        "step": 0,
        "gates": [
          {
            "type": "H",
            "targets": [0],
            "controls": [],
            "params": {
              "duration_us": 0.02
            }
          }
        ]
      },
      {
        "step": 1,
        "gates": [
          {
            "type": "CNOT",
            "targets": [1],
            "controls": [0],
            "params": {
              "duration_us": 0.20
            }
          }
        ]
      }
    ]
  },
  "simulation_backend": "python_dense",
  "input_mode": "physical",
  "parameters": {
    "device_quality": 0.8,
    "temperature_mk": 15.0,
    "flux_noise_phi0": 0.000001,
    "qubit_frequency_ghz": 5.0,
    "t1_max_us": 100.0,
    "tphi_max_us": 100.0,
    "duration_us": 2.0,
    "time_steps": 101,
    "fidelity_threshold": 0.9
  }
}
```

---

## 8. Gate duration の扱い

Gate-aware Hamiltonian Lindblad model では、gate duration は物理的に重要である。

### 現在の基本 duration 案

| Gate | Default duration [us] | 備考 |
|---|---:|---|
| I | 0.0 | idle gate としては扱い注意 |
| H | 0.02 | 1-qubit gate |
| X | 0.02 | 1-qubit gate |
| Z | 0.0 | virtual Z 想定 |
| CNOT | 0.20 | 2-qubit gate |
| MEASURE | 0.0 | 現段階では測定表示用 |

### 初期 UI 方針

最初は gate 種別ごとの default duration を使う。

```text
UI first step:
  gate-type default duration only

Later:
  per-gate duration editing
```

### 回路エディタとの接続

Gate palette は、各 gate の default duration を持つ。

```ts
{
  type: "H",
  defaultDurationUs: 0.02
}
```

CircuitConfig へ変換するとき、必要なら `params.duration_us` に書き込む。

```json
{
  "type": "H",
  "targets": [0],
  "controls": [],
  "params": {
    "duration_us": 0.02
  }
}
```

ただし、core 側に default duration があるため、初期実装では `params.duration_us` を省略してもよい。

---

## 9. Simulation duration と idle time

React UI では、`duration_us` の意味を明確にする。

```text
total_gate_duration_us:
  回路の gate duration 合計または column duration 合計

configured duration_us:
  ユーザーが指定する総シミュレーション時間

idle_duration_us:
  max(0, configured duration_us - total_gate_duration_us)
```

### 重要な説明

- `completion_fidelity` は回路が完了した時点の fidelity。
- `final_fidelity` は総シミュレーション時間終了時の fidelity。
- `duration_us` が回路時間より長い場合、回路完了後の idle 区間でも劣化する。

### UI 表示案

```text
Simulation duration: 2.0 us
Estimated circuit duration: 0.22 us
Idle after circuit: 1.78 us
```

これは Model details または Condition details drawer に表示する。

---

## 10. Validation rules

React 側で最低限の validation / clamp を行う。

### Physical parameters

```text
device_quality:
  finite, 0.0 to 1.0

temperature_mk:
  finite, >= 0.0

flux_noise_phi0:
  finite, >= 0.0

qubit_frequency_ghz:
  finite, > 0.0

t1_max_us:
  finite, > 0.0

tphi_max_us:
  finite, > 0.0
```

### Simulation parameters

```text
duration_us:
  finite, > 0.0

time_steps:
  integer, >= 2

fidelity_threshold:
  finite, 0.0 to 1.0
```

### Gate duration parameters

```text
gate duration:
  finite, >= 0.0

Hamiltonian-generated gate duration:
  duration must be > 0.0 for non-identity/non-virtual gates
```

---

## 11. UI layout impact

ParameterPanel は今後、次のように整理する。

```text
ParameterPanel
  Device / Environment
    Device quality
    Temperature [mK]
    Flux noise [Phi0]
    Qubit frequency [GHz]
    T1 max [us]
    Tphi max [us]

  Simulation
    Total duration [us]
    Time steps
    Fidelity threshold

  Gate durations
    H, X, Z, CNOT defaults
    initially read-only or compact editable table
```

表示を重くしすぎないため、以下は drawer または compact details に逃がす。

```text
Derived rates
T1 effective
T2 effective
gamma_down
gamma_up
gamma_phi
n_th
```

---

## 12. 移行ステップ

### SPEC-INPUT-1

この文書を作成し、方針を固定する。

### API-INPUT-1

`POST /api/simulate` が `input_mode: physical` を受け取れるようにする。

- normalized path は維持する。
- physical path を追加する。
- core physics は変更しない。
- `EnvironmentConfig(input_mode="physical", ...)` を正しく組み立てる。

### UI-INPUT-1

React `ParameterPanel` を physical input へ移行する。

- 既存 normalized state は legacy path として残すか、内部から外す。
- UI 初期値を physical default に変える。
- validation を physical rules に変更する。

### UI-INPUT-2

Model details / Condition details に derived values と duration breakdown を表示する。

### UI-3A

Circuit editor state model に入る。

### UI-3B 以降

Gate palette / click-to-place / Drag & Drop へ進む。

---

## 13. Codex 向け注意事項

### 必ず守ること

```text
Do not modify core physics in input-spec/UI tasks.
Do not rewrite Lindblad evolution.
Do not implement CPTP Kraus here.
Do not remove normalized compatibility unless explicitly requested.
Do not make rust_dense_preview the default.
Do not start drag-and-drop circuit editing before input schema migration is complete.
```

### 触ってよい可能性があるファイル

```text
api/main.py
frontend/src/pages/SimulatePage.tsx
frontend/src/components/ParameterPanel.tsx
frontend/src/types/simulation.ts
frontend/src/components/ModelInfoPanel.tsx
frontend/src/components/DiagnosticsCard.tsx
docs/specs/react_physical_input_spec.md
```

### 触るべきでないファイル

```text
core/simulator.py
core/gates.py
core/physical_environment.py
core/results.py
core/rust_dense_kernel.py
```

例外は、明示的に core 仕様変更タスクとして切り出された場合のみ。

---

## 14. 完了条件

この仕様移行が完了したと判断する条件は以下である。

```text
1. POST /api/simulate が physical input payload を受け取れる。
2. React ParameterPanel が physical input を標準表示する。
3. GET /api/simulation/example は引き続き動く。
4. normalized payload は少なくとも互換 path として残る。
5. Low / High noise 相当の比較が physical input でも再現できる。
6. Model details で input_mode: physical が確認できる。
7. Gate duration の扱いが docs と UI で矛盾しない。
8. 回路編集機能に入る前に、duration と input schema の方針が固定されている。
```

---

## 15. 次の実装タスク案

次に実装するべきタスクは以下である。

```text
API-INPUT-1:
  Add physical input mode support to POST /api/simulate

UI-INPUT-1:
  Migrate ParameterPanel to physical input mode

UI-INPUT-2:
  Show duration breakdown and physical derived values in drawers
```

回路編集機能は、この入力仕様移行の後に再開する。
