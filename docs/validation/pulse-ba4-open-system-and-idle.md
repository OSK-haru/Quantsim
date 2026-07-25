# PULSE-BA4: Open-System Pulse and Post-Pulse Idle

## Result

- Overall pass: `True`
- Model: `driven_two_level_rwa_experimental_v1`
- Frame / approximation: `rotating` / `RWA`

## Required Cases

| Case | Collapse ops | Pulse-end closed fidelity | Pulse-end target fidelity | Final target fidelity | Pass |
|---|---:|---:|---:|---:|---|
| square_relaxation | 1 | 0.74975641 | 0.74975641 | 0.06801637 | True |
| gaussian_dephasing | 1 | 0.72970080 | 0.72970080 | 0.53108662 | True |
| finite_temperature_excitation | 2 | 0.91165428 | 0.91165428 | 0.68998977 | True |
| long_idle_relaxation | 1 | 0.99253585 | 0.99253585 | 0.13432512 | True |

The two pulse-end fidelity columns coincide in these resonant fixtures because the closed pulse endpoint is the requested target. They are computed and labeled separately; they need not coincide for a mismatched target or other control setting.

## Environment Effects

- Square-drive degradation: `2.502436e-01`
- Gaussian-drive degradation: `2.702992e-01`
- Excitation pulse population delta versus gamma-up=0: `8.822583e-02`
- Excitation idle population delta: `2.207951e-01`
- Long-idle target-fidelity drop: `8.582107e-01`
- Pass: `True`

## Zero-Rate Limit

- Maximum density-matrix element error: `5.642694e-09`
- Pass: `True`

## Physical And Direct-Rate Equivalence

- Pulse-end error: `0.000000e+00`
- Final error: `0.000000e+00`
- Pass: `True`

## Raw Physicality

- Maximum raw trace error: `2.220446e-16`
- Maximum raw Hermiticity error: `0.000000e+00`
- Minimum raw eigenvalue: `2.472403e-14`
- Maximum cleanup correction: `2.775558e-16`
- Pass: `True`

## Interpretation

Dissipation is active during both the finite-duration drive and the zero-H idle segment. Fidelity to the closed pulse trajectory and fidelity to the requested target are reported separately because they answer different questions.

The finite-temperature fixture is compared with an otherwise identical gamma-up=0 run. It is not compared with the undriven thermal-equilibrium formula during the drive.

This phase does not establish strict finite-step CPTP behavior, driven steady-state formulas, non-Markovian dynamics, qutrit leakage, DRAG, or calibrated hardware behavior.
