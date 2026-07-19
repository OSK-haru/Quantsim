# VALIDATION-5: Finite-Temperature Thermal Equilibrium

## Population Model

The solver is tested against `dP1/dt=-(gamma_down+gamma_up)P1+gamma_up`, with `P1_eq=gamma_up/(gamma_down+gamma_up)`.
Integrating this linear equation gives `P1(t)=P1_eq+(P1(0)-P1_eq) exp[-(gamma_down+gamma_up)t]`; therefore `T1_eff=1/(gamma_down+gamma_up)`.

Finite temperature does not drive the qubit to |0>. It drives the population to the balance point set by gamma_up and gamma_down.

## Gibbs Relation

For the bosonic bath convention, detailed balance gives `gamma_up/gamma_down=exp(-h f/(k_B T))`; this produces the two-level Gibbs population. Pure dephasing, if present, does not change this population equilibrium.

## Test Conditions

Direct-rate cases use the specified upward/downward rates with zero Hamiltonian, zero pure dephasing, and initial |0>, |1>, and I/2 states. Physical-input cases use 50, 100, and 200 mK at 5 GHz, quality 1.0, T1 maximum 100 us, and zero flux noise; their actual derived pure-dephasing rate is recorded in JSON.

## Results

- Overall pass: `True`

| Layer | Case | max P1 error | max fitted-rate relative error | Pass |
|---|---|---:|---:|---|
| direct_rate | V5-1 | 6.146805e-12 | 1.949879e-11 | True |
| direct_rate | V5-2 | 9.676537e-11 | 3.945549e-10 | True |
| direct_rate | V5-3 | 1.018781e-08 | 5.430095e-08 | True |
| physical_input | P5-1 | 1.947442e-12 | 5.236376e-12 | True |
| physical_input | P5-2 | 3.545775e-12 | 1.051893e-11 | True |
| physical_input | P5-3 | 1.745104e-11 | 6.172726e-11 | True |

## Initial-State Independence and Physicality

The largest final-state population spread across |0>, |1>, and I/2 is `6.144216e-06`. Every snapshot passed trace, Hermiticity, positivity, and finite-value checks.

## Time-Step Refinement

The report records 0.5, 0.25, and 0.125 us local refinement comparisons for both a direct-rate and physical-input case.

## Scope

This validates one-qubit thermal transition dynamics, equilibrium, detailed balance, and the tested physical-input conversion path. It does not establish hardware calibration, pulse-level behavior, non-Markovian physics, or external-solver agreement.

## Files and Commands

- `tests/test_validation_finite_temperature_equilibrium.py`
- `scripts/validate_finite_temperature_equilibrium.py`
- `validation_results/validation5_finite_temperature_equilibrium.*`

## Scope Audit

Production equations, API behavior, frontend behavior, and solver defaults were not changed.
