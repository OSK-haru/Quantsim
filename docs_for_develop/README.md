# Yuragi-Strider Documentation Index

## Current Implementation Status

This page is the documentation entry point for the implementation state as of
2026-08-14. Runtime code and tests take precedence if another document
disagrees with this page.

### User-Facing Application

- React 19 / TypeScript / Vite frontend.
- FastAPI application on port 8001 in the documented local setup.
- Home, Simulation, Circuit Studio, State Explorer, Pulse Lab, and Help views.
- Circuit Studio editor and fixed-step RK4 noisy density-matrix execution for
  2-8 logical qubits. Measurement-free ideal circuits above 5 qubits continue
  to use the statevector path; explicit CPTP remains limited to 5 noisy qubits.
- Gate palette: H, X, Y, Z, S, T, RX, RY, RZ, CNOT, CZ, CP, CCX, SWAP, QFT,
  ORACLE, MEASURE, and the MESSAGE/RECEIVED annotation pair.
- Click placement, drag-and-drop placement and movement, drag-out deletion,
  Delete-key deletion, Clear, Undo, and Redo.
- Circuit JSON import/export.
- Result JSON export and import, from the gate-aware and pulse state
  explorers. This is a separate format from the circuit JSON: a result bundle
  carries the inputs that produced it alongside the result, and importing one
  restores both, so the editor state and the displayed figures cannot drift
  apart. An imported result is marked as imported on screen until it is re-run
  (`resultOrigin` in the gate-aware explorer, `origin` on the pulse run
  record). See "Divergent export formats" in `architecture/module_structure.md`
  for the `kind` discriminators this format uses.
- Physical-unit environment inputs in the React simulation flow.
- Result summary, metric timeline, output probabilities, diagnostics, model
  details, warnings, API debug details, and state snapshots.

### Gate-Aware Simulation

- `POST /api/simulate`.
- Preset compatibility through `circuit_preset`: `bell`, `teleportation`, and
  `bit_flip_repetition`.
- Arbitrary circuits through `circuit_config`.
- Core and API accept up to 18 logical qubits; noisy density evolution is
  limited to 8 and explicit CPTP to 5, while ideal measurement-free circuits
  above 5 qubits use the statevector path.
- `MEASURE` is a computational-basis projective measurement. Unassigned
  measurements are non-selective; measurements bound to a classical bit drive
  conditional feed-forward branches.
- Evolution methods: `fixed_step_rk4` (default) and `explicit_cptp`.
- `normalized` and `physical` environment input modes remain supported.
- The React client currently sends `physical` mode and `circuit_config`.
- Default public backend: `python_dense`.
- NumPy dense execution is used when NumPy is available.
- Optional `rust_dense_preview` request path with explicit fallback
  diagnostics.

The current default evolution mode is:

```text
gate_aware_hamiltonian_lindblad_v1
```

### Pulse Baseline A

- `POST /api/pulse/simulate`.
- Contract version `pulse-baseline-a-v1`.
- Model `driven_two_level_rwa_experimental_v1`.
- One two-level qubit, rotating frame, RWA.
- Square and truncated Gaussian control envelopes.
- `physical` and `direct_rates` environment modes.
- Dissipation during the pulse and optional post-pulse idle period.
- Pulse Lab frontend available at `/pulse-lab` for two-level and qutrit runs.
- Pulse Lab does not consume Circuit Studio state; the gate-aware Circuit
  Studio and State Explorer remain gate-aware tools. Pulse trajectories are
  read in the separate Pulse State Explorer at `/pulse-state-explorer`, which
  mirrors the gate-aware explorer panels behind one shared time cursor and
  deliberately omits the Bloch sphere (reducing a qutrit or coupled-transmon
  state onto a sphere hides leakage).

### Pulse Extension B

- B-0 qutrit model and input contract is complete.
- B-1 closed-system qutrit evolution and leakage validation is complete.
- B-2 transition-specific qutrit dissipation validation is complete.
- B-3 qutrit convergence, raw physicality, and safe-step policy is complete.
- B-4 Gaussian DRAG control and convergence validation is complete.
- B-5 independent QuTiP comparison and bounded API activation is complete.
- B-6 independent Pulse Lab UI and frontend contract checks are complete.
- B-7 integration and freeze is complete with `PASS WITH RESTRICTIONS`.
- Declared model: `driven_transmon_qutrit_rwa_experimental_v1`.
- Capability status: `available`.
- Qutrit HTTP execution uses a 25,000-step preflight work ceiling, shared with
  the core validation ceiling.
- Frozen qutrit contract: `pulse-extension-b-v1`.

### Pulse Coupled Transmon Network

- `POST /api/pulse/simulate` with `model_id: "driven_coupled_transmon_network_rwa_experimental_v1"`.
- Contract version `pulse-transmon-network-v1`.
- One to four Duffing transmons with `local_levels` of 2 or 3, scheduled
  simultaneous local drives, arbitrary exchange-coupling edges, rotating
  frames, and RWA. A single transmon is the degenerate network with no edges.
- Pulse Lab exposes this as two axes -- a 2/3 level toggle and a 1-4 transmon
  count -- rather than as separately named models.
- Supersedes the retired `driven_coupled_transmon_pair_rwa_experimental_v1`
  (`pulse-coupled-pair-v1`), which the endpoint no longer accepts; that
  configuration is now `local_levels = 3, transmon_count = 2`.
