# Pulse Baseline A Validation And Freeze Report

## Decision

**Pulse Baseline A result: PASS**

The two-level rotating-frame RWA pulse path is accepted as an experimental,
educational numerical baseline and exposed through the versioned
`POST /api/pulse/simulate` contract.

This decision supports controlled software experiments. It is not evidence of
calibration against a real quantum processor.

## Frozen Identity

```text
model_id: driven_two_level_rwa_experimental_v1
contract_version: pulse-baseline-a-v1
frame: rotating
approximation: RWA
time: us
Hamiltonian/angular frequency: rad/us
rate: 1/us
detuning: drive minus qubit
```

The pure-dephasing collapse operator is:

$$
L_\phi=\sqrt{\gamma_\phi/2}\,\sigma_z.
$$

The population-relaxation convention at finite temperature is:

$$
T_1^{-1}=\gamma_\downarrow+\gamma_\uparrow.
$$

## Numerical Method

- Separate time-dependent Python/NumPy reference path.
- Fixed-step classical RK4.
- $H(t)$ evaluated at all four RK4 stage times.
- Lindblad terms active during pulse and post-pulse idle.
- Raw physicality measured before cleanup.
- Cleanup applied once after each complete RK4 step.
- Open evolution compared with a zero-rate reference evolution.

The frozen step controls are:

```text
h * G_H <= 0.05
h * G_D <= 0.05
h / sigma <= 1 / 20 for Gaussian pulses
```

The API work budget is 200,000 estimated internal steps across the open and
reference evolutions.

## Direct Pulse Validation

| Evidence | Result | Main conclusion |
|---|---|---|
| PULSE-BA2 | PASS | Five analytic square/Gaussian trajectories pass |
| PULSE-BA3 | PASS | Phase, both detuning signs, and gate equivalence pass |
| PULSE-BA4 | PASS | Drive-time and idle-time dissipation pass |
| PULSE-CONV-2LEVEL | PASS | Four standard cases show approximately fourth-order convergence |
| PULSE-QUTIP-2LEVEL | PASS | Six shared problems agree within `5e-7` |
| PULSE-BASELINE-A-FREEZE | PASS | API modes, paths, artifacts, and contract are auditable |

BA-2 used a maximum trajectory element-error tolerance of `2e-8`. BA-4
required raw trace and Hermiticity errors at or below `1e-12`, a raw minimum
eigenvalue no lower than `-1e-10`, and cleanup correction at or below `1e-12`.
The convergence standard tolerance was `2e-7`.

## QuTiP Comparison

QuantaScope and QuTiP received the same:

$$
\rho(0),\quad H(t),\quad L_k,\quad t_j.
$$

The six cases covered resonant Gaussian drive, nonzero phase, positive and
negative detuning, driven dissipation, and pulse-to-idle continuity. Maximum
density-matrix element differences ranged from `2.821e-9` to `6.614e-8`,
below the fixed `5e-7` tolerance.

This validates numerical agreement for shared mathematical problems. It does
not independently validate the physical-input-to-rate mapping or hardware
fidelity.

## Existing Model Regression Guard

The recorded V1-V7 artifacts all report PASS:

| Validation | Role in this freeze |
|---|---|
| V1 | Zero-dissipation/unitary limit |
| V2 | Zero-temperature thermal excitation |
| V3 | Excited-state exponential decay |
| V4 | Pure-dephasing convention |
| V5 | Finite-temperature equilibrium |
| V6 | Existing solver time-step convergence |
| V7 | Existing gate-aware QuTiP comparison |

These primarily guard the existing gate-aware model and shared
collapse-operator/environment conventions. They are not substituted for the
direct BA-2 through BA-5 pulse tests.

## API Freeze Audit

The machine-readable freeze artifact checked 12 prerequisite JSON artifacts,
and all existed with a Boolean pass result. It also executed:

- a direct-rate square pulse,
- a physical-input Gaussian pulse,
- coexistence checks for `/api/simulate` and `/api/pulse/simulate`.

The frozen Pulse OpenAPI SHA-256 at this working state is:

```text
5ae21f2d5f4d7e546e5ba689c7869b70edd0f432835dcfe817dc31f4732dc39b
```

This hash is an audit signal, not a substitute for semantic API tests.

## Performance Observations

The production API is bounded by:

- two concurrent execution slots,
- a 15-second wait timeout,
- a 200,000-step estimated work limit.

The freeze smoke cases are intentionally small and demonstrate contract
execution, not throughput capacity. In the recorded environment, the
direct-rate square smoke took about `268 ms` for 382 estimated internal steps,
and the physical Gaussian smoke took about `250 ms` for 648 estimated internal
steps. These are single-run observations, not benchmarks. Performance should
be re-profiled before increasing snapshot limits, adding qutrits, or exposing
multi-qubit pulse control.

## Regression Gate

The BA-6 final regression gate consists of:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
cd frontend
npm.cmd run build
git diff --check
```

Final command results are recorded in the BA-6 phase document. The freeze JSON
records numerical and API evidence but does not claim to have executed those
external build commands itself.

The completed 2026-07-23 gate produced:

```text
V1-V7 and BA2-BA5 validation scripts: all PASS
Python unit tests: 393 passed in 88.796 s
Frontend production build: PASS
Pulse API/freeze target tests: 32 passed
```

## Scope And Limitations

Baseline A does not provide:

- qutrit or transmon third-level dynamics,
- leakage metrics,
- DRAG,
- laboratory-frame carrier integration,
- transfer-function or wiring distortion,
- crosstalk or multi-qubit pulses,
- non-Markovian environments,
- strict finite-step CPTP guarantees,
- Rust time-dependent execution,
- real-device calibration.

Deliberately coarse convergence fixtures demonstrate that classical RK4 can
produce a negative raw eigenvalue outside the recommended step region.
Cleanup must not be interpreted as a proof of CPTP evolution.

## Artifacts

```text
validation_results/pulse_baseline_a_freeze.json
validation_results/pulse_ba2_envelopes_analytic.json
validation_results/pulse_ba3_phase_detuning_gate_equivalence.json
validation_results/pulse_ba4_open_system_idle.json
validation_results/pulse_convergence_2level.json
validation_results/pulse_qutip_2level.json
```

Supporting reports are under `docs/validation/`. The model definition is in
`docs/physics/pulse-baseline-a-model.md`, and the API contract is in
`docs/architecture/pulse-api-contract.md`.
