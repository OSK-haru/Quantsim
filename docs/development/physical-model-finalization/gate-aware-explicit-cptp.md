# Gate-aware Explicit CPTP

**Status:** Implemented and regression-tested
**Date:** 2026-07-29
**Method ID:** `gate_aware_constant_gksl_exponential_v1`

## Purpose

The gate-aware simulator now offers two numerical evolution methods:

```text
fixed_step_rk4
explicit_cptp
```

`fixed_step_rk4` remains the default for backward compatibility. The explicit
CPTP path is opt-in through `POST /api/simulate` and the Simulation Run panel.

## Physical contract

The circuit, environment-rate mapping, gate-duration model, effective gate
Hamiltonian, and collapse operators are unchanged.

For a finite gate column with constant effective Hamiltonian \(H_k\), duration
\(\tau_k\), and collapse operators \(L_j\), the selected map is

\[
\mathcal E_k
=
\exp\left(\tau_k\mathcal L_k\right),
\]

where

\[
\mathcal L_k(\rho)
=
-i[H_k,\rho]
+
\sum_j
\left(
L_j\rho L_j^\dagger
-
\frac{1}{2}\{L_j^\dagger L_j,\rho\}
\right).
\]

The gate Hamiltonian and dissipation therefore remain simultaneous. The
implementation does not split a gate unitary from a later noise channel.

Idle intervals use the same construction with \(H=0\). Every constant-GKSL
finite-time map is converted to a Choi matrix and must pass the configured CP
and trace-preservation tolerances before it is applied.

## Numerical contract

- No density-matrix cleanup is applied on `explicit_cptp`.
- Timeline and requested snapshot boundaries are exact map boundaries.
- Mathematically identical interval maps are cached and reused.
- The ideal reference follows the same effective involution Hamiltonian
  analytically, without an open-system cleanup step.
- Python uses the NumPy Padé-13 exponential implementation.
- `rust_dense_preview` uses the existing Rust Padé-13 exponential and the same
  Python Choi audit.
- RK4 remains available and unchanged.

The diagnostics include:

```text
evolution_method_requested
evolution_method_resolved
evolution_method_id
cptp_guaranteed_by_construction
cleanup_applied
cptp_backend
cptp_map_application_count
cptp_map_construction_count
cptp_minimum_choi_eigenvalue
cptp_maximum_tp_frobenius_error
cptp_maximum_tp_max_abs_error
cptp_all_maps_passed_audit
```

## API and UI

`POST /api/simulate` accepts:

```json
{
  "evolution_method": "explicit_cptp"
}
```

Omitting the field preserves the previous `fixed_step_rk4` behavior. The
Simulation Run panel exposes the same two choices and notes that explicit CPTP
does not use density-matrix cleanup.

## Validation completed

- Noiseless one- and two-qubit gate results reproduce the ideal unitary.
- Finite-noise Bell results remain consistent with the validated RK4 path
  within its finite-step error.
- The Bell final density matrix agrees with an independent QuTiP solve using
  the same Hamiltonians and collapse operators.
- Python and Rust explicit-CPTP Bell results agree within the frozen parity
  tolerance when the Rust extension is available.
- 3- and 4-qubit finite-noise smoke cases pass all map audits without
  physicality issues.
- Existing API input-mode, gate-aware, snapshot, and UI response regressions
  remain passing.
- Frontend production build remains passing.

Primary automated coverage:

- `tests/test_gate_aware_cptp.py`
- `tests/test_gate_aware_hamiltonian_lindblad.py`
- `tests/test_validation_qutip_comparison.py`
- `tests/test_cptp_rust_parity.py`

## Measurement semantics

`MEASURE` remains the existing gate-aware identity placeholder. This change
does not introduce state collapse, outcome sampling, classical registers, or a
measurement instrument into circuit execution. Identity is itself CPTP, but it
must not be described as a simulated projective measurement.

Adding explicit measurement channels or instruments is a separate model and
API decision.

## Scope and limitations

- The state space remains a small dense 1-4 qubit model.
- The environment remains Markovian GKSL/Lindblad.
- Gates remain the current involutory effective-Hamiltonian set.
- Explicit CPTP guarantees numerical channel physicality for the implemented
  maps; it does not establish real-hardware predictive validity.
- Dense Liouville-space exponentials scale rapidly with qubit count. Four
  qubits are supported but cost more than RK4 for many distinct intervals.
- The public Simulation API remains on `python_dense`; Rust selection remains
  a core preview path.
