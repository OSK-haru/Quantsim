# Pulse B-1 Closed Qutrit Validation

## Decision

**Result: PASS**

The fixed B-1 cases validate closed 3x3 rotating-frame qutrit
evolution and checkpoint-sampled leakage. They do not validate
qutrit dissipation, DRAG, QuTiP agreement, or hardware behavior.

## Cases

| Case | Result |
|---|---|
| `zero_drive_basis_2` | PASS |
| `free_coherence_0_2` | PASS |
| `weak_selective_pi_over_2` | PASS |
| `fixed_gaussian_anharmonicity_comparison` | PASS |
| `closed_pulse_then_free_idle` | PASS |

## Key Measurements

| Metric | Value |
|---|---:|
| Free 0-2 coherence error | `1.304463e-12` |
| Weak-pulse qutrit/two-level block error | `1.464747e-03` |
| Weak-pulse final leakage | `1.787193e-12` |
| Maximum recorded leakage, -100 MHz | `3.648533e-01` |
| Maximum recorded leakage, -300 MHz | `4.101598e-02` |
| Idle population change | `0.000000e+00` |
| Idle 0-1 coherence change | `7.499932e-04` |

## Interpretation

- Zero drive preserves basis populations.
- Free 0-2 coherence follows the diagonal Hamiltonian phase.
- A weak selective pulse remains close to the two-level result but
  retains a finite qutrit/AC-Stark correction.
- The fixed strong-pulse comparison records lower leakage for
  `-300 MHz` than for `-100 MHz`; this is not a universal hardware
  performance claim.
- Closed free idle preserves populations while coherent phases evolve.

## Numerical Boundary

B-1 uses explicitly fine validation steps. It does not establish the
production qutrit safe-step policy; that belongs to B-3.
`maximum_recorded_leakage_probability` is the maximum over retained
checkpoints and is not guaranteed to capture an extremum between
checkpoints.

## Artifacts

```text
validation_results/pulse_b_closed_qutrit.json
validation_results/pulse_b_closed_qutrit.csv
validation_results/pulse_b_closed_qutrit_populations.png
validation_results/pulse_b_closed_qutrit_leakage.png
```
