# VALIDATION-3: Excited-State Exponential Decay

## Purpose

This validation checks that a known downward Lindblad collapse operator reproduces the analytic amplitude-damping decay from |1>.

## Convention

- `gamma_down_per_us`: downward transition rate
- At `gamma_up_per_us=0`, `T1=1/gamma_down_per_us`
- At finite temperature, `T1_eff=1/(gamma_down_per_us + gamma_up_per_us)`

## Results

- Overall pass: `True`
- Collapse operator audit: `True`
- Internal-step audit: `True`

| Case | gamma_down [1/us] | max abs error P1 | fitted gamma relative error | Pass |
|---|---:|---:|---:|---|
| V3-1 | 0.010 | 1.923961e-12 | 5.230191e-12 | True |
| V3-2 | 0.050 | 1.222742e-09 | 3.323757e-09 | True |
| V3-3 | 0.100 | 1.997610e-08 | 5.430066e-08 | True |

## Scope

This validates the downward collapse operator, its orientation, and the Lindblad time-evolution path. It does not validate temperature-to-rate conversion, finite-temperature equilibrium, pure dephasing convention, QuTiP agreement, or hardware calibration.

## Artifacts

- `validation_results/validation3_excited_state_decay.json`
- `validation_results/validation3_excited_state_decay.csv`
- `validation_results/validation3_excited_state_decay.png`
- `validation_results/validation3_excited_state_decay_error.png`
