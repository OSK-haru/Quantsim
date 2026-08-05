# Physical Model Finalization Execution Index

## Purpose

This directory tracks execution of the audited physical-model finalization
roadmap. The canonical requirements and mathematical direction are in
[`../../requirements/quantascope_physical_model_finalization_plan.md`](../../requirements/quantascope_physical_model_finalization_plan.md).

## Current State

| Phase | Status | Entry condition | Main output |
|---|---|---|---|
| Phase 0: Clean Python reference freeze | Complete | Completed | `28b28a5` source commit and `quantascope-python-reference-pulse-b-v1` tag |
| Phase 1: Rust parity | Complete | Phase 0 clean tag | Operator, RHS, RK4-stage, trajectory, and API parity |
| Phase 2: Explicit CPTP path | Complete | Frozen Python/Rust RK4 parity | `quantascope_explicit_cptp_v1` freeze |
| Phase 3A: QuTiP audit | Complete | Phase 2 frozen CPTP path | Independent Python/Rust CPTP comparison with QuTiP |
| Gate-aware explicit CPTP | Complete | Gate-aware Hamiltonian-Lindblad V1 | Constant-GKSL CPTP maps, QuTiP audit, Python/Rust parity, API/UI selection |
| Phase 3B: Hardware audit | In progress | Phase 3A complete | Dataset contract frozen; collection not started |
| Phase 4: Final model decision | Planned | Phase 0-3 evidence complete | Final versioned model and public explanation |

## Existing Evidence

- Phase 0 inventory and execution record:
  [`phase0-python-reference-freeze.md`](phase0-python-reference-freeze.md)
- Phase 1 Rust parity record:
  [`phase1-rust-parity.md`](phase1-rust-parity.md)
- Phase 2 CPTP execution record:
  [`phase2-explicit-cptp-path.md`](phase2-explicit-cptp-path.md)
- Phase 3A QuTiP audit record:
  [`phase3a-qutip-audit.md`](phase3a-qutip-audit.md)
- Phase 3B dataset selection:
  [`phase3b-dataset-selection.md`](phase3b-dataset-selection.md)
- C8 RK4/CPTP comparison:
  [`../../validation/cptp-rk4-comparison.md`](../../validation/cptp-rk4-comparison.md)
- C10 CPTP model freeze:
  [`../../validation/cptp-model-freeze.md`](../../validation/cptp-model-freeze.md)
- Frozen CPTP-to-QuTiP comparison:
  [`../../validation/cptp-qutip-comparison.md`](../../validation/cptp-qutip-comparison.md)
- Pulse Extension B decision:
  [`../../validation/pulse-extension-b-report.md`](../../validation/pulse-extension-b-report.md)
- Frozen qutrit model:
  [`../../physics/pulse-extension-b-qutrit-model.md`](../../physics/pulse-extension-b-qutrit-model.md)
- Machine-readable dirty-tree freeze:
  [`../../../validation_results/pulse_extension_b_freeze.json`](../../../validation_results/pulse_extension_b_freeze.json)
- Planned real-hardware audit:
  [`../../physics/監査方針/validation8_real_hardware_observable_validation_plan.md`](../../physics/監査方針/validation8_real_hardware_observable_validation_plan.md)

## Current Decision

Phase 0 is complete. The historical B-7 manifest still records the dirty tree
that existed before the scoped commit sequence; the canonical Phase 0 record
is `validation_results/phase0_python_reference_freeze.json`.

Phase 1 Rust parity is complete. Phase 2 C0-C10 provides the mathematical
contract, explicit qubit and qutrit Kraus channels, standalone Choi audit,
ordered channel composition, a time-independent GKSL exponential map, and a
midpoint piecewise path for time-dependent pulse segments. The exponential and
piecewise paths have Python-Rust parity coverage, and their accuracy,
physicality, and observed runtime have been compared with RK4. Pulse API and
Pulse Lab now expose an explicit `fixed_step_rk4 | explicit_cptp` selection,
with RK4 retained as the backward-compatible default. Gate-aware execution is
unchanged. The explicit path is frozen as `quantascope_explicit_cptp_v1` with
a `PASS WITH RESTRICTIONS` decision.

Phase 3A is complete. Existing gate-aware and RK4 pulse comparisons are now
joined by a direct Python/Rust explicit-CPTP comparison against the same QuTiP
trajectories. Both required pulse cases pass the preregistered refinement,
physicality, and parity criteria.

Phase 3B is in progress. `QHAD-v1` has been selected as the preregistered
first-party hardware dataset, with NPL and Aalto Zenodo records assigned
separate stress-test and auxiliary-evidence roles. The dataset contract is
frozen, but no network-backed hardware collection has started.
