# B-5: QuTiP Qutrit Comparison and API Gate

**Status:** Complete

## 1. Goal

Compare Yuragi-Strider and QuTiP on identical 3x3 mathematical problems, then
decide whether the validated qutrit model may be enabled through the pulse
API.

## 2. Prerequisites

- B-0 through B-4 pass.
- Qutrit tolerances are fixed before the final comparison.
- QuTiP validation remains optional for runtime installation but available in
  the validation environment.

## 3. Comparison Rule

Both solvers must receive the same:

$$
\rho(0),\quad H(t),\quad L_k,\quad t_j.
$$

Do not compare a physical-input Yuragi-Strider problem directly with unrelated
QuTiP parameters. Derive rates once, record them, and pass the same collapse
operators to both solvers.

Use:

```text
subsystem_dimensions: (3,)
matrix shape: 3 x 3
basis order: |0>, |1>, |2>
```

## 4. Required Cases

- Closed Gaussian qutrit pulse
- Detuned leakage trajectory
- Transition-specific qutrit dissipation
- Finite-temperature excitation
- Pure number-noise dephasing
- Pulse followed by idle
- DRAG beta zero
- Nonzero DRAG with both quadratures

Compare full density matrices at common checkpoints, not only final
populations.

## 5. Required Metrics

```text
maximum density-matrix element error
Frobenius norm error
trace-distance-like diagnostic if already supported
population_0 error
population_1 error
population_2 error
leakage error
purity error
```

Record QuTiP solver options and tolerances. QuTiP agreement validates shared
equations and numerical implementation; it does not validate the educational
physical-input mapping or real hardware behavior.

## 6. API Activation Gate

Only after the comparison passes may `/api/pulse/simulate` accept:

```text
model_id: driven_transmon_qutrit_rwa_experimental_v1
```

The qutrit response must expose:

- model and provisional contract identity,
- all three populations,
- leakage metrics,
- 3x3 snapshots,
- qutrit rates and dephasing convention,
- step and raw physicality diagnostics,
- warnings and limitations.

Baseline A requests must continue to return their existing semantic response
without qutrit-only requirements.

## 7. Likely Files

```text
validation_pulse/qutip_adapter.py
validation_pulse/qutrit_qutip.py
api/pulse_models.py
api/pulse_service.py
scripts/validate_pulse_qutip_qutrit.py
tests/test_pulse_b5_qutip_qutrit.py
tests/test_pulse_api_qutrit.py
docs/validation/pulse-b-qutip-qutrit.md
```

## 8. Artifacts

```text
validation_results/pulse_b_qutip_qutrit.json
validation_results/pulse_b_qutip_qutrit.csv
validation_results/pulse_b_qutip_qutrit_error.png
```

## 9. Completion Criteria

- Every required case passes preregistered tolerances.
- Full 3x3 trajectories agree at common times.
- Adapter dimensions and basis ordering are explicit.
- API execution limits use B-3/B-4 cost evidence.
- Qutrit errors are actionable and do not break Baseline A.
- `/api/simulate` remains unchanged.

## 10. Stop Conditions

Do not enable qutrit API success responses if any discrepancy can be explained
only by changing tolerances after inspection, if collapse operators differ
between solvers, or if the cost budget does not safely bound execution.

## 11. Completion Record

- All eight preregistered 3x3 cases passed at the fixed `5e-7` tolerance.
- The maximum density-matrix element error was `5.03e-10`.
- QuTiP receives the exact Yuragi-Strider Hamiltonian and collapse matrices with
  `subsystem_dimensions: (3,)` and basis order `|0>, |1>, |2>`.
- `POST /api/pulse/simulate` now dispatches by `model_id` and accepts the
  qutrit model.
- Baseline A retains `pulse-baseline-a-v1`; qutrit responses use the separate
  `pulse-extension-b-v1` contract.
- The core B-3 work ceiling remains 25,000 steps. The HTTP qutrit gate uses a
  stricter 4,000-step ceiling. B-7 remeasured about 0.965 ms per step on its
  environment, but retained the conservative limit because the API wait
  timeout is 15 seconds and runtime is not guaranteed across machines.
- `POST /api/simulate` was not changed.
