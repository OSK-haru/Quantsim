# QuantaScope Documentation Index

## Current Implementation Status

This page is the documentation entry point for the implementation state as of
2026-07-23. Runtime code and tests take precedence if another document
disagrees with this page.

### User-Facing Application

- React 19 / TypeScript / Vite frontend.
- FastAPI application on port 8001 in the documented local setup.
- Home, Simulation, Circuit Studio, State Explorer, Pulse Lab, and Help views.
- Circuit Studio editor for 2-4 logical qubits.
- H, X, Z, CNOT, and MEASURE placement.
- Click placement, drag-and-drop placement and movement, drag-out deletion,
  Delete-key deletion, Clear, Undo, and Redo.
- Circuit JSON import/export.
- Physical-unit environment inputs in the React simulation flow.
- Result summary, metric timeline, output probabilities, diagnostics, model
  details, warnings, API debug details, and state snapshots.

### Gate-Aware Simulation

- `POST /api/simulate`.
- Preset compatibility through `circuit_preset: "bell"`.
- Arbitrary circuits through `circuit_config`.
- Core and API accept up to 18 logical qubits; noisy density evolution remains limited to 5,
  while ideal measurement-free circuits use the statevector path.
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
- Pulse Lab is a single-pulse flow and does not consume Circuit Studio state;
  Circuit Studio and State Explorer remain gate-aware tools.

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

### Pulse Coupled Transmon Pair

- `POST /api/pulse/simulate` with `model_id: "driven_coupled_transmon_pair_rwa_experimental_v1"`.
- Contract version `pulse-coupled-pair-v1`.
- Two coupled two-level transmons, exchange coupling, rotating frame, RWA.
- Independent QuTiP comparison and numerical audit both report PASS.
- Capability status: `experimental`.

### Explicitly Not Implemented

- Multi-qubit pulse control beyond the coupled transmon-pair model above.
- Strict finite-step CPTP production solver.
- Calibrated real-hardware prediction.
- Pulse execution through Rust.
- Godot production UI.

## Canonical Documents

| Topic | Document |
|---|---|
| Project setup | [`../README.md`](../README.md) |
| Runtime modules | [`architecture/module_structure.md`](architecture/module_structure.md) |
| Gate config format | [`architecture/config_format.md`](architecture/config_format.md) |
| Complexity | [`architecture/complexity.md`](architecture/complexity.md) |
| Gate model identity | [`physics/model_identity.md`](physics/model_identity.md) |
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
| Physical model finalization roadmap | [`requirements/quantascope_physical_model_finalization_plan.md`](requirements/quantascope_physical_model_finalization_plan.md) |
| Finalization execution status | [`development/physical-model-finalization/README.md`](development/physical-model-finalization/README.md) |
| Planned Pulse Extension B phases | [`development/pulse-extension-b/README.md`](development/pulse-extension-b/README.md) |
| V1-V7 validation reports | [`validation/`](validation/) |
| Repository hygiene audit | [`validation/project-hygiene-audit-2026-07-23.md`](validation/project-hygiene-audit-2026-07-23.md) |
| Planned external validation | [`physics/監査方針/validation8_real_hardware_observable_validation_plan.md`](physics/監査方針/validation8_real_hardware_observable_validation_plan.md) |

## Document Status Rules

- `docs/architecture/`, `docs/physics/`, and final reports under
  `docs/validation/` describe the current implementation unless explicitly
  marked otherwise.
- `docs/requirements/` records requirements and decisions. A requirement is
  not proof that a feature is implemented.
- Old phase documents under `docs/development/` are implementation history.
  Documents marked "Historical" or "Superseded" must not be used as current
  runtime instructions.
- Machine-readable validation truth is stored under `validation_results/`.
- Task prompts are not retained after an equivalent final report and
  reproducible script exist.
