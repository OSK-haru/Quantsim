# Yuragi-Strider Physical Model Verification Index

## Status

This document replaces the original pre-implementation verification plan.
V1-V7 and Pulse Baseline A have been executed. V8 remains planned.

The final report, reproducible script/test, and machine-readable artifact are
the authoritative records. The original Codex task prompts were removed after
completion because they duplicated the final evidence and contained obsolete
paths.

## Gate-Aware Validation

| ID | Subject | Report | Artifact |
|---|---|---|---|
| V1 | Zero-dissipation unitary limit | [`../../validation/validation-1-zero-dissipation-unitary-limit.md`](../../validation/validation-1-zero-dissipation-unitary-limit.md) | `validation_results/validation1_zero_dissipation.json` |
| V2 | Zero-temperature thermal excitation | [`../../validation/validation-2-zero-temperature-thermal-excitation.md`](../../validation/validation-2-zero-temperature-thermal-excitation.md) | `validation_results/validation2_zero_temperature.json` |
| V3 | Excited-state exponential decay | [`../../validation/validation-3-excited-state-exponential-decay.md`](../../validation/validation-3-excited-state-exponential-decay.md) | `validation_results/validation3_excited_state_decay.json` |
| V4 | Pure dephasing | [`../../validation/validation-4-pure-dephasing.md`](../../validation/validation-4-pure-dephasing.md) | `validation_results/validation4_pure_dephasing.json` |
| V5 | Finite-temperature equilibrium | [`../../validation/validation-5-finite-temperature-equilibrium.md`](../../validation/validation-5-finite-temperature-equilibrium.md) | `validation_results/validation5_finite_temperature_equilibrium.json` |
| V6 | Time-step convergence | [`../../validation/validation-6-time-step-convergence.md`](../../validation/validation-6-time-step-convergence.md) | `validation_results/validation6_time_step_convergence.json` |
| V7 | QuTiP comparison | [`../../validation/validation-7-qutip-comparison.md`](../../validation/validation-7-qutip-comparison.md) | `validation_results/validation7_qutip_comparison.json` |

All V1-V7 artifacts currently report PASS.

## Pulse Baseline A Validation

The consolidated Pulse report is:

[`../../validation/pulse-baseline-a-report.md`](../../validation/pulse-baseline-a-report.md)

It covers analytic envelope trajectories, phase and detuning signs,
open-system pulse/idle behavior, convergence, QuTiP comparison, and the frozen
API contract.

Machine-readable freeze evidence:

```text
validation_results/pulse_baseline_a_freeze.json
```

## Planned External Validation

V8 is intentionally deferred until the gate-aware and pulse extension
implementations are frozen:

[`validation8_real_hardware_observable_validation_plan.md`](validation8_real_hardware_observable_validation_plan.md)

V8 is an external-validity audit. It must not be represented as already
completed or as guaranteed access to private laboratory hardware.

## Evidence Rules

- Do not change production physics merely to make a validation pass.
- Compare identical mathematical inputs when using QuTiP.
- Record units, basis order, rate conventions, tolerances, and solver options.
- Preserve raw physicality diagnostics before cleanup.
- Separate numerical agreement from hardware calibration claims.
- Regenerate artifacts through scripts under `scripts/`; do not edit pass
  fields manually.
