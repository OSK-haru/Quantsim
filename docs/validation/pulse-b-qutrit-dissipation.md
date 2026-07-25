# Pulse B-2 Qutrit Dissipation Validation

## Decision

**Result: PASS**

The fixed B-2 cases validate transition-specific qutrit
relaxation, excitation, number-operator dephasing, and no-drive
thermal equilibrium. They do not establish the B-3 production
step policy or enable qutrit HTTP execution.

## Cases

| Case | Result |
|---|---|
| `zero_temperature_and_detailed_balance` | PASS |
| `zero_temperature_cascade` | PASS |
| `pure_dephasing_one_one_four` | PASS |
| `population_outflow_coherence` | PASS |
| `three_level_gibbs` | PASS |
| `dissipative_pulse_and_idle` | PASS |
| `physical_direct_rate_equivalence` | PASS |

## Key Measurements

| Metric | Value |
|---|---:|
| Detailed-balance error, 0-1 | `5.551115e-17` |
| Detailed-balance error, 1-2 | `0.000000e+00` |
| Cascade maximum population error | `3.208545e-14` |
| Pure-dephasing maximum coherence error | `1.217082e-14` |
| Population-outflow coherence error | `3.885781e-16` |
| Gibbs maximum population error | `4.521927e-10` |
| Pulse state change | `4.599543e-01` |
| Idle state change | `1.795965e-01` |
| Physical/direct final-state error | `0.000000e+00` |

## Interpretation

- Upward rates vanish at zero temperature.
- Both adjacent transitions satisfy their own thermal detailed
  balance relation.
- The `|2>` population follows the expected `2 -> 1 -> 0` cascade.
- `sqrt(2 gamma_phi_adjacent) n` gives coherence-rate ratios
  `rho01 : rho12 : rho02 = 1 : 1 : 4`.
- Long-time no-drive populations approach the three-level Gibbs
  distribution.
- The same collapse operators act during the pulse and idle.

## Numerical Boundary

B-2 uses explicit validation steps selected for these fixtures.
The production qutrit safe-step and work-budget policy remains B-3.
RK4 is audited before cleanup but is not claimed to be intrinsically
CPTP at an arbitrary finite step.

## Artifacts

```text
validation_results/pulse_b_qutrit_dissipation.json
validation_results/pulse_b_qutrit_dissipation.csv
validation_results/pulse_b_qutrit_thermal_equilibrium.png
validation_results/pulse_b_qutrit_coherence_decay.png
```
