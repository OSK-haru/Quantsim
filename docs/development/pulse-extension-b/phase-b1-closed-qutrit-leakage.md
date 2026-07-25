# B-1: Closed Qutrit Evolution and Leakage

**Status:** Complete (2026-07-23)

## 1. Goal

Implement and validate closed-system 3x3 qutrit evolution, including
time-resolved populations and leakage, without adding dissipation or DRAG.

## 2. Prerequisites

- B-0 contract tests pass.
- Baseline A numerical and API regressions pass.
- The generic time-dependent RK4 primitive has a dimension-independent test.

## 3. In Scope

- Qutrit Hamiltonian evaluation at all RK4 stages
- 3x3 density-matrix evolution
- Square and Gaussian in-phase pulses
- Free qutrit phase evolution
- $P_0$, $P_1$, $P_2$, and leakage trajectories
- Pulse-end, maximum, and final leakage metrics
- Zero-rate reference behavior

## 4. Out of Scope

- Collapse operators and finite temperature
- DRAG quadrature
- QuTiP acceptance comparison
- Public qutrit API activation
- Pulse Lab UI

## 5. Required Metrics

Report separately:

```text
population_0
population_1
population_2
maximum_leakage_probability
leakage_at_pulse_end
leakage_at_final_time
computational_population = population_0 + population_1
```

The leakage definition is:

$$
P_{\mathrm{leak}}(t)=\rho_{22}(t).
$$

Do not renormalize $P_0$ and $P_1$ when reporting raw populations.

## 6. Numerical Design

Generalize dimension-independent RK4 and physicality helpers only where
needed. Keep two-level Hamiltonian construction and Baseline A service logic
unchanged.

At every checkpoint record:

- trace error,
- Hermiticity error,
- minimum eigenvalue before cleanup,
- cleanup correction norm,
- population sum error.

## 7. Validation Cases

1. Zero drive and diagonal initial state: populations remain fixed.
2. Zero drive and coherent state: phases follow the diagonal Hamiltonian.
3. Weak, spectrally selective pulse: qutrit computational dynamics approach
   the corresponding two-level result.
4. Fixed pulse with two values of $|\alpha|$: document the observed leakage
   difference.
5. Representative stronger pulse: nonzero $P_2$ is detected.
6. Closed pulse followed by idle: populations remain fixed while phases may
   continue evolving according to the rotating-frame Hamiltonian.

Statements such as "larger anharmonicity reduces leakage" must be limited to
the fixed tested conditions, not presented as a universal theorem.

## 8. Likely Files

```text
core/pulse_qutrit.py
core/pulse_evolution.py
validation_pulse/qutrit_closed.py
scripts/validate_pulse_qutrit_closed.py
tests/test_pulse_b1_closed_qutrit.py
docs/validation/pulse-b-closed-qutrit.md
```

## 9. Artifacts

```text
validation_results/pulse_b_closed_qutrit.json
validation_results/pulse_b_closed_qutrit.csv
validation_results/pulse_b_closed_qutrit_populations.png
validation_results/pulse_b_closed_qutrit_leakage.png
```

## 10. Completion Criteria

- Trace, Hermiticity, and population sum satisfy fixed tolerances.
- Zero-drive analytic cases pass.
- Leakage metrics agree with $\rho_{22}$ at every checkpoint.
- Weak-drive comparison to Baseline A behaves consistently under documented
  conditions.
- Raw physicality remains acceptable at the selected fine validation step.
- Baseline A trajectories remain unchanged.

## 11. Stop Conditions

Do not proceed to open-system qutrit dynamics if leakage depends on basis
ordering inconsistently, if cleanup is required to hide systematic negative
eigenvalues, or if the two-level limit has an unexplained sign mismatch.

## 12. Implementation Result

B-1 added a separate closed-qutrit execution path without changing the frozen
two-level Baseline A path:

```text
core/pulse_qutrit.py
validation_pulse/qutrit_closed.py
scripts/validate_pulse_qutrit_closed.py
tests/test_pulse_b1_closed_qutrit.py
tests/test_validation_pulse_qutrit_closed.py
```

The existing `core/pulse_evolution.py` RK4 primitive was already
dimension-independent. A 3x3 regression test was added, but the solver did not
need to be modified.

The implementation provides:

- 3x3 closed density-matrix evolution under the B-0 qutrit Hamiltonian,
- square and Gaussian in-phase pulses,
- rotating-frame free evolution after the pulse,
- unnormalized `population_0`, `population_1`, and `population_2`,
- `computational_population = population_0 + population_1`,
- pulse-end, final, and checkpoint-sampled maximum leakage,
- raw physicality and cleanup diagnostics.

The maximum metric is deliberately named:

```text
maximum_recorded_leakage_probability
```

It is the maximum over returned checkpoints, not a continuous-time optimizer.

## 13. Validation Result

The reproducible command is:

```powershell
.\.venv\Scripts\python.exe scripts\validate_pulse_qutrit_closed.py
```

All five validation cases passed:

1. zero-drive `|2>` population preservation,
2. analytic free `|0>`-`|2>` coherence evolution,
3. weak selective pulse comparison with the two-level computational block,
4. fixed Gaussian pulse comparison at `alpha = -100 MHz` and `-300 MHz`,
5. closed pulse followed by rotating-frame free idle.

Key measured values:

| Measurement | Result |
|---|---:|
| Free-coherence maximum error | `1.3044631066429446e-12` |
| Weak-pulse computational-block error | `0.0014647467793956696` |
| Weak-pulse final leakage | `1.7871925768668364e-12` |
| Maximum recorded leakage at `-100 MHz` | `0.36485329070557226` |
| Maximum recorded leakage at `-300 MHz` | `0.041015975795483266` |
| Closed-idle maximum population change | `0.0` |
| Worst raw minimum eigenvalue in the validation set | `-1.7130808431876046e-13` |

The larger-magnitude anharmonicity produced less recorded leakage only for the
fixed pulse used by this validation. It is not asserted as a universal
monotonic theorem.

Artifacts:

```text
validation_results/pulse_b_closed_qutrit.json
validation_results/pulse_b_closed_qutrit.csv
validation_results/pulse_b_closed_qutrit_populations.png
validation_results/pulse_b_closed_qutrit_leakage.png
docs/validation/pulse-b-closed-qutrit.md
```

## 14. Remaining Boundary

B-1 does not establish qutrit dissipation, finite-temperature behavior, DRAG,
the production qutrit safe-step policy, QuTiP agreement, public qutrit API
execution, or Pulse Lab UI behavior. Those remain assigned to B-2 through
B-6.
