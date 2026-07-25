# Pulse BA-5: QuTiP Two-Level Comparison

**Result:** PASS

## Comparison Contract

Both solvers receive the same initial density matrix, exact time-dependent Hamiltonian matrices, collapse-operator matrices, and requested output times. QuantaScope uses its fixed-step RK4 reference path; QuTiP uses `mesolve` with DOP853.

The matrix-difference tolerance was fixed at `5.0e-07`.

## Results

| Case | Max matrix difference | Max trace distance | Result |
|---|---:|---:|---|
| resonant_gaussian | 3.658e-08 | 3.669e-08 | PASS |
| nonzero_phase | 1.556e-08 | 1.556e-08 | PASS |
| positive_detuning | 6.614e-08 | 7.626e-08 | PASS |
| negative_detuning | 6.614e-08 | 7.626e-08 | PASS |
| dissipative_gaussian | 2.821e-09 | 3.089e-09 | PASS |
| pulse_then_idle | 5.400e-08 | 5.400e-08 | PASS |

## Interpretation

The six shared mathematical problems agree within the fixed tolerance, including both detuning signs and pulse-to-idle continuity. This independently checks the time-dependent numerical evolution path.

The comparison does not validate the mapping from temperature or other UI parameters to Lindblad rates, and it is not hardware calibration evidence. Those are separate model-validation questions.
