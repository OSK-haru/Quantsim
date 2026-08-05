# Pulse Baseline A Development Phases

## 1. Purpose

Pulse Baseline A adds and validates a two-level, rotating-frame RWA
control-envelope model without changing the existing gate-level simulation
path.

The model ID is fixed as:

```text
driven_two_level_rwa_experimental_v1
```

The result of Baseline A is a validated numerical and API foundation. A full
Pulse Lab UI, qutrit dynamics, leakage, and DRAG belong to Pulse Extension B.

## 2. Phase Map

| Phase | Status | Title | Main result |
|---|---|---|---|
| [BA-0](phase-ba0-model-contract.md) | Complete | Model contract and regression guard | Physics, units, model ID, and API contract are fixed |
| [BA-1](phase-ba1-time-dependent-solver.md) | Complete | Time-dependent solver path | A separate RK4 path evaluates Hamiltonians at every RK4 stage |
| [BA-2](phase-ba2-envelopes-and-analytic-validation.md) | Complete | Pulse envelopes and analytic trajectories | Square and finite Gaussian pulses agree with analytic solutions |
| [BA-3](phase-ba3-phase-detuning-and-gate-equivalence.md) | Complete | Phase, detuning, and gate equivalence | Sign conventions and target unitaries are verified |
| [BA-4](phase-ba4-open-system-and-idle.md) | Complete | Open-system pulse and post-pulse idle | Lindblad dissipation works during drive and idle |
| [BA-5](phase-ba5-convergence-and-qutip.md) | Complete | Convergence and QuTiP comparison | Step policy and independent solver agreement are established |
| [BA-6](phase-ba6-integration-and-freeze.md) | Complete | API integration and baseline freeze | Contract, reports, regressions, and limitations are frozen |

Traceability to the A0-A10 sequence in the Pulse Phase v3 plan:

| v3 item | This plan |
|---|---|
| A0 | BA-0 |
| A1 | BA-1 |
| A2, A3, A4 | BA-2 |
| A5, A9 | BA-3 |
| A6 | BA-4 |
| A7, A8 | BA-5 |
| A10 | BA-6 |

The dependency order is:

```text
BA-0
  |
BA-1
  |
BA-2
  |
BA-3
  |
BA-4
  |
BA-5
  |
BA-6
```

## 3. Shared Physical Conventions

Baseline A uses:

```text
frame: rotating frame
approximation: rotating-wave approximation (RWA)
time unit: microsecond
Hamiltonian unit: rad / microsecond
rate unit: 1 / microsecond
```

The detuning convention is:

$$
\Delta=\omega_d-\omega_q.
$$

The Hamiltonian is:

$$
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x
+
\sin\phi\,\sigma_y
\right).
$$

The displayed model description must be:

```text
rotating-frame RWA control-envelope experimental model
```

It must not be described as calibrated pulse-level hardware reproduction.

## 4. Shared Engineering Rules

- Keep the existing constant-Hamiltonian gate path unchanged.
- Add a separate time-dependent Python/NumPy reference path.
- Do not route Python callbacks through the Rust backend.
- Evaluate the Hamiltonian at all four RK4 stage times.
- Record physicality before and after density-matrix cleanup.
- Keep `physical` and `direct_rates` input modes explicitly separate.
- Do not silently loosen tolerances to make a validation pass.
- Do not add qutrit, leakage, DRAG, multi-qubit pulse control, or laboratory-frame carrier integration.
- Preserve the existing `/api/simulate` request and response behavior.

## 5. Common Regression Gate

At each completed phase, run the tests introduced by that phase and the
existing relevant regression suite. At BA-6, run the full gate:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
cd frontend
npm.cmd run build
```

The V1-V7 physical validations must still pass at every milestone where core
evolution code is changed.

## 6. Common Validation Artifacts

Numerical validation phases should write reviewable artifacts under:

```text
validation_results/
  pulse_<id>.json
  pulse_<id>.csv
  pulse_<id>_trajectory.png
  pulse_<id>_error.png
  pulse_<id>_convergence.png

docs/validation/
  pulse-<id>-report.md
```

Each machine-readable result should include, where applicable:

```text
base_git_commit
python_version
numpy_version
scipy_version
qutip_version
model_id
frame
approximation
input_payload
internal_units
step_policy
cleanup_policy
tolerances
pass_fail
scope_and_limitations
```

## 7. Handoff To Extension B

Baseline A is frozen. The planned qutrit, leakage, DRAG, QuTiP qutrit, and
Pulse Lab work is divided into separate phases in:

[`../pulse-extension-b/README.md`](../pulse-extension-b/README.md)

Extension B must consume this baseline without changing the validated
two-level model or its existing API semantics.
