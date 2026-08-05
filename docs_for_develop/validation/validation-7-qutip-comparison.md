# VALIDATION-7: QuTiP Comparison

## Purpose

Compare the current QuantaScope Lindblad solver with QuTiP `mesolve` using exactly the same density matrices, Hamiltonians, collapse operators, segment durations, and requested snapshot times.

## Environment and Versions

- python: `3.14.4 (tags/v3.14.4:23116f9, Apr  7 2026, 14:10:54) [MSC v.1944 64 bit (AMD64)]`
- qutip: `5.2.3`
- numpy: `2.4.4`
- scipy: `1.17.1`
- os: `Windows-11-10.0.26200-SP0`
- quanta_backend: `production dense NumPy RK4 through _evolve_stable_with_substeps`

## Basis and Qubit-Order Audit

- `q0` is the most-significant bit, so two-qubit order is `|00>, |01>, |10>, |11>`.
- The adapter converts QuantaScope matrices directly to `Qobj`; it does not rebuild the model with QuTiP spin operators.

## Solver Settings

- QuantaScope fixed internal RK4 cap: `0.03125 us`.
- QuTiP options: `{'store_states': True, 'normalize_output': False, 'progress_bar': False, 'method': 'dop853', 'atol': 1e-12, 'rtol': 1e-12, 'nsteps': 100000, 'max_step_us': 0.015625}`.

## Results

| Case | Max matrix difference | Max trace distance | Pass |
|---|---:|---:|---|
| V7-1 | 2.934875e-13 | 2.934597e-13 | True |
| V7-2 | 1.469380e-13 | 1.469380e-13 | True |
| V7-3 | 1.499911e-13 | 1.494638e-13 | True |
| V7-0 | 2.099189e-10 | 2.099244e-10 | True |
| V7-4 | 1.696213e-10 | 1.725252e-10 | True |
| V7-5 | 1.649723e-10 | 1.754019e-10 | True |
| V7-6 | 2.220446e-15 | 1.417981e-15 | True |

## Interpretation

A pass establishes agreement for the tested small-system Lindblad trajectories. It does not establish calibrated-hardware accuracy or prove CPTP behavior of arbitrary finite RK4 steps.

## Files

- `C:\Users\oshad\Quantum-sim\validation_results\validation7_qutip_comparison.json`
- `C:\Users\oshad\Quantum-sim\validation_results\validation7_qutip_comparison.csv`
- `C:\Users\oshad\Quantum-sim\validation_results\validation7_qutip_comparison.png`
- `C:\Users\oshad\Quantum-sim\validation_results\validation7_qutip_comparison_error.png`
