# BA-3: Phase, Detuning, and Gate Equivalence

## Status

Complete on 2026-07-23.

## 1. Goal

Verify the pulse Hamiltonian's phase and detuning conventions using coherence,
Bloch trajectories, analytic detuned dynamics, and independent target
unitaries.

## 2. Prerequisites

- BA-2 square and Gaussian pulse trajectories pass.

## 3. In Scope

- Pulse phase
- Positive and negative detuning
- Rotating-frame Bloch trajectories
- Independent unitary references
- Gate-level comparison for operations already supported

## 4. Out of Scope

- Adding RX or RY gates to the circuit editor
- Dissipation
- Qutrit phase and detuning
- Laboratory-frame trajectories

## 5. Hamiltonian

Use:

$$
H_{\mathrm{rot}}(t)
=
\frac{\Delta}{2}\sigma_z
+
\frac{\Omega(t)}{2}
\left(
\cos\phi\,\sigma_x
+
\sin\phi\,\sigma_y
\right).
$$

Required phase cases:

| Phase | Rotation axis |
|---|---|
| $0$ | $+x$ |
| $\pi/2$ | $+y$ |
| $\pi$ | $-x$ |
| $-\pi/2$ | $-y$ |

## 6. Phase Validation

Population alone is insufficient because opposite rotation axes can produce
the same population. Compare:

- Real and imaginary parts of $\rho_{01}$
- $\langle\sigma_x\rangle$
- $\langle\sigma_y\rangle$
- $\langle\sigma_z\rangle$
- Full rotating-frame Bloch trajectory
- Final density matrix against an independent unitary

## 7. Detuning Validation

For a rectangular pulse, use:

$$
\Omega_{\mathrm{eff}}
=
\sqrt{\Omega^2+\Delta^2}.
$$

Test equal-magnitude positive and negative detuning. Population curves may
match, but coherence phase and Bloch trajectories must show the expected sign
difference.

## 8. Gate and Target-Unitary Comparison

Compare:

```text
closed two-level pulse
closed gate-level effective Hamiltonian
independent target unitary
```

Required cases:

- $X_\pi$ against the existing X gate and an independent X unitary
- $X_{\pi/2}$ against an independent unitary
- $Y_\pi$ against an independent unitary
- $Y_{\pi/2}$ against an independent unitary

Do not describe RX or RY as existing circuit gates unless they are separately
implemented.

## 9. Tests and Artifacts

- Phase-axis unit tests for all four required phases
- Positive/negative detuning analytic comparison
- Coherence-phase sign checks
- Bloch-trajectory plots
- Pulse/gate/target density-matrix comparison table

## 10. Completion Criteria

- Phase and detuning signs are distinguishable through coherence and trajectory
  results.
- Detuned square pulses agree with their analytic solution.
- $X_\pi$ agrees through all three comparison paths.
- Fractional X and Y rotations agree with independent target unitaries.
- No new logical gate support is implied by validation-only unitaries.

## 11. Implementation

- `validation_pulse/pulse_phase_detuning.py`
  - Defines a closed-form constant-drive unitary directly from
    $\Omega$, $\phi$, $\Delta$, and time.
  - Defines independent $R_x$ and $R_y$ target unitaries.
  - Applies reference unitaries without using the core gate helpers.
- `tests/test_validation_pulse_phase_detuning.py`
  - Checks all four required phase axes over complete trajectories.
  - Checks positive and negative detuning through population, coherence, and
    Bloch-vector signs.
  - Compares $X_\pi$ across the pulse, existing X gate, gate-effective
    Hamiltonian, and independent target.
  - Compares $X_{\pi/2}$, $Y_\pi$, and $Y_{\pi/2}$ with validation-only
    target unitaries.
- `scripts/validate_pulse_phase_detuning_gate_equivalence.py`
  - Generates machine-readable results, Bloch plots, an equivalence-error
    plot, and a reviewable Markdown report.

The closed-form reference does not call
`TwoLevelPulseHamiltonian.evaluate()`. This keeps the numerical
implementation and analytic reference independent enough to expose phase or
detuning sign mistakes.

No new `RX` or `RY` circuit gate was added. The existing core gate-level and
API simulation paths are unchanged.

## 12. Validation Result

All required cases passed:

| Check | Maximum error |
|---|---:|
| Four phase-axis trajectories | $2.49\times10^{-11}$ |
| Positive/negative detuning trajectories | $1.68\times10^{-9}$ |
| Pulse/gate/target equivalence | $7.97\times10^{-10}$ |

For equal-magnitude positive and negative detuning:

- Population-trajectory difference: zero to recorded double precision.
- Final positive-detuning $\operatorname{Re}\rho_{01}$: $+0.409706$.
- Final negative-detuning $\operatorname{Re}\rho_{01}$: $-0.409706$.
- Real-coherence antisymmetry error: zero to recorded double precision.
- Imaginary-coherence symmetry error: zero to recorded double precision.

The $X_\pi$ comparison uses four probe states and all four paths:

1. Closed two-level pulse
2. Existing X logical gate
3. Existing gate-effective Hamiltonian
4. Independent $R_x(\pi)$ target unitary

The fractional X and Y cases compare only against independent validation
targets because the circuit editor does not currently provide `RX` or `RY`
logical gates.

## 13. Generated Artifacts

- `validation_results/pulse_ba3_phase_detuning_gate_equivalence.json`
- `validation_results/pulse_ba3_phase_detuning_gate_equivalence.csv`
- `validation_results/pulse_phase_bloch_trajectories.png`
- `validation_results/pulse_detuning_bloch_trajectories.png`
- `validation_results/pulse_gate_equivalence_error.png`
- `docs/validation/pulse-ba3-phase-detuning-gate-equivalence.md`

## 14. Interpretation Boundary

BA-3 validates closed two-level rotating-frame dynamics for phase, detuning,
and target-unitary equivalence. It does not validate Lindblad dissipation,
laboratory-frame carrier dynamics, qutrit leakage, DRAG, calibrated hardware
behavior, or the Rust backend.
