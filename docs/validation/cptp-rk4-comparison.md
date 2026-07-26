# C8 RK4 and Explicit CPTP Comparison

## Result

**PASS**

## Method

- RK4 uses stage-time Hamiltonian evaluation and existing post-step cleanup.
- CPTP uses midpoint-frozen GKSL exponentials and no state cleanup.
- Both methods use the same maximum step for each row.
- CPTP timing includes map construction, Choi audits, and state application.
- Runtime is observational and is not a pass/fail criterion.

## Results

| Case | Backend | Step [us] | Trace distance | RK4 raw min eig | Cleanup norm | CPTP min eig | RK4 [ms] | CPTP [ms] | RK4/CPTP |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `constant_qubit_open_system` | `python` | 0.2 | 3.970104e-07 | 1.400491e-02 | 0.000000e+00 | 5.040175e-02 | 1.675 | 2.239 | 0.748 |
| `constant_qubit_open_system` | `python` | 0.1 | 2.451682e-08 | 7.125665e-03 | 0.000000e+00 | 5.040175e-02 | 3.205 | 3.839 | 0.835 |
| `constant_qubit_open_system` | `python` | 0.05 | 1.523087e-09 | 3.593854e-03 | 2.220582e-16 | 5.040175e-02 | 6.649 | 7.980 | 0.833 |
| `constant_qubit_open_system` | `rust` | 0.2 | 3.970104e-07 | 1.400491e-02 | 0.000000e+00 | 5.040175e-02 | 0.592 | 1.662 | 0.356 |
| `constant_qubit_open_system` | `rust` | 0.1 | 2.451682e-08 | 7.125665e-03 | 0.000000e+00 | 5.040175e-02 | 1.306 | 3.316 | 0.394 |
| `constant_qubit_open_system` | `rust` | 0.05 | 1.523087e-09 | 3.593854e-03 | 2.220582e-16 | 5.040175e-02 | 2.358 | 5.791 | 0.407 |
| `two_level_gaussian_open_system` | `python` | 0.04 | 2.696749e-04 | -3.656665e-07 | 0.000000e+00 | 1.141915e-03 | 5.400 | 5.827 | 0.927 |
| `two_level_gaussian_open_system` | `python` | 0.02 | 4.886788e-05 | -5.270642e-10 | 2.379545e-16 | 1.143907e-03 | 9.612 | 10.758 | 0.893 |
| `two_level_gaussian_open_system` | `python` | 0.01 | 1.222232e-05 | 5.703196e-12 | 2.403703e-16 | 1.144429e-03 | 20.089 | 20.739 | 0.969 |
| `two_level_gaussian_open_system` | `rust` | 0.04 | 2.696749e-04 | -3.656665e-07 | 0.000000e+00 | 1.141915e-03 | 2.073 | 4.184 | 0.495 |
| `two_level_gaussian_open_system` | `rust` | 0.02 | 4.886788e-05 | -5.270642e-10 | 2.379545e-16 | 1.143907e-03 | 4.050 | 8.087 | 0.501 |
| `two_level_gaussian_open_system` | `rust` | 0.01 | 1.222232e-05 | 5.703196e-12 | 2.403703e-16 | 1.144429e-03 | 7.653 | 15.610 | 0.490 |
| `constant_qutrit_open_system` | `python` | 0.0002 | 8.025548e-08 | 9.997220e-02 | 1.331112e-16 | 9.997220e-02 | 77.275 | 50.291 | 1.537 |
| `constant_qutrit_open_system` | `python` | 0.0001 | 5.018991e-09 | 9.997220e-02 | 1.331114e-16 | 9.997220e-02 | 157.884 | 322.234 | 0.490 |
| `constant_qutrit_open_system` | `python` | 5e-05 | 3.137400e-10 | 9.997220e-02 | 1.331114e-16 | 9.997220e-02 | 549.626 | 617.267 | 0.890 |
| `constant_qutrit_open_system` | `rust` | 0.0002 | 8.025548e-08 | 9.997220e-02 | 1.331112e-16 | 9.997220e-02 | 30.077 | 157.770 | 0.191 |
| `constant_qutrit_open_system` | `rust` | 0.0001 | 5.018987e-09 | 9.997220e-02 | 1.331114e-16 | 9.997220e-02 | 62.938 | 304.830 | 0.206 |
| `constant_qutrit_open_system` | `rust` | 5e-05 | 3.137359e-10 | 9.997220e-02 | 1.331114e-16 | 9.997220e-02 | 122.550 | 639.297 | 0.192 |

## Non-acceptance Stress Observation

A qutrit DRAG case with `-215 MHz` anharmonicity was intentionally run at a coarse `0.006 us` step, far outside the frozen qutrit step policy.

| Backend | Trace distance | RK4 raw minimum eigenvalue | CPTP minimum eigenvalue |
|---|---:|---:|---:|
| `python` | 9.679935e+19 | -3.021081e+22 | 9.911845e-02 |
| `rust` | 2.990675e+20 | -1.505119e+23 | 9.911845e-02 |

This stress case is excluded from acceptance. It demonstrates that post-step cleanup does not make an unstable coarse RK4 trajectory trustworthy, while each explicit CPTP interval remains physical.

## Interpretation

- Trace distance decreases under matched-grid refinement for every tested case.
- The explicit CPTP path preserves trace, Hermiticity, positivity, and the Choi CPTP conditions without cleanup.
- RK4 final displayed states are physical after the existing cleanup; raw diagnostics and cleanup corrections remain reported separately.
- A speed ratio above 1 means the measured CPTP path was faster; below 1 means RK4 was faster.
- These timings are local observations, not universal performance guarantees.

## Scope

This validates the tested small-system trajectories. It does not prove that arbitrary finite RK4 steps are CPTP, nor does it establish calibrated-hardware accuracy.
