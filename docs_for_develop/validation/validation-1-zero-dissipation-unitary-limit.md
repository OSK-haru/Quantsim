# VALIDATION-1: Zero-Dissipation Unitary Limit

## Purpose

This validation checks that the gate-aware Hamiltonian path reproduces the
ideal circuit unitary when all dissipation rates are zero. It is a numerical
regression check for the current model, not a change to the physics model.

The direct reference is constructed independently as

```text
rho <- U_column rho U_column^dagger
```

The reference does not reuse the effective Hamiltonian or the time integrator.

## Baseline

- Base commit inspected: `8b98eb4`
- Zero dissipation: `ideal_reference=True`
- Rates: `gamma_down_per_us=0`, `gamma_up_per_us=0`, `gamma_phi_per_us=0`
- Collapse operators: empty list
- Idle duration: zero for every case
- Gate durations: `H/X/Z=0.20 us`, `CNOT=0.40 us`
- Total simulation time: sum of column durations
- Time steps for the main cases: `101`
- Basis convention: `q0` is the most significant bit, `|q0 q1 ...>`

The current Hamiltonian convention is an effective angular-frequency
generator. With time in microseconds, `H` is numerically in `1/us` and is
conceptually `rad/us`. It is not an energy-valued Hamiltonian in joules; the
evolution path uses `-i[H, rho]` without an explicit `hbar` division.

## Test Cases

| Case | Circuit | Expected result |
|---|---|---|
| V1-1 | 1q `X(q0)` from `|0>` | `|1>` |
| V1-2 | 1q `H(q0)` from `|0>` | `|+>` |
| V1-3 | 1q `H(q0)` then `Z(q0)` | `|->`; phase-sensitive |
| V1-4 | 2q `H(q0)`, then `CNOT(q0 -> q1)` | Bell state |
| V1-5 | 3q `H(q0)`, `CNOT(q0 -> q1)`, `CNOT(q1 -> q2)` | GHZ state |
| V1-6 | 4q `X(q3)`, `H(q0)`, `CNOT(q0 -> q2)` | nontrivial basis-order check |
| V1-7 | 2q same-column `H(q0) + X(q1)` | same-column product unitary |
| V1-8 | 4q same-column `CNOT(q0 -> q1) + CNOT(q2 -> q3)` | same-column product unitary |

## Numerical Criteria

| Quantity | Tolerance |
|---|---:|
| Maximum density-matrix element error | `1e-8` |
| Frobenius norm error | `1e-8` |
| Trace distance | `1e-8` |
| `1 - fidelity` | `1e-8` |
| Trace error | `1e-10` |
| Hermiticity error | `1e-10` |

## Results

All V1-1 through V1-8 cases passed.

| Case | Max element | Frobenius | Trace distance | Fidelity | Trace error | Result |
|---|---:|---:|---:|---:|---:|---|
| V1-1 | `0.0` | `0.0` | `0.0` | `1.000000000000` | `0.0` | PASS |
| V1-2 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-3 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-4 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-5 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-6 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-7 | `1.11e-16` | `2.22e-16` | `1.11e-16` | `1.000000000000` | `0.0` | PASS |
| V1-8 | `0.0` | `0.0` | `0.0` | `1.000000000000` | `0.0` | PASS |

The phase-sensitive V1-3 off-diagonal density-matrix elements are `-0.5`
within the stated tolerance, confirming the relative phase rather than only
the measurement probabilities.

## Time-Step Comparison

Representative cases were run with coarse/medium/fine settings of `11/51/101`
time steps. The comparison is against the fine result.

| Case | Coarse vs fine max element | Medium vs fine max element | Result |
|---|---:|---:|---|
| V1-2 1q H | `0.0` | `0.0` | PASS |
| V1-4 2q Bell | `0.0` | `0.0` | PASS |

For this zero-dissipation configuration, the current integrator's internal
generator substep policy makes these representative results numerically
identical at the reported precision. This does not replace a separate
finite-rate convergence study.

## Files and Commands

Changed validation files:

- `tests/test_validation_zero_dissipation_unitary_limit.py`
- `scripts/validate_zero_dissipation_unitary_limit.py`
- `docs/validation/validation-1-zero-dissipation-unitary-limit.md`
- `validation_results/validation1_zero_dissipation.json`
- `validation_results/validation1_zero_dissipation.csv`

Commands:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_dissipation_unitary_limit
.\.venv\Scripts\python.exe scripts\validate_zero_dissipation_unitary_limit.py
```

Observed results:

- Unit tests: `2` tests passed
- Validation cases: `8/8` passed
- Time-step comparisons: `2/2` passed

## Scope Audit

- Core physics equations: unchanged
- Lindblad equation: unchanged
- Hamiltonian construction semantics: unchanged
- Gate semantics and basis ordering: unchanged
- API request/response shape: unchanged
- Frontend UI: unchanged
- Rust backend: unchanged
- Default time-step policy: unchanged
