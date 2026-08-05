# BA-2: Pulse Envelopes and Analytic Validation

## Status

Complete on 2026-07-23.

## 1. Goal

Implement square and finite-duration Gaussian envelopes and validate their
closed-system trajectories against analytic solutions.

## 2. Prerequisites

- BA-1 time-dependent solver passes its stage-time and equivalence tests.

## 3. In Scope

- Square envelope
- Gaussian envelope
- Target-angle and peak-amplitude input modes
- Finite Gaussian truncation and normalization
- Resonant, zero-phase closed-system trajectories
- Rabi oscillation tests
- Pulse-end and post-pulse idle state checks without dissipation

## 4. Out of Scope

- Nonzero phase and detuning
- Lindblad dissipation
- DRAG
- Qutrit leakage

## 5. Envelope Definitions

For a square pulse:

$$
\Omega(t)=\Omega_0
\quad
0\le t\le\tau_p.
$$

For a Gaussian pulse centered at $t_c$:

$$
\Omega(t)
=
\Omega_{\mathrm{peak}}
\exp\left[
-\frac{(t-t_c)^2}{2\sigma^2}
\right].
$$

Use the finite support:

$$
\tau_p=2N_{\mathrm{trunc}}\sigma,
\qquad
t_c=\frac{\tau_p}{2}.
$$

The finite Gaussian area is:

$$
A_{\mathrm{finite}}
=
\Omega_{\mathrm{peak}}\sigma\sqrt{2\pi}
\operatorname{erf}
\left(
\frac{N_{\mathrm{trunc}}}{\sqrt2}
\right).
$$

In target-angle mode, solve
$A_{\mathrm{finite}}=\theta_{\mathrm{target}}$ for the peak amplitude.
Target-angle and peak-amplitude fields are mutually exclusive.

## 6. Analytic References

For:

$$
H(t)=\frac{\Omega(t)}{2}\sigma_x,
$$

the analytic propagator is:

$$
U(t)
=
\exp\left[
-\frac{i\sigma_x}{2}
\int_0^t\Omega(s)\,ds
\right].
$$

For a resonant square pulse starting in $|0\rangle$:

$$
P_1(t)
=
\sin^2\left(\frac{\Omega_0t}{2}\right).
$$

## 7. Required Cases

- Square $X_\pi$
- Square $X_{\pi/2}$
- At least two complete Rabi periods
- Gaussian $X_\pi$
- Gaussian $X_{\pi/2}$
- Gaussian truncation at $3\sigma$, $4\sigma$, and $5\sigma$
- Pulse followed by closed-system idle evolution

## 8. Metrics

- Maximum density-matrix element error
- Frobenius error
- Trace distance
- Bloch-vector error
- Pulse-area error
- Pulse-end target-state fidelity
- Observed convergence order
- Raw cleanup correction norm

## 9. Artifacts

Create machine-readable trajectory and summary outputs plus:

```text
pulse_square_rabi_trajectory.png
pulse_gaussian_analytic_trajectory.png
pulse_gaussian_truncation_error.png
```

## 10. Completion Criteria

- Square-pulse populations follow the Rabi analytic result.
- Gaussian trajectories agree with the integrated-area analytic result over
  the full trajectory, not only at the final time.
- Finite-support normalization produces the requested rotation angle.
- Idle evolution with $H=0$ and no dissipation preserves the pulse-end state.
- Cleanup corrections remain below a documented tolerance.

## 11. Implementation

- `core/pulse_envelopes.py`
  - Defines square and finite-support Gaussian envelopes.
  - Supports direct peak amplitude and target-angle construction.
  - Uses the finite Gaussian integral when deriving a target-angle peak.
  - Builds the two-level rotating-frame RWA Hamiltonian provider.
- `validation_pulse/pulse_analytic.py`
  - Provides exact resonant zero-phase trajectories and comparison metrics.
- `tests/test_pulse_envelopes.py`
  - Checks envelope validation, support, area, and Hamiltonian construction.
- `tests/test_validation_pulse_envelopes_analytic.py`
  - Checks full trajectories, Rabi periods, finite normalization, target
    fidelity, convergence, and closed idle preservation.
- `scripts/validate_pulse_envelopes_analytic.py`
  - Generates machine-readable results, plots, and the validation report.

The existing gate-level solver and `/api/simulate` path are unchanged. The
experimental pulse API remains unavailable until the later integration phase.

## 12. Validation Result

The BA-2 validation passed all required cases:

| Case | Maximum element error | End-state infidelity |
|---|---:|---:|
| Square $X_\pi$ | $7.97\times10^{-10}$ | $1.04\times10^{-11}$ |
| Square $X_{\pi/2}$ | $3.98\times10^{-10}$ | $5.22\times10^{-12}$ |
| Square, two Rabi periods | $3.19\times10^{-9}$ | $4.17\times10^{-11}$ |
| Gaussian $X_\pi$ | $5.67\times10^{-9}$ | $2.04\times10^{-10}$ |
| Gaussian $X_{\pi/2}$ | $1.93\times10^{-10}$ | $4.80\times10^{-12}$ |

Additional checks:

- Finite-support Gaussian area error at $3\sigma$, $4\sigma$, and $5\sigma$:
  zero to recorded double precision.
- Observed RK4 convergence order at the final measured refinement:
  $3.9867$.
- Maximum cleanup correction norm across trajectory cases:
  $2.78\times10^{-16}$.
- Closed post-pulse idle state error:
  zero to recorded double precision.

## 13. Generated Artifacts

- `validation_results/pulse_ba2_envelopes_analytic.json`
- `validation_results/pulse_ba2_envelopes_analytic.csv`
- `validation_results/pulse_square_rabi_trajectory.png`
- `validation_results/pulse_gaussian_analytic_trajectory.png`
- `validation_results/pulse_gaussian_truncation_error.png`
- `docs/validation/pulse-ba2-envelopes-analytic.md`

## 14. Interpretation Boundary

BA-2 validates resonant, zero-phase, closed-system square and finite Gaussian
control envelopes. It does not validate nonzero phase, detuning, driven
dissipation, qutrit leakage, DRAG, calibrated hardware pulse reproduction, or
the Rust backend.
