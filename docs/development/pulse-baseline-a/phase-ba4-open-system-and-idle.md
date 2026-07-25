# BA-4: Open-System Pulse and Post-Pulse Idle

## Status

Complete on 2026-07-23.

## 1. Goal

Combine the time-dependent two-level drive with the existing Lindblad
environment and verify both driven evolution and relaxation after the pulse.

## 2. Prerequisites

- BA-3 closed-system phase and detuning validation passes.
- Existing rate and collapse-operator conventions remain validated by V2-V5.

## 3. In Scope

- Dissipation during a pulse
- Idle evolution after a pulse
- `physical` environment input mode
- `direct_rates` validation mode
- Fidelity to the closed pulse trajectory
- Fidelity to a requested target state
- Raw physicality and cleanup audit

## 4. Out of Scope

- Qutrit transition-specific rates
- Driven steady-state claims
- Non-Markovian noise
- Frequency-dependent noise spectra
- Strict finite-step CPTP claims

## 5. Evolution Model

Use:

$$
\frac{d\rho}{dt}
=
-i[H_{\mathrm{rot}}(t),\rho]
+
\mathcal D[L_\downarrow]\rho
+
\mathcal D[L_\uparrow]\rho
+
\mathcal D[L_\phi]\rho.
$$

Retain the established two-level conventions:

$$
L_\downarrow=\sqrt{\gamma_\downarrow}\sigma_-,
\qquad
L_\uparrow=\sqrt{\gamma_\uparrow}\sigma_+,
\qquad
L_\phi=\sqrt{\frac{\gamma_\phi}{2}}\sigma_z.
$$

## 6. Segment Semantics

Treat pulse and idle as separate continuous segments:

```text
pulse segment
  H(t) + Lindblad dissipation
        |
idle segment
  H = 0 + Lindblad dissipation
```

Pulse duration is the active-drive interval. Total observation duration may
extend beyond it.

## 7. Fidelity Definitions

Report separate metrics:

```text
fidelity_to_closed_pulse_trajectory
final_state_fidelity_to_target
```

The first isolates environmental degradation relative to the corresponding
closed driven trajectory. The second measures success against the requested
target. Do not merge the two meanings into one unlabeled fidelity.

## 8. Required Validation Cases

- Resonant square pulse with relaxation
- Resonant Gaussian pulse with dephasing
- Finite-temperature excitation during pulse and idle
- Pulse followed by a long idle interval
- Matching `physical` and `direct_rates` cases using the same derived rates
- Zero-rate limit matching BA-2 and BA-3 closed-system results

Do not compare driven populations directly with the undriven thermal
equilibrium formula. Thermal equilibrium is an idle-system reference, not the
general driven steady state.

## 9. Diagnostics

Record:

- Derived or direct rates
- Collapse-operator count
- Pulse-end and final populations
- Pulse-end and final fidelity
- Trace, Hermiticity, and minimum eigenvalue before cleanup
- Cleanup correction norm
- Pulse and idle internal step counts

## 10. Completion Criteria

- Dissipation acts during both drive and idle.
- The zero-rate limit reproduces closed-system pulse results.
- Physical and direct-rate modes agree when supplied equivalent rates.
- Pulse-end and final-time metrics remain distinguishable.
- Raw physicality stays within documented tolerances.

## 11. Implementation

- `core/pulse_open_system.py`
  - Normalizes `physical` and `direct_rates` pulse environments to
    $\gamma_\downarrow$, $\gamma_\uparrow$, and $\gamma_\phi$.
  - Reuses the existing physical-rate mapper and collapse-operator builder.
  - Runs a finite-drive segment followed by an optional zero-H idle segment.
  - Passes the cleaned pulse-end state directly to the idle segment.
- `tests/test_pulse_open_system.py`
  - Checks square-pulse relaxation and Gaussian-pulse dephasing.
  - Checks finite-temperature excitation in both pulse and idle segments.
  - Checks long-idle relaxation and segment-boundary continuity.
  - Checks equivalent `physical` and `direct_rates` inputs.
  - Checks zero-rate recovery and raw physicality diagnostics.
- `scripts/validate_pulse_open_system_and_idle.py`
  - Generates trajectory, fidelity, physicality, JSON, CSV, and Markdown
    artifacts for the required BA-4 cases.

No Lindblad equation or collapse-operator convention was changed. BA-4 uses:

$$
L_\downarrow=\sqrt{\gamma_\downarrow}\sigma_-,
\qquad
L_\uparrow=\sqrt{\gamma_\uparrow}\sigma_+,
\qquad
L_\phi=\sqrt{\frac{\gamma_\phi}{2}}\sigma_z.
$$

The experimental pulse API remains unavailable until the later integration
phase.

## 12. Validation Result

| Case | Pulse-end closed fidelity | Pulse-end target fidelity | Final target fidelity |
|---|---:|---:|---:|
| Square relaxation | 0.749756 | 0.749756 | 0.068016 |
| Gaussian dephasing | 0.729701 | 0.729701 | 0.531087 |
| Finite-temperature excitation | 0.911654 | 0.911654 | 0.689990 |
| Long-idle relaxation | 0.992536 | 0.992536 | 0.134325 |

The two pulse-end fidelity columns coincide for these resonant fixtures
because the closed pulse endpoint is the requested target. They are computed
and labeled separately and need not coincide for other control or target
settings.

Environment-effect checks:

- Square-drive degradation: $0.250244$.
- Gaussian-drive degradation: $0.270299$.
- Excitation population increase during the pulse relative to
  $\gamma_\uparrow=0$: $0.088226$.
- Additional excitation population increase during idle: $0.220795$.
- Long-idle target-fidelity drop: $0.858211$.

Regression and input-mode checks:

- Zero-rate maximum density-matrix element error:
  $5.64\times10^{-9}$.
- Equivalent physical/direct-rate pulse-end error:
  zero to recorded double precision.
- Equivalent physical/direct-rate final error:
  zero to recorded double precision.

Raw physicality audit:

- Maximum raw trace error: $2.22\times10^{-16}$.
- Maximum raw Hermiticity error: zero to recorded double precision.
- Minimum raw eigenvalue: $2.47\times10^{-14}$.
- Maximum cleanup correction norm: $2.78\times10^{-16}$.

## 13. Generated Artifacts

- `validation_results/pulse_ba4_open_system_idle.json`
- `validation_results/pulse_ba4_open_system_idle.csv`
- `validation_results/pulse_open_system_drive_idle_trajectories.png`
- `validation_results/pulse_open_system_segment_fidelity.png`
- `validation_results/pulse_open_system_raw_physicality.png`
- `docs/validation/pulse-ba4-open-system-and-idle.md`

## 14. Interpretation Boundary

BA-4 verifies the tested Markovian two-level Lindblad dynamics during a drive
and subsequent idle. It does not establish strict finite-step CPTP behavior,
driven thermal steady-state formulas, non-Markovian dynamics, qutrit leakage,
DRAG, hardware calibration, or Rust time-dependent execution.
