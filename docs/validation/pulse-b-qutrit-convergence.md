# Pulse Extension B-3: Qutrit Convergence

**Status:** PASS

## Scope

This validation fixes the non-DRAG qutrit RK4 step policy before
public API or UI exposure. It compares four step refinements with
a finer reference for five standard cases and includes one
deliberately unsafe coarse-step control.

## Frozen Policy

| Parameter | Value |
|---|---:|
| Hamiltonian control epsilon | `0.02` |
| Dissipation control epsilon | `0.02` |
| Gaussian samples per sigma | `32` |
| Maximum internal steps | `25000` |
| State error tolerance | `2.0e-07` |
| Raw minimum eigenvalue tolerance | `-1.0e-09` |

The Hamiltonian limit uses the full qutrit eigenvalue span, so
anharmonicity is included even when the drive is zero. The
dissipative scale includes both adjacent upward/downward channels
and four times the adjacent-coherence dephasing rate.

## Results

| Case | Result | Limiting reason | Policy matrix error |
|---|---:|---|---:|
| free_qutrit_phase_large_anharmonicity | PASS | hamiltonian_spectral_diameter | `5.007e-09` |
| closed_resonant_gaussian_leakage | PASS | hamiltonian_spectral_diameter | `4.647e-10` |
| detuned_gaussian | PASS | hamiltonian_spectral_diameter | `3.466e-10` |
| dissipative_gaussian | PASS | hamiltonian_spectral_diameter | `4.574e-10` |
| pulse_then_idle | PASS | hamiltonian_spectral_diameter | `4.639e-10` |
| deliberately_coarse_unsafe_guard | PASS | qutrit_dissipation | n/a |

## Policy-Step Summary

| Metric | Value |
|---|---:|
| Maximum full-matrix error | `5.006523e-09` |
| Maximum population error | `8.595430e-11` |
| Maximum leakage error | `7.179329e-11` |
| Minimum raw eigenvalue | `-3.849658e-10` |
| Maximum cleanup correction | `2.819873e-16` |

The deliberately coarse control develops a large negative raw
eigenvalue, while the selected policy returns to the declared raw
physicality and state-error bounds. Cleanup is not a PSD projection
and therefore does not conceal that failure.

## Performance And Work Budget

| Metric | Value |
|---|---:|
| Measured internal steps | `32381` |
| Measured total runtime | `29717.072 ms` |
| Measured cost per step | `0.917732 ms` |
| Estimated runtime at budget | `22943.294 ms` |

The recommended future preflight budget is 25,000 internal steps.
This is a deterministic work bound, not a latency guarantee. Qutrit
HTTP execution remains `contract_only` until later B phases.

## Limitations

- Fixed-step RK4 is not claimed to be intrinsically CPTP.
- DRAG, adaptive integration, and qutrit QuTiP comparison are not
  covered here.
- The threshold is supported only for the declared non-DRAG qutrit
  operating fixtures.

## Artifacts

```text
validation_results/pulse_b_qutrit_convergence.json
validation_results/pulse_b_qutrit_convergence.csv
validation_results/pulse_b_qutrit_convergence.png
validation_results/pulse_b_qutrit_physicality.png
```
