# Phase 3A: Explicit CPTP to QuTiP Audit

## Decision

**PASS**

## Frozen Contract

- Freeze ID: `quantascope_explicit_cptp_v1`
- Evolution method: `explicit_cptp_midpoint_gksl_v1`
- Time-dependent policy: midpoint piecewise constant.
- Density-matrix cleanup: not applied.

## Method

- QuantaScope and QuTiP receive identical initial density matrices.
- QuTiP receives the exact QuantaScope Hamiltonian matrices and collapse-operator matrices.
- Temperature and device parameters are not independently reinterpreted by QuTiP.
- Every CPTP interval boundary is compared with QuTiP `mesolve` using DOP853.
- Three interval sizes are preregistered for each case.
- Python and Rust CPTP trajectories are compared against the same QuTiP trajectory.

## Preregistered Acceptance

- Physicality tolerance: `1.0e-10`
- Python/Rust parity tolerance: `2.0e-10`
- Maximum trajectory trace distance must decrease under interval refinement.
- Finest-grid maximum trajectory trace distance must remain below the case-specific limit.

## Results

| Case | Backend | Interval [us] | Intervals | Max element | Frobenius | Trace distance | Min state eig |
|---|---|---:|---:|---:|---:|---:|---:|
| `two_level_gaussian_open_pulse` | `python` | 0.01 | 24 | 3.537226e-04 | 5.654076e-04 | 3.998035e-04 | 0.000000e+00 |
| `two_level_gaussian_open_pulse` | `python` | 0.005 | 48 | 8.812833e-05 | 1.410437e-04 | 9.973294e-05 | 0.000000e+00 |
| `two_level_gaussian_open_pulse` | `python` | 0.0025 | 96 | 2.201326e-05 | 3.524177e-05 | 2.491969e-05 | 0.000000e+00 |
| `two_level_gaussian_open_pulse` | `rust` | 0.01 | 24 | 3.537226e-04 | 5.654076e-04 | 3.998035e-04 | 0.000000e+00 |
| `two_level_gaussian_open_pulse` | `rust` | 0.005 | 48 | 8.812833e-05 | 1.410437e-04 | 9.973294e-05 | 0.000000e+00 |
| `two_level_gaussian_open_pulse` | `rust` | 0.0025 | 96 | 2.201326e-05 | 3.524177e-05 | 2.491969e-05 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `python` | 0.0002 | 80 | 8.817003e-05 | 1.950038e-04 | 1.379126e-04 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `python` | 0.0001 | 160 | 2.202512e-05 | 4.871928e-05 | 3.445576e-05 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `python` | 5e-05 | 320 | 5.506179e-06 | 1.217910e-05 | 8.613462e-06 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `rust` | 0.0002 | 80 | 8.817003e-05 | 1.950038e-04 | 1.379126e-04 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `rust` | 0.0001 | 160 | 2.202512e-05 | 4.871928e-05 | 3.445576e-05 | 0.000000e+00 |
| `qutrit_drag_open_pulse` | `rust` | 5e-05 | 320 | 5.506179e-06 | 1.217910e-05 | 8.613462e-06 | 0.000000e+00 |

## Case Decisions

| Case | Python/Rust max element | Parity | Case decision |
|---|---:|---|---|
| `two_level_gaussian_open_pulse` | 1.776362e-15 | PASS | PASS |
| `qutrit_drag_open_pulse` | 3.775414e-15 | PASS | PASS |

## Interpretation

- A pass establishes agreement for the shared equations and tested discretizations.
- It confirms refinement behavior of the frozen midpoint CPTP approximation.
- It does not validate calibration against real hardware.
- It does not add an explicit CPTP path to gate-aware execution.

## Artifacts

- Machine-readable summary: `validation_results/cptp_qutip_comparison.json`
- Checkpoint metrics: `validation_results/cptp_qutip_comparison.csv`
