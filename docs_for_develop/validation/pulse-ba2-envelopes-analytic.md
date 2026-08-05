# PULSE-BA2: Envelope and Analytic Trajectory Validation

## Result

- Overall pass: `True`
- Model: `driven_two_level_rwa_experimental_v1`
- Frame / approximation: `rotating` / `RWA`

## Trajectory Cases

| Case | Max element error | End fidelity | Area error | Cleanup correction | Pass |
|---|---:|---:|---:|---:|---|
| square_x_pi | 7.968573e-10 | 0.999999999990 | 0.000000e+00 | 2.775558e-16 | True |
| square_x_pi_over_2 | 3.984285e-10 | 0.999999999995 | 0.000000e+00 | 2.775558e-16 | True |
| square_two_rabi_periods | 3.187426e-09 | 0.999999999958 | 0.000000e+00 | 2.775558e-16 | True |
| gaussian_x_pi | 5.666531e-09 | 0.999999999796 | 0.000000e+00 | 2.371437e-16 | True |
| gaussian_x_pi_over_2 | 1.928587e-10 | 0.999999999995 | 0.000000e+00 | 2.775558e-16 | True |

## Gaussian Finite-Support Normalization

- Pass: `True`
- Target-angle mode uses the finite erf integral, not the infinite-support approximation.

| Truncation | Finite area error | Infinite-assumption error |
|---:|---:|---:|
| 3 | 0.000000e+00 | 8.481659e-03 |
| 4 | 0.000000e+00 | 1.989963e-04 |
| 5 | 0.000000e+00 | 1.801085e-06 |

## Step Refinement

- Pass: `True`

| Max step [us] | Error | Observed order |
|---:|---:|---:|
| 0.08 | 3.014373e-04 | 3.7754 |
| 0.04 | 2.201341e-05 | 3.9463 |
| 0.02 | 1.428007e-06 | 3.9867 |
| 0.01 | 9.007611e-08 | n/a |

## Post-Pulse Idle

- Idle duration: `1.0` us
- State error: `0.000000e+00`
- Pass: `True`

## Interpretation

The tested resonant, zero-phase square and finite Gaussian pulses agree with the exact commuting-Hamiltonian trajectory over the full sampled evolution. Target-angle Gaussian normalization uses the finite support, and closed idle evolution preserves the pulse-end state.

This phase does not validate nonzero phase, detuning, driven dissipation, qutrit leakage, DRAG, or calibrated hardware behavior.
