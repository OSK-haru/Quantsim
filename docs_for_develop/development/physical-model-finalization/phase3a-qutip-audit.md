# Phase 3A: Independent QuTiP Audit

## Status

**COMPLETE**

Decision:

```text
PASS
```

Phase 3A now covers the existing gate-aware and RK4 pulse comparisons plus a
direct comparison of the frozen Python/Rust explicit-CPTP pulse path with
QuTiP.

## Audit Contract

The direct CPTP comparison is frozen as:

```text
audit_id: phase3a_cptp_qutip_v1
freeze_id: quantascope_explicit_cptp_v1
evolution_method_id: explicit_cptp_midpoint_gksl_v1
```

QuantaScope and QuTiP receive identical:

- initial density matrices;
- time-dependent Hamiltonian matrices;
- collapse-operator matrices;
- requested interval-boundary times.

QuTiP does not independently reinterpret temperature, device quality, or
other physical inputs. It solves the matrices already constructed by
QuantaScope using `mesolve` with DOP853, `atol=1e-12`, and `rtol=1e-12`.

This separation is important: the audit checks independent-solver agreement
for the same mathematical problem. It does not establish hardware validity.

## Preregistered Acceptance

Before the acceptance run, the audit fixes:

```text
physicality tolerance: 1e-10
Python/Rust parity tolerance: 2e-10
monotonicity slack: 1e-12
```

Required behavior:

- maximum trajectory trace distance decreases under interval refinement;
- the finest-grid trace distance remains below the case-specific limit;
- CPTP and QuTiP states remain physical within tolerance;
- the composed map passes its Choi CP and TP audit;
- Python and Rust CPTP trajectories agree within tolerance.

The initial two-level pilot used `0.02 / 0.01 / 0.005 us`. It showed the
expected second-order trend, but the finest trace distance was approximately
`9.97e-5`, above the preregistered `5e-5` limit. The acceptance threshold was
not relaxed. Instead, the formal grid was refined to
`0.01 / 0.005 / 0.0025 us`.

## Acceptance Cases

### Two-level Gaussian open pulse

Features:

- Gaussian pulse;
- nonzero phase and detuning;
- downward relaxation;
- thermal excitation;
- pure dephasing.

Finest-grid maximum trajectory trace distance:

```text
Python: 2.49196941623183e-5
Rust:   2.49196941623731e-5
limit:  5e-5
```

### Qutrit DRAG open pulse

Features:

- three-level transmon truncation;
- Gaussian DRAG;
- nonzero phase and detuning;
- transition-specific upward/downward rates;
- number-operator dephasing.

Finest-grid maximum trajectory trace distance:

```text
Python: 8.61346173836938e-6
Rust:   8.61346173862239e-6
limit:  2e-4
```

## Refinement Result

| Case | Backend | Coarse | Medium | Fine |
|---|---|---:|---:|---:|
| Two-level Gaussian | Python | `3.9980e-4` | `9.9733e-5` | `2.4920e-5` |
| Two-level Gaussian | Rust | `3.9980e-4` | `9.9733e-5` | `2.4920e-5` |
| Qutrit DRAG | Python | `1.3791e-4` | `3.4456e-5` | `8.6135e-6` |
| Qutrit DRAG | Rust | `1.3791e-4` | `3.4456e-5` | `8.6135e-6` |

The approximately fourfold error reduction after halving the interval is
consistent with the frozen midpoint piecewise-constant approximation.

Maximum Python/Rust state-element differences:

```text
two-level: 1.78e-15
qutrit:    3.78e-15
```

## Evidence

- Human-readable report:
  [`../../validation/cptp-qutip-comparison.md`](../../validation/cptp-qutip-comparison.md)
- Machine-readable summary:
  [`../../../validation_results/cptp_qutip_comparison.json`](../../../validation_results/cptp_qutip_comparison.json)
- Per-checkpoint metrics:
  [`../../../validation_results/cptp_qutip_comparison.csv`](../../../validation_results/cptp_qutip_comparison.csv)
- Audit implementation:
  [`../../../validation_cptp/qutip_audit.py`](../../../validation_cptp/qutip_audit.py)
- Artifact generator:
  [`../../../scripts/validate_cptp_qutip_comparison.py`](../../../scripts/validate_cptp_qutip_comparison.py)
- Regression tests:
  [`../../../tests/test_cptp_qutip_comparison.py`](../../../tests/test_cptp_qutip_comparison.py)

## Completion Boundary

Phase 3A establishes:

- existing gate-aware RK4 to QuTiP agreement;
- existing two-level and qutrit RK4 pulse to QuTiP agreement;
- direct Python/Rust explicit-CPTP pulse to QuTiP agreement;
- midpoint-refinement behavior for the frozen CPTP path.

Phase 3A does not establish:

- calibrated-hardware prediction;
- non-Markovian validity;
- laboratory-frame carrier accuracy;
- gate-aware explicit-CPTP execution;
- universal accuracy outside the tested cases.

Phase 3B remains not started until an auditable hardware or public dataset is
selected and calibration/validation separation is fixed.
