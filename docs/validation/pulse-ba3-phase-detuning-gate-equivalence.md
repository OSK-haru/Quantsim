# PULSE-BA3: Phase, Detuning, and Gate Equivalence

## Result

- Overall pass: `True`
- Model: `driven_two_level_rwa_experimental_v1`
- Frame / approximation: `rotating` / `RWA`
- Detuning convention: `Delta = omega_d - omega_q`

## Phase Axes

| Case | Axis | Max element error | Final Bloch error | Pass |
|---|---|---:|---:|---|
| phase_0_plus_x | +x | 2.490408e-11 | 4.980794e-11 | True |
| phase_pi_over_2_plus_y | +y | 2.490408e-11 | 4.980794e-11 | True |
| phase_pi_minus_x | -x | 2.490408e-11 | 4.980794e-11 | True |
| phase_minus_pi_over_2_minus_y | -y | 2.490408e-11 | 4.980794e-11 | True |

## Detuning Sign

- Maximum analytic trajectory error: `1.675756e-09`
- Positive final Re(rho01): `4.097056e-01`
- Negative final Re(rho01): `-4.097056e-01`
- Population-pair error: `0.000000e+00`
- Re(rho01) antisymmetry error: `0.000000e+00`
- Im(rho01) symmetry error: `0.000000e+00`
- Pass: `True`

Equal-magnitude positive and negative detuning have matching populations in this fixture, while the real coherence and Bloch-x signs are opposite.

## Gate And Target Equivalence

| Case | Logical support | Maximum error | Pass |
|---|---|---:|---|
| x_pi | existing X gate | 7.968575e-10 | True |
| x_pi_over_2 | validation-only target unitary | 2.490413e-11 | True |
| y_pi | validation-only target unitary | 7.968574e-10 | True |
| y_pi_over_2 | validation-only target unitary | 2.490413e-11 | True |

The X-pi case compares the pulse, existing X gate, gate-effective Hamiltonian, and an independent Rx(pi) target over four probe states. Fractional X and all Y cases use validation-only target unitaries and do not add RX or RY circuit gates.

## Interpretation

The rotating-frame phase and detuning signs are visible in coherence and Bloch trajectories, not inferred from population alone. The tested closed-system pulse operations agree with independent target unitaries within the stated tolerance.

This phase does not validate dissipation, laboratory-frame carrier dynamics, qutrit leakage, DRAG, or calibrated hardware behavior.
