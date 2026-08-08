# Phase 3B Pilot Execution Plan

**Status:** Pilot contract frozen for 10-minute trial; external execution not started
**Dataset:** `yuragi_strider_hardware_audit_dataset_v1` (`QHAD-v1`)
**Purpose:** Operational smoke test only, not formal holdout evidence

## Execution boundary

Gate-aware explicit CPTP is now frozen as
`yuragi_strider_gate_aware_cptp_v1`. The Phase 3B execution gate is therefore no
longer blocked by the evolution-method decision. It remains blocked until a
user-owned provider account, explicit network approval, and a fixed budget are
available.

No credentials, provider tokens, or raw hardware data may be stored in this
repository.

## Pilot budget

The first trial is deliberately bounded to fit the provider's reported
10-minute allowance per 28-day period. Eight minutes is the hard QPU budget;
the remaining two minutes are reserved for submission and accounting
uncertainty. The first trial is deliberately bounded:

The current backend metadata snapshot is:

backend: ibm_kingston
backend_version: 1.0.0
native_dt_seconds: 4e-09
calibration_snapshot_at_utc: 2026-08-02T12:26:03Z
candidate_physical_qubits: 150, 151

The local transpilation preview confirmed logical q0/q1 mapped to physical
150/151, with no SWAP insertion and one native CZ plus single-qubit rotations
for the logical CNOT. This is still a pre-submission preview; the final
submitted and provider-compiled circuit must be archived separately.

| Item | Frozen limit |
|---|---:|
| Provider backends | 1 selected superconducting backend |
| Jobs | 1 maximum |
| Circuits per job | 12 maximum |
| Shots per circuit | 32 |
| Total circuits | 12 |
| Total shots | 384 |
| Job timeout | 8 minutes |
| Retry count | 0 |
| QPU time budget | 8 minutes maximum |
| Provider allowance | 10 minutes per 28-day period |
| Safety reserve | 2 minutes |
| Model refit after observations | prohibited |

If any limit is reached, the pilot stops and is recorded as incomplete. It is
not silently extended. The 10-minute provider allowance must not be treated
as a target to consume fully.

## Pulse-level scope

Pulse-level validation is not included in this first QPU trial. Pulse Baseline
A/B already have local numerical, QuTiP, qutrit, and Rust-parity checks, but
those checks do not constitute hardware-calibrated pulse validation. Mixing
pulse observations into this gate-aware pilot would make the budget and claim
boundary unclear. A later pulse hardware audit should use a separate manifest,
separate observables, and a separately approved budget.

## Pilot case set

The first trial uses the following four operational cases. The exact physical
delay values are expressed in the selected backend's native dt and must be
recorded in the raw manifest before submission.

| Case ID | Preparation / circuit | Observable |
|---|---|---|
| `readout_zero_calibration` | prepare `0`, measure | readout distribution |
| `readout_one_calibration` | prepare `1`, measure | readout distribution |
| `t1_delay_pilot` | prepare `1`, delay grid, measure | excited population |
| `single_qubit_gate_idle_pilot` | H, delay grid, measure | gate-plus-idle fidelity proxy |

The readout cases use one zero-delay circuit each. The T1 and gate-aware cases
use five delay points each, giving 12 submitted circuits total. All circuits use
32 shots so they can be submitted as one Runtime job. The pilot manifest must
record the resolved dt, converted microseconds, backend target, compiled
circuit, qubit mapping, and calibration timestamp. Pilot results cannot enter
the formal holdout split. Ramsey, idle, and Bell cases are deferred until a
separate budget is approved.

The provider-neutral manifest is
[`phase3b_pilot_manifest.json`](../../../validation_hardware/phase3b_pilot_manifest.json).
Validate it without network access with:

```powershell
.\.venv\Scripts\python.exe scripts\validate_phase3b_pilot.py --dry-run
```

The validator is implemented in
[`pilot_manifest.py`](../../../validation_hardware/pilot_manifest.py).

## Stop and review conditions

Stop before submission if any of the following is missing:

- provider account and explicit network approval;
- backend properties and calibration snapshot;
- native `dt` and bit-order convention;
- finite timeout and retry configuration;
- raw-count manifest schema;
- source commit and software-version record;
- rights and redistribution decision for downloaded data.

After the pilot, classify each case as `complete`, `failed`, or `excluded` with
a reason. Do not tune the physical model from pilot observations. Formal
calibration and holdout execution requires a separate review after pilot
results are archived.