- Pulse Circuit Studio sends all 2-4 lanes as one scheduled request; Virtual Z
  updates the following local-drive phase without consuming time.
- `fixed_step_rk4` and `explicit_cptp`; the latter is capped at a
  nine-dimensional Hilbert space, so it reaches two three-level or three
  two-level transmons. Dense work and returned density-matrix elements have
  dimension-aware preflight ceilings.
- Correlated quasi-static detuning ensembles are supported, with a per-transmon
  sigma and an adjacent-pair correlation coefficient.
- Always integrates with the NumPy dense kernel; `backend` selects the Python
  or Rust kernel for the other pulse models only.
- Capability status: `experimental`. The independent QuTiP comparison, which
  rebuilds the matrices from the public request spec, reports PASS for both
  RK4 and explicit CPTP.

### Explicitly Not Implemented

- Pulse networks above four transmons. Network explicit CPTP above a
  nine-dimensional Hilbert space.
- Explicit CPTP above 5 noisy qubits; 6-8 noisy qubits are RK4 only.
- Calibrated real-hardware prediction.
- Pulse execution through Rust. The Rust preview kernel covers only the
  gate-aware dense path.
- Measurement post-selection and readout error.
- Trajectory (stochastic) execution; the representation slot is reserved and
  reported as `trajectory_available: false`.
- Godot production UI.

## Canonical Documents

| Topic | Document |
|---|---|
| Project setup | [`../README.md`](../README.md) |
| Runtime modules | [`architecture/module_structure.md`](architecture/module_structure.md) |
| Gate config format | [`architecture/config_format.md`](architecture/config_format.md) |
| Complexity | [`architecture/complexity.md`](architecture/complexity.md) |
| Gate model identity | [`physics/model_identity.md`](physics/model_identity.md) |
| Execution representation policy | [`physics/execution-representations.md`](physics/execution-representations.md) |
| Measurement model | [`physics/gate-aware-measurement-model.md`](physics/gate-aware-measurement-model.md) |
| Explicit CPTP freeze | [`validation/gate-aware-cptp-freeze.md`](validation/gate-aware-cptp-freeze.md) |
| Windows desktop distribution | [`../docs/development/windows-desktop-distribution.md`](../docs/development/windows-desktop-distribution.md) |
| Pulse model | [`physics/pulse-baseline-a-model.md`](physics/pulse-baseline-a-model.md) |
| Qutrit contract | [`physics/pulse-extension-b-qutrit-contract.md`](physics/pulse-extension-b-qutrit-contract.md) |
| Pulse API | [`architecture/pulse-api-contract.md`](architecture/pulse-api-contract.md) |
| Pulse validation | [`validation/pulse-baseline-a-report.md`](validation/pulse-baseline-a-report.md) |
| Closed qutrit validation | [`validation/pulse-b-closed-qutrit.md`](validation/pulse-b-closed-qutrit.md) |
| Qutrit dissipation validation | [`validation/pulse-b-qutrit-dissipation.md`](validation/pulse-b-qutrit-dissipation.md) |
| Qutrit convergence validation | [`validation/pulse-b-qutrit-convergence.md`](validation/pulse-b-qutrit-convergence.md) |
| Qutrit DRAG validation | [`validation/pulse-b-drag.md`](validation/pulse-b-drag.md) |
| Pulse Lab UI validation | [`validation/pulse-b-pulse-lab-ui.md`](validation/pulse-b-pulse-lab-ui.md) |
| Pulse Extension B final report | [`validation/pulse-extension-b-report.md`](validation/pulse-extension-b-report.md) |
| Frozen qutrit model | [`physics/pulse-extension-b-qutrit-model.md`](physics/pulse-extension-b-qutrit-model.md) |
| Physical model finalization roadmap | [`requirements/yuragi_strider_physical_model_finalization_plan.md`](requirements/yuragi_strider_physical_model_finalization_plan.md) |
| Finalization execution status | [`development/physical-model-finalization/README.md`](development/physical-model-finalization/README.md) |
| Planned Pulse Extension B phases | [`development/pulse-extension-b/README.md`](development/pulse-extension-b/README.md) |
| V1-V7 validation reports | [`validation/`](validation/) |
| Repository hygiene audit | [`validation/project-hygiene-audit-2026-07-23.md`](validation/project-hygiene-audit-2026-07-23.md) |
| Planned external validation | [`physics/監査方針/validation8_real_hardware_observable_validation_plan.md`](physics/監査方針/validation8_real_hardware_observable_validation_plan.md) |

## Document Status Rules

Paths below are relative to this `docs_for_develop/` directory. The separate
top-level `docs/` directory holds only generated performance notes and the
Windows desktop distribution guide.

- `architecture/`, `physics/`, and final reports under `validation/` describe
  the current implementation unless explicitly marked otherwise.
- `requirements/` records requirements and decisions. A requirement is not
  proof that a feature is implemented.
- Old phase documents under `development/` are implementation history.
  Documents marked "Historical" or "Superseded" must not be used as current
  runtime instructions.
- Freeze reports record the state at freeze time. Later work may supersede
  individual clauses; the superseding document is named inline where that has
  happened.
- Machine-readable validation truth is stored under `validation_results/`.
- Task prompts are not retained after an equivalent final report and
  reproducible script exist.
