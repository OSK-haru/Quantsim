# Pulse Extension B-4: Gaussian DRAG Control

**Status:** PASS

## Fixed Convention

$$
\Omega_x(t)=\Omega(t),
\qquad
\Omega_y(t)=\beta\frac{d\Omega(t)}{dt}.
$$

`drag_beta_us` is measured in microseconds. Positive quadrature is
+90 degrees from the in-phase axis after applying `phase_rad`.
The validated fixture uses `beta = 0.001 us`; this is not claimed
to be a universal optimum.

## Derivative And Boundary

| Metric | Value |
|---|---:|
| Maximum finite-difference absolute error | `3.257133e-06` |
| Maximum finite-difference relative error | `8.579654e-11` |
| Endpoint amplitude | `1.051167e-01 rad/us` |
| Start derivative | `2.102333e+02 rad/us^2` |
| End derivative | `-2.102333e+02 rad/us^2` |

The analytic Gaussian and derivative are evaluated at both
endpoints. Both are zero strictly outside the support. This retains
the Baseline A hard cutoff; no smooth-edge pulse was introduced.

## Fixed Pi Pulse

| Metric | Beta 0 | Beta 0.001 us |
|---|---:|---:|
| Maximum recorded leakage | `0.364853` | `0.170083` |
| Pulse-end leakage | `0.260634` | `0.022695` |
| Target fidelity | `0.647631` | `0.936293` |
| Computational population | `0.739366` | `0.977305` |

The pulse-end leakage ratio is `0.087076`.

## Pi/2 Fidelity And Phase Guard

| Metric | Beta 0 | Beta 0.001 us |
|---|---:|---:|
| Pulse-end leakage | `0.046973` | `0.007777` |
| Target fidelity | `0.945103` | `0.991033` |
| Phase error [rad] | `0.148707` | `0.060433` |
| Computational population | `0.953027` | `0.992223` |

## Convergence

| Mode | Policy matrix error | Observed orders |
|---|---:|---|
| drag_off | `2.855050e-10` | 3.992, 3.900, 4.080 |
| drag_on | `1.172714e-10` | 3.992, 3.900, 4.080 |

Both DRAG on and off are approximately fourth order for the fixed
fixture. The endpoint discontinuity remains documented and no
universal smooth-pulse convergence claim is made.

## Scope Boundary

- The improvement applies only to the fixed tested conditions.
- The selected beta is not a hardware calibration.
- Baseline A still rejects nonzero DRAG.
- Qutrit HTTP execution remains `contract_only` until B-5.
- Strict finite-step CPTP behavior is not established.

## Artifacts

```text
validation_results/pulse_b_drag.json
validation_results/pulse_b_drag.csv
validation_results/pulse_b_drag_leakage_sweep.png
validation_results/pulse_b_drag_fidelity_phase.png
validation_results/pulse_b_drag_convergence.png
```
