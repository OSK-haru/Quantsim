# Pulse Extension B-5: QuTiP Qutrit Comparison

**Status:** PASS

## Scope

QuantaScope and QuTiP solved the same 3x3 density-matrix problems. Both
received the same initial state, time-dependent Hamiltonian matrices, collapse
operator matrices, and checkpoint times.

```text
basis order: |0>, |1>, |2>
subsystem dimensions: (3,)
matrix shape: 3 x 3
preregistered tolerance: 5e-7
```

## Cases

| Case | Maximum element error | Result |
|---|---:|---:|
| Closed Gaussian qutrit pulse | `2.42e-10` | PASS |
| Detuned leakage trajectory | `4.19e-10` | PASS |
| Transition-specific dissipation | `9.99e-16` | PASS |
| Finite-temperature excitation rates | `1.22e-15` | PASS |
| Pure number-noise dephasing | `2.40e-10` | PASS |
| Pulse followed by idle | `5.03e-10` | PASS |
| DRAG beta zero | `2.92e-10` | PASS |
| Nonzero DRAG with both quadratures | `1.19e-10` | PASS |

## Maximum Errors

| Metric | Maximum |
|---|---:|
| Density-matrix element | `5.0269e-10` |
| Frobenius norm | `9.6319e-10` |
| Trace-distance diagnostic | `6.8220e-10` |
| Population 0 | `2.0398e-11` |
| Population 1 | `9.5440e-11` |
| Population 2 / leakage | `7.5331e-11` |
| Purity | `3.2105e-12` |

## API Gate

The qutrit model is now `available` through `POST /api/pulse/simulate`.
Responses use `pulse-extension-b-v1` and expose three populations, leakage,
3x3 snapshots, qutrit rates and dephasing convention, step diagnostics,
physicality diagnostics, warnings, and limitations.

The B-3 core work ceiling remains 25,000 steps. HTTP execution uses a stricter
4,000-step ceiling. B-7 remeasured about 0.965 ms per step in its environment,
but retained the conservative ceiling because runtime varies by machine and
the API wait timeout remains 15 seconds.

## Interpretation

This comparison supports agreement of the shared equations and numerical
implementation. It does not validate the educational physical-input mapping,
real-device calibration, or predictive hardware fidelity.

## Artifacts

```text
validation_results/pulse_b_qutip_qutrit.json
validation_results/pulse_b_qutip_qutrit.csv
validation_results/pulse_b_qutip_qutrit_error.png
```
