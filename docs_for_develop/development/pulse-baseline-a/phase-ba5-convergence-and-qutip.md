# BA-5: Convergence and QuTiP Comparison

**Status:** Complete

## 1. Goal

Establish a defensible internal-step policy and compare Yuragi-Strider with QuTiP
for identical two-level time-dependent open-system problems.

## 2. Prerequisites

- BA-4 open-system pulse and idle cases pass.
- Validation-only QuTiP installation is available.

## 3. In Scope

- PULSE-CONV-2LEVEL
- Runtime and accuracy sweeps
- Raw physicality versus step size
- Empirical default-step recommendations
- Time-dependent QuTiP adapter
- Independent solver comparison

## 4. Out of Scope

- Qutrit QuTiP dimensions
- Hardware calibration validation
- Independent validation of physical-input-to-rate mapping
- Adaptive production solver selection
- Rust performance comparison

## 5. Convergence Cases

Run at least:

1. Commuting Gaussian Hamiltonian
2. Detuned rectangular pulse
3. Gaussian pulse with dissipation
4. Pulse followed by idle relaxation

Track the dimensionless controls:

```text
h * max(G_H)
h / sigma
h * G_D
```

where:

$$
G_H(t)
=
\lambda_{\max}(H(t))
-
\lambda_{\min}(H(t)),
$$

and $G_D$ is the documented dissipative scale used by the step policy.

The dissipative scale must account for the combined active rates rather than
only the largest individual rate.

## 6. Convergence Outputs

- Error versus step size
- Observed order
- Trace-distance convergence
- Raw trace error
- Raw Hermiticity error
- Raw minimum eigenvalue
- Cleanup correction norm
- Runtime
- Recommended $\varepsilon_H$, $\varepsilon_D$, and $N_\sigma$

Do not set UI defaults before this study is complete.

## 7. QuTiP Comparison Contract

Pass the same:

$$
\rho(0),
\quad
H(t),
\quad
L_k,
\quad
t_j
$$

to Yuragi-Strider and QuTiP.

Required cases:

- Resonant Gaussian pulse
- Nonzero-phase pulse
- Positive detuning
- Negative detuning
- Dissipative pulse
- Pulse followed by idle

This comparison validates numerical evolution for a shared mathematical
problem. It does not independently validate the mapping from UI physical
inputs to rates or claim agreement with hardware.

## 8. Tolerance Policy

- Fix tolerances before examining final pass/fail status where practical.
- Report absolute and relative errors.
- Preserve failed artifacts for diagnosis.
- Any tolerance change must record the old value, new value, reason, and
  affected cases.
- Do not use density-matrix cleanup to define solver agreement.

## 9. Artifacts

Create:

```text
validation_results/pulse_convergence_2level.json
validation_results/pulse_convergence_2level.csv
validation_results/pulse_convergence_2level.png
validation_results/pulse_qutip_2level.json
validation_results/pulse_qutip_2level.csv
validation_results/pulse_qutip_2level_trajectory.png
docs/validation/pulse-convergence-2level.md
docs/validation/pulse-qutip-2level-comparison.md
```

## 10. Completion Criteria

- The convergence trend and observed order are documented.
- The default internal-step policy is derived from evidence.
- Yuragi-Strider and QuTiP agree within fixed tolerances for all required cases.
- Raw physicality remains acceptable at the recommended step policy.
- The report clearly separates solver validation from physical-model
  calibration.

## 11. Implementation

BA-5 adds:

```text
validation_pulse/pulse_step_policy.py
validation_pulse/qutip_adapter.py
tests/test_pulse_ba5_convergence_qutip.py
scripts/validate_pulse_convergence_2level.py
scripts/validate_pulse_qutip_2level.py
```

The QuTiP adapter evaluates the exact Yuragi-Strider Hamiltonian provider inside
`qutip.mesolve`. It does not rebuild an approximately equivalent waveform.
The same collapse-operator matrices and requested output times are used by
both solvers.

## 12. Validated Step Policy

The Baseline A reference recommendation is:

```text
h * G_H <= 0.05
h * G_D <= 0.05
h / sigma <= 1 / 20
```

Here:

```text
G_D = gamma_down + gamma_up + gamma_phi
```

The internal step is the most restrictive applicable limit. This is a
two-level Baseline A reference policy, not an adaptive production-solver
guarantee.

The four required recommended-step errors were:

| Case | Recommended step [us] | Maximum element error | Observed order |
|---|---:|---:|---:|
| Commuting Gaussian | 0.00797834 | 3.654e-08 | 3.946-4.005 |
| Detuned rectangular | 0.0127324 | 6.834e-08 | 3.991-4.040 |
| Dissipative Gaussian | 0.0100000 | 2.361e-09 | 4.016-4.045 |
| Pulse followed by idle | 0.00318310 | 6.365e-08 | 3.853-4.017 |

All remain below the fixed standard tolerance of `2e-7`.

## 13. Extreme-Condition Audit

The convergence script also sweeps:

- a large resonant drive,
- direct relaxation at `gamma_down = 10 / us`,
- combined large drive, detuning, upward/downward transitions, and
  dephasing.

All tested points inside the recommended dimensionless bounds pass the fixed
accuracy and raw-physicality checks. Deliberately coarse points outside the
recommended domain produce negative raw eigenvalues. This expected failure is
preserved in the artifacts and demonstrates that finite-step classical RK4 is
not intrinsically CPTP. Density-matrix cleanup is not used to classify an
unsafe step as valid.

## 14. QuTiP Results

The fixed comparison tolerance was `5e-7`. Maximum matrix differences were:

| Case | Maximum matrix difference |
|---|---:|
| Resonant Gaussian | 3.658e-08 |
| Nonzero phase | 1.556e-08 |
| Positive detuning | 6.614e-08 |
| Negative detuning | 6.614e-08 |
| Dissipative Gaussian | 2.821e-09 |
| Pulse followed by idle | 5.400e-08 |

All six cases pass. This validates the numerical evolution for the shared
mathematical problem. It does not independently validate the mapping from
physical UI inputs to rates or establish agreement with calibrated hardware.

## 15. Generated Reports

```text
validation_results/pulse_convergence_2level.json
validation_results/pulse_convergence_2level.csv
validation_results/pulse_convergence_2level.png
validation_results/pulse_qutip_2level.json
validation_results/pulse_qutip_2level.csv
validation_results/pulse_qutip_2level_trajectory.png
docs/validation/pulse-convergence-2level.md
docs/validation/pulse-qutip-2level-comparison.md
```
