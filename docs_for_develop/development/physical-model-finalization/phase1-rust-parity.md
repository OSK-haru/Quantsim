# Phase 1: Rust RK4 Parity

## Status

**COMPLETE**

This phase starts from the Python reference tag
`yuragi-strider-python-reference-pulse-b-v1`. It adds a Rust implementation of
the raw, time-dependent RK4 dense-matrix calculation without changing a
Hamiltonian, collapse operator, time grid, or density-matrix cleanup rule.

## Implemented Boundary

Python continues to evaluate the time-dependent Hamiltonian at the prescribed
RK4 stage times:

```text
t, t + dt/2, t + dt/2, t + dt
```

Rust receives the four resulting matrices and performs only the raw Lindblad
RHS and RK4 algebra. Python still measures physicality and calls
`clean_density_matrix` once after every completed RK4 step. Consequently,
the Rust path does not introduce stage-level cleanup or a new physical model.

## Completed Checks

The new `tests/test_rust_time_dependent_parity.py` verifies Python/Rust
agreement to `1e-12` for:

- Lindblad RHS;
- each of the four RK4 stages;
- a raw RK4 step;
- cleaned multi-step trajectories and checkpoints;
- two-level Gaussian pulses with phase, detuning, and dissipation;
- qutrit Gaussian DRAG pulses with leakage and dissipation;
- two-level square, Gaussian, detuned, dissipative, and pulse-to-idle
  sequences;
- qutrit DRAG, leakage, dissipation, and pulse-to-idle sequences;
- gate-aware unitary, open-system, Bell, long-CNOT, and idle trajectories
  through the existing Rust preview parity suite;
- explicit `rust` and availability-based `auto` core selection;
- Pulse Baseline A and Pulse Extension B request-level backend selection;
- API diagnostics recording of requested/resolved backends and fallback use;
- API-level Python/Rust final-density-matrix parity for two-level and qutrit
  requests;
- `auto` fallback to Python when the Rust extension is unavailable.

Each Pulse API request additionally emits a structured
`pulse_backend_selected` log record with the model ID, requested backend,
resolved backend, and fallback status.

The existing default remains `backend="python"`. The accepted request and
internal selection values are `python`, `rust`, and `auto`. Diagnostics expose
the requested backend, resolved backend, and whether `auto` used the Python
fallback. A requested `rust` path fails explicitly if the compiled extension
is unavailable; only `auto` falls back to Python.

## Current Validation

On 2026-07-25:

| Check | Result |
|---|---|
| Rust preview, Pulse Rust parity, and Pulse API target suite | 33 tests passed in 23.029 s |
| Pulse API and Rust time-dependent parity suite | 25 tests passed in 40.263 s |
| Direct two-level/qutrit solver regression | 46 tests passed in 84.146 s |
| Full Python unittest discovery | 483 tests passed in 486.967 s |
| Rust crate tests | passed |
| Pulse Lab contract validation | passed |
| Frontend lint | passed |
| Frontend production build | passed |
| Canonical Markdown link audit | 25 documents, 44 local links, 0 broken |
| `git diff --check` | passed |

## Completion Decision

**GO FOR PHASE 2**

The Rust RK4 path is a faithful dense-algebra implementation of the frozen
Python reference for the covered models and trajectories. It remains an RK4
integrator with the same cleanup policy as Python; it is not yet a
finite-step CPTP method. CPTP construction and validation therefore remain
the responsibility of Phase 2.

## Non-Goals

This work does not change the Lindblad equation, physical rates, Hamiltonian
units, Pulse Lab UI, `SimulationResponse`, or the gate-aware public API.
It does not claim CPTP preservation; that belongs to Phase 2.
