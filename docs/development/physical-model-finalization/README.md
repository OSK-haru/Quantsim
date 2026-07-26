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
| Phase 3A: QuTiP audit | Partial | Existing Python comparison complete | Rust and CPTP comparison extensions |
| Phase 3B: Hardware audit | Not started | Auditable dataset or hardware access | Calibration/validation split and discrepancy report |
| Phase 4: Final model decision | Planned | Phase 0-3 evidence complete | Final versioned model and public explanation |

## Existing Evidence

- Phase 0 inventory and execution record:
  [`phase0-python-reference-freeze.md`](phase0-python-reference-freeze.md)
- Phase 1 Rust parity record:
  [`phase1-rust-parity.md`](phase1-rust-parity.md)
- Phase 2 CPTP execution record:
  [`phase2-explicit-cptp-path.md`](phase2-explicit-cptp-path.md)
- C8 RK4/CPTP comparison:
  [`../../validation/cptp-rk4-comparison.md`](../../validation/cptp-rk4-comparison.md)
- C10 CPTP model freeze:
  [`../../validation/cptp-model-freeze.md`](../../validation/cptp-model-freeze.md)
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
a `PASS WITH RESTRICTIONS` decision. Phase 3 independent audit remains open.
