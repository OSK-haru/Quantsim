# VALIDATION-6: Time-Step Convergence

## Controlled Quantity

The validation controls the maximum internal RK4 step independently of output snapshot density. Candidate steps are 1.0 to 0.0625 us, with 0.03125 us as the distinct gate-case reference.

## Production Integration Policy

`core/simulator.py::_integration_substeps` derives rate-based substeps from output intervals. `core/simulator.py::_evolve_stable_with_substeps` performs fixed-step RK4 through the Rust/NumPy/tuple backend choice. Gate columns are split into exact finite-duration event segments by `_gate_aware_segments`; requested times split output segments. Dense paths clean density matrices after each RK4 substep.

## Results

- Overall pass: `True`

| Case | Fine error | Pass |
|---|---:|---|
| V6-1 | 2.929879e-13 | True |
| V6-2 | 1.466327e-13 | True |
| V6-3 | 1.494360e-13 | True |
| V6-4 | 2.549706e-09 | True |
| V6-5 | 1.351919e-09 | True |

## Snapshot and Backend Independence

Snapshot-grid common-time maximum element difference: `0.000000e+00`.
Backend one/two-qubit maximum element differences: `1.110223e-16` / `5.551115e-17`.

## Interpretation and Limitations

The tested trajectories converge under internal-step refinement and preserve trace, Hermiticity, and positivity within the stated numerical tolerances. This supports numerical consistency of the current Lindblad integration path for the tested regimes, but does not constitute a general proof that every finite RK4 step is a CPTP map.

Production physics, rate conventions, API, frontend behavior, and default solver policy were unchanged.
