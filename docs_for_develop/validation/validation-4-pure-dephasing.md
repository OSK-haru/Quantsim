# VALIDATION-4: Pure Dephasing

## Purpose

This direct-rate validation checks the one-qubit pure-dephasing coefficient used by the production Lindblad solver.

## Adopted Convention

`L_phi = sqrt(gamma_phi_per_us / 2) sigma_z`.

## Analytic Derivation

With `sigma_z^2=I`, the dissipator is `(gamma_phi/2) (sigma_z rho sigma_z - rho)`. Thus populations are constant and `rho01(t)=rho01(0) exp(-gamma_phi t)`. The alternative `sqrt(gamma_phi) sigma_z` coefficient would instead give `exp(-2 gamma_phi t)`.

## Test Conditions

Initial state: `|+><+|`; Hamiltonian: zero; `gamma_down=gamma_up=0`; one `sigma_z` collapse operator.

## Results

- Overall pass: `True`
- Collapse operator audit: `True`
- Time-step refinement: `True`

| Case | gamma_phi [1/us] | max |rho01| error | fitted-rate relative error | Pass |
|---|---:|---:|---:|---|
| V4-1 | 0.010 | 9.620638e-13 | 5.230018e-12 | True |
| V4-2 | 0.050 | 6.113710e-10 | 3.323757e-09 | True |
| V4-3 | 0.100 | 9.988049e-09 | 5.430066e-08 | True |

## Population, Coherence, and Physicality

All samples retain rho00=rho11=0.5 within tolerance; coherence decays without phase rotation. Trace and Hermiticity are preserved, the minimum eigenvalue remains non-negative within numerical tolerance, and purity decreases monotonically toward 1/2.

## Fitted Rate and Alternative-Coefficient Diagnostic

The smallest nonzero-time mismatch to the incorrect doubled-rate curve is `3.346274e-03`. This distinguishes the adopted convention from `sqrt(gamma_phi) sigma_z`.

## Time-Step Refinement

Normal/refined internal steps: `0.5` / `0.25` us; maximum density-element difference: `5.735566e-10`.

## Conclusion

For a one-qubit initial |+> state with zero Hamiltonian and no population transitions, the numerical evolution preserves both populations and reproduces rho_01(t)=rho_01(0) exp(-gamma_phi t). This confirms that the production collapse operator convention L_phi=sqrt(gamma_phi/2) sigma_z makes gamma_phi the direct decay rate of the off-diagonal density-matrix elements.

## Scope and Limitations

This validates the coefficient, sigma_z embedding, pure-dephasing solver path, and tested snapshot timing. It does not validate flux-noise calibration, hardware Tphi accuracy, combined T1/Tphi behavior, QuTiP agreement, or non-Markovian noise.

## Files and Commands

- `tests/test_validation_pure_dephasing.py`
- `scripts/validate_pure_dephasing.py`
- `validation_results/validation4_pure_dephasing.*`
- `python -m unittest tests.test_validation_pure_dephasing`

## Scope Audit

Production physics, API, and frontend code are unchanged by this validation package.
