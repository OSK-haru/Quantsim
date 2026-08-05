# B-2: Qutrit Open-System Dynamics

**Status:** Complete (2026-07-23)

## 1. Goal

Add transition-specific qutrit relaxation, thermal excitation, and the
documented number-noise dephasing model, then validate analytic limits before
using these dynamics in DRAG or the UI.

## 2. Prerequisites

- B-1 closed qutrit evolution passes.
- Existing two-level finite-temperature conventions remain frozen.
- Qutrit transition frequencies are validated and positive.

## 3. In Scope

- $1\to0$ and $2\to1$ downward transitions
- $0\to1$ and $1\to2$ thermal upward transitions
- Transition-specific thermal occupations
- Number-operator pure dephasing
- Pulse-time and post-pulse-idle dissipation
- `physical` and explicit qutrit-rate input normalization
- Analytic population and coherence checks

## 4. Fixed Collapse Operators

Use:

$$
L_{10}^{\downarrow}
=\sqrt{\gamma_{10}^{\downarrow}}|0\rangle\langle1|,
\qquad
L_{21}^{\downarrow}
=\sqrt{\gamma_{21}^{\downarrow}}|1\rangle\langle2|,
$$

$$
L_{01}^{\uparrow}
=\sqrt{\gamma_{01}^{\uparrow}}|1\rangle\langle0|,
\qquad
L_{12}^{\uparrow}
=\sqrt{\gamma_{12}^{\uparrow}}|2\rangle\langle1|.
$$

The initial physical profile uses:

$$
\gamma_{21,0}=2\gamma_{10,0},
$$

as an educational harmonic-matrix-element approximation. It is not a
calibrated device constant.

For transition frequencies $f_{01}$ and $f_{12}$:

$$
n_{jk}=
\frac{1}{\exp(hf_{jk}/k_BT)-1}.
$$

Use:

$$
\gamma_{10}^{\downarrow}=\gamma_{10,0}(n_{01}+1),
\quad
\gamma_{01}^{\uparrow}=\gamma_{10,0}n_{01},
$$

$$
\gamma_{21}^{\downarrow}=\gamma_{21,0}(n_{12}+1),
\quad
\gamma_{12}^{\uparrow}=\gamma_{21,0}n_{12}.
$$

## 5. Dephasing Convention

Use one number-noise operator:

$$
L_\phi^{(3)}
=\sqrt{2\gamma_{\phi,\mathrm{adj}}}\,n.
$$

Pure dephasing alone must give:

$$
\rho_{01}(t)=\rho_{01}(0)e^{-\gamma_{\phi,\mathrm{adj}}t},
$$

$$
\rho_{12}(t)=\rho_{12}(0)e^{-\gamma_{\phi,\mathrm{adj}}t},
$$

$$
\rho_{02}(t)=\rho_{02}(0)e^{-4\gamma_{\phi,\mathrm{adj}}t}.
$$

The inability to set all three coherence rates independently must be visible
in the API metadata and later UI.

## 6. Validation Cases

- Zero-temperature upward rates vanish.
- $|2\rangle$ decays through the expected cascade.
- Each transition satisfies detailed balance.
- Long-time no-drive populations approach the three-level Gibbs distribution.
- $\rho_{01}$, $\rho_{12}$, and $\rho_{02}$ follow their analytic pure
  dephasing rates.
- Population-induced coherence decay agrees with the documented outflow-rate
  formula.
- Dissipation acts continuously during both pulse and idle.
- Physical-mode rates and equivalent direct rates produce the same result.

## 7. Likely Files

```text
core/pulse_qutrit_open_system.py
api/pulse_models.py
validation_pulse/qutrit_dissipation.py
scripts/validate_pulse_qutrit_dissipation.py
tests/test_pulse_b2_qutrit_open_system.py
docs/validation/pulse-b-qutrit-dissipation.md
```

## 8. Artifacts

```text
validation_results/pulse_b_qutrit_dissipation.json
validation_results/pulse_b_qutrit_dissipation.csv
validation_results/pulse_b_qutrit_thermal_equilibrium.png
validation_results/pulse_b_qutrit_coherence_decay.png
```

## 9. Completion Criteria

- All analytic limits pass fixed tolerances.
- Detailed balance is correct for both transition frequencies.
- The stationary population agrees with the model's Gibbs prediction.
- Raw physicality remains within the declared tolerance.
- Direct-rate and physical modes are not mixed silently.
- Baseline A finite-temperature behavior is unchanged.

## 10. Stop Conditions

Stop before B-3 if the qutrit equilibrium depends on an inconsistent
frequency/unit conversion, if dephasing factors differ from the documented
operator, or if cleanup masks persistent nonphysical raw states.

## 11. Implementation Result

B-2 added a qutrit-only open-system path:

```text
core/pulse_qutrit_open_system.py
validation_pulse/qutrit_dissipation.py
scripts/validate_pulse_qutrit_dissipation.py
tests/test_pulse_b2_qutrit_open_system.py
tests/test_validation_pulse_qutrit_dissipation.py
```

The implementation includes:

- physical and explicit direct-rate normalization,
- separate thermal occupations for the 0-1 and 1-2 transitions,
- the educational `gamma_21,0 = 2 gamma_10,0` profile rule,
- four transition-specific collapse operators,
- `sqrt(2 gamma_phi_adjacent) n` number-operator dephasing,
- the same dissipator during the finite pulse and free-idle segments,
- Gibbs-population and coherence-decay helpers,
- raw physicality and cleanup diagnostics.

The frozen two-level Baseline A path was not modified.

## 12. Validation Result

The reproducible command is:

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_dissipation.py
```

All seven fixed validation cases passed:

1. zero-temperature upward-rate and detailed-balance checks,
2. analytic zero-temperature `2 -> 1 -> 0` cascade,
3. pure-dephasing `1:1:4` coherence-rate check,
4. population-outflow coherence decay,
5. three-level Gibbs equilibrium,
6. continuous pulse and idle dissipation,
7. physical/direct-rate equivalence.

Key measured values:

| Measurement | Result |
|---|---:|
| 0-1 detailed-balance error | `5.551115123125783e-17` |
| 1-2 detailed-balance error | `0.0` |
| Cascade maximum population error | `3.2085445411667024e-14` |
| Pure-dephasing maximum coherence error | `1.2170819907453279e-14` |
| Population-outflow coherence error | `3.885780586188048e-16` |
| Gibbs maximum population error | `4.5219272770680163e-10` |
| Physical/direct final-state error | `0.0` |

Artifacts:

```text
validation_results/pulse_b_qutrit_dissipation.json
validation_results/pulse_b_qutrit_dissipation.csv
validation_results/pulse_b_qutrit_thermal_equilibrium.png
validation_results/pulse_b_qutrit_coherence_decay.png
docs/validation/pulse-b-qutrit-dissipation.md
```

## 13. Remaining Boundary

B-2 does not establish the production qutrit safe-step/work-budget policy,
strict finite-step CPTP behavior, DRAG, QuTiP qutrit agreement, public qutrit
HTTP execution, Pulse Lab UI behavior, or hardware-calibrated rates. These
remain assigned to B-3 through B-6.
