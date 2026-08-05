# B-4: DRAG Control

**Status:** Complete (2026-07-23)

## 1. Goal

Implement the DRAG quadrature for Gaussian qutrit pulses and verify its sign,
units, convergence, leakage effect, and computational-subspace error under
fixed documented conditions.

## 2. Prerequisites

- B-3 qutrit step policy is fixed.
- Closed and dissipative non-DRAG qutrit cases pass.
- Gaussian envelope amplitude and finite-support normalization remain those
  frozen by Baseline A.

## 3. In Scope

- Analytic Gaussian derivative
- Orthogonal DRAG quadrature
- `drag_beta_us`
- Positive, zero, and negative beta sweeps
- DRAG-specific convergence
- Leakage, target fidelity, and phase-error evaluation
- Boundary behavior of the truncated Gaussian

## 4. Fixed Form

For the in-phase Gaussian:

$$
\Omega_x(t)=\Omega(t),
$$

use:

$$
\Omega_y(t)=\beta\frac{d\Omega_x(t)}{dt}.
$$

The API field is:

```text
drag_beta_us
```

because $\Omega_y$ and $\Omega_x$ must share units of rad/us.

The sign and best value of $\beta$ depend on the Hamiltonian and phase
conventions. Do not hard-code $\beta=1/\alpha$ as a universally correct
value.

## 5. Truncation Boundary Rule

Baseline A uses a finite truncated Gaussian. B-4 must explicitly define:

- the derivative inside the pulse support,
- zero drive outside the support,
- the endpoint evaluation rule,
- the residual endpoint amplitude and derivative,
- whether convergence is affected by the hard cutoff.

Do not silently replace the Baseline A envelope with a different smooth-edge
envelope. A smooth-edge variant would require a new envelope type and separate
validation.

## 6. Validation Cases

- Finite-difference check of the analytic derivative away from boundaries.
- $\beta=0$ exactly reproduces the non-DRAG Gaussian qutrit path.
- Positive and negative beta cases verify the quadrature sign.
- A beta sweep around zero records:

```text
maximum leakage
leakage at pulse end
target-state fidelity
computational-subspace phase error
population remaining in the computational subspace
```

- At least one fixed, preregistered condition shows lower leakage for an
  appropriate beta than for beta zero.
- A second condition checks that leakage reduction does not conceal an
  unacceptable target-state or phase error.
- DRAG on/off refinement confirms numerical convergence under the B-3 policy
  or documents an additional derivative-resolution limit.

## 7. Likely Files

```text
core/pulse_envelopes.py
core/pulse_qutrit.py
core/pulse_step_policy.py
validation_pulse/qutrit_drag.py
scripts/validate_pulse_qutrit_drag.py
tests/test_pulse_b4_drag.py
docs/validation/pulse-b-drag.md
```

## 8. Artifacts

```text
validation_results/pulse_b_drag.json
validation_results/pulse_b_drag.csv
validation_results/pulse_b_drag_leakage_sweep.png
validation_results/pulse_b_drag_fidelity_phase.png
validation_results/pulse_b_drag_convergence.png
```

## 9. Completion Criteria

- Units and derivative signs are test-protected.
- Beta zero is exactly backward-compatible with B-3.
- DRAG trajectories converge under a documented step rule.
- The report evaluates leakage, fidelity, and phase together.
- Leakage improvement is claimed only for fixed tested conditions.
- Baseline A continues to reject nonzero DRAG.

## 10. Stop Conditions

Stop before B-5 if apparent leakage reduction disappears under refinement,
depends on a sign inconsistency, or is accompanied by an unreported loss in
computational target fidelity.

## 11. Implemented Boundary Rule

For a Gaussian centered at $t_c$:

$$
\frac{d\Omega}{dt}
=-\frac{t-t_c}{\sigma^2}\Omega(t).
$$

The Gaussian and derivative are evaluated on the inclusive support
$[0,T]$. Both are zero strictly outside that support. The residual endpoint
amplitude and derivative therefore remain explicit discontinuities at the
hard cutoff. Baseline A's envelope was not replaced or smoothed.

For nonzero `phase_rad`, the in-phase axis is rotated by that phase and the
positive DRAG quadrature is the +90-degree orthogonal axis. Nonzero
`drag_beta_us` is accepted only for Gaussian qutrit pulses. Square qutrit
pulses reject it, and Baseline A continues to reject it.

## 12. Fixed Validation Fixture

The demonstrated fixture is:

```text
anharmonicity: -100 MHz
Gaussian sigma: 0.002 us
truncation: 4 sigma
selected tested beta: +0.001 us
```

This beta is a fixed validation value, not a universal formula or hardware
calibration.

For the fixed $\pi$ pulse:

| Metric | Beta 0 | Beta 0.001 us |
|---|---:|---:|
| Maximum recorded leakage | `0.364853` | `0.170083` |
| Pulse-end leakage | `0.260634` | `0.022695` |
| Target fidelity | `0.647631` | `0.936293` |
| Computational population | `0.739366` | `0.977305` |

For the fixed $\pi/2$ pulse:

| Metric | Beta 0 | Beta 0.001 us |
|---|---:|---:|
| Pulse-end leakage | `0.046973` | `0.007777` |
| Target fidelity | `0.945103` | `0.991033` |
| Phase error [rad] | `0.148707` | `0.060433` |
| Computational population | `0.953027` | `0.992223` |

The analytic derivative finite-difference comparison had maximum absolute
error `3.257133e-06 rad/us^2` and maximum relative error `8.579654e-11`.
DRAG on/off policy-step density-matrix errors were `1.172714e-10` and
`2.855050e-10`, respectively, with approximately fourth-order refinement in
the fixed case.

All nine B-4 cases passed, including dissipative compatibility and raw
physicality checks.

Evidence:

```text
docs/validation/pulse-b-drag.md
validation_results/pulse_b_drag.json
validation_results/pulse_b_drag.csv
validation_results/pulse_b_drag_leakage_sweep.png
validation_results/pulse_b_drag_fidelity_phase.png
validation_results/pulse_b_drag_convergence.png
```

Qutrit HTTP execution remains `contract_only`; B-4 does not activate the
public endpoint.
