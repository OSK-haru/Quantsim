# Model Identity

This file defines the canonical labels used when the UI describes the current
physics model and computation method. It is a display and documentation guide;
it does not change simulation physics.

## Canonical IDs and Labels

| Internal ID | User-facing label | Status |
| --- | --- | --- |
| `gate_aware_open_system` | Gate-aware open system | Current simulation model |
| `gate_aware_hamiltonian_lindblad_v1` | Gate-aware Hamiltonian Lindblad v1 | Current evolution mode |
| `python_dense` | Python dense backend | Default backend |
| `rust_dense_preview` | Rust dense preview | Preview backend |
| `gate_aware_cptp_kraus` | CPTP Kraus evolution | Planned mode, not implemented |

## Current Computation Path

The current simulation path is:

```text
SimulationConfig -> run_simulation(config) -> SimulationResult
```

The active model is a gate-aware open-system simulation. The current evolution
mode is `gate_aware_hamiltonian_lindblad_v1`: each gate column is represented
by an effective Hamiltonian while Lindblad noise acts during the operation.

The default backend is `python_dense`. This is the reference backend for small
dense density-matrix simulations.

## Preview Backend

`rust_dense_preview` is an optional preview acceleration path. It may be shown
as a preview backend, but it should not be presented as the default validated
backend.

## Future Mode

`gate_aware_cptp_kraus` should be described as a planned future mode, for
example:

- Planned mode
- Not available yet
- Future research mode

Do not present `gate_aware_cptp_kraus` as implemented or selectable in the
current simulation path.

## Codex Guardrails

- Do not change core physics in UI tasks.
- Do not modify the Lindblad equations for label or documentation work.
- Do not implement CPTP Kraus evolution unless a task explicitly asks for it.
- Do not present planned modes as implemented.
- Keep `SimulationConfig -> run_simulation(config) -> SimulationResult` stable.
- Do not change the `SimulationResponse` shape for display-label tasks unless
  there is no smaller UI-only alternative.
