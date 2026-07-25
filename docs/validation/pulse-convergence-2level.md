# Pulse BA-5: Two-Level Convergence

**Result:** PASS

## Step Policy

The validated Baseline A reference recommendation is:

- `h G_H <= 0.05`
- `h G_D <= 0.05`
- at least `20` internal steps per Gaussian sigma

`G_D` is the sum of all active downward, upward, and pure-dephasing rates. The most restrictive bound selects the step.

## Standard Cases

| Case | Recommended h [us] | Error | Observed order | Result |
|---|---:|---:|---:|---|
| commuting_gaussian | 0.00797834 | 3.654e-08 | 3.946-4.005 | PASS |
| detuned_rectangular | 0.0127324 | 6.834e-08 | 3.991-4.040 | PASS |
| dissipative_gaussian | 0.01 | 2.361e-09 | 4.016-4.045 | PASS |
| pulse_then_idle | 0.0031831 | 6.365e-08 | 3.853-4.017 | PASS |

## Extreme-Condition Audit

Extreme drive, relaxation, and combined drive/detuning/dissipation were swept beyond the recommended domain. Safe-region points pass. At least one deliberately coarse point produces a negative raw eigenvalue, documenting that fixed-step RK4 is not intrinsically CPTP and that cleanup must not be used to justify an unsafe step.

## Interpretation

This study supports the internal numerical step policy for the two-level rotating-frame RWA model. It does not calibrate pulse parameters against hardware and does not cover qutrit leakage, DRAG, or multi-qubit pulse control.
