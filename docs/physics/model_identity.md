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
| `driven_two_level_rwa_experimental_v1` | Two-level pulse RWA experimental model | Implemented through the dedicated pulse API |
| `driven_transmon_qutrit_rwa_experimental_v1` | Three-level transmon pulse RWA experimental model | Implemented through the bounded pulse API |
| `gate_aware_cptp_kraus` | CPTP Kraus evolution | Planned execution mode, not selectable |
| `explicit_cptp` | Explicit CPTP pulse evolution | Selectable in Pulse API and Pulse Lab |
| `explicit_cptp_midpoint_gksl_v1` | Explicit CPTP midpoint GKSL v1 | Frozen Pulse evolution method |

## Current Computation Path

The current simulation path is:

```text
SimulationConfig -> run_simulation(config) -> SimulationResult
```

The active model is a gate-aware open-system simulation. The current evolution
mode is `gate_aware_hamiltonian_lindblad_v1`: each gate column is represented
by an effective Hamiltonian while Lindblad noise acts during the operation.

The default backend is `python_dense`. This is the reference backend for small
dense density-matrix simulations. When NumPy is available, the internal dense
engine uses `numpy_dense_v1`.

## Pulse Model

Pulse Baseline A and Extension B are implemented separately from the
gate-aware path:

```text
POST /api/pulse/simulate
model_id: driven_two_level_rwa_experimental_v1
contract_version: pulse-baseline-a-v1

model_id: driven_transmon_qutrit_rwa_experimental_v1
contract_version: pulse-extension-b-v1
```

Both are single-subsystem, rotating-frame RWA control-envelope models. The
qutrit path exposes leakage and Gaussian DRAG but is still not a calibrated
hardware pulse simulator. See `docs/physics/pulse-baseline-a-model.md` and
`docs/physics/pulse-extension-b-qutrit-contract.md`.

Both Pulse request contracts accept `evolution_method` with
`fixed_step_rk4` as the backward-compatible default and `explicit_cptp` as an
explicit alternative. The latter uses audited midpoint-frozen GKSL
exponential maps and does not apply density-matrix cleanup.

The C10 freeze ID is `quantascope_explicit_cptp_v1`. The public API value
`explicit_cptp` resolves to `explicit_cptp_midpoint_gksl_v1`.

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

Phase 2 C0-C10 provides explicit qubit and qutrit channel libraries,
a Choi audit contract, and a time-independent GKSL exponential map in
`core/cptp.py`, `core/cptp_qutrit.py`, and `core/cptp_liouvillian.py`.
`core/cptp_piecewise.py` composes midpoint-frozen interval maps for a
time-dependent Hamiltonian. `core/cptp_rust.py` provides the audited Rust
parity path for both exponential methods.
Standalone Choi matrices can be audited for Hermiticity, complete positivity,
and trace preservation under the frozen convention. Ordered Kraus-channel
composition is also implemented. The GKSL map is generated with a NumPy-only
dense exponential. Every time-dependent interval and its composed map are
audited before use. The equivalent Rust-generated maps are audited by the
same Choi contract. The exponential path is selectable through the Pulse API
and Pulse Lab, but it is not connected to gate-aware `run_simulation`. Its
presence does not make the planned `gate_aware_cptp_kraus` execution mode
available.

RK4 and explicit CPTP accuracy, physicality, and local runtime observations
are recorded in `docs/validation/cptp-rk4-comparison.md`. The comparison does
not change the default evolution method and does not claim that finite RK4
steps are CPTP.

## Codex Guardrails

- Do not change core physics in UI tasks.
- Do not modify the Lindblad equations for label or documentation work.
- Do not route gate-aware evolution through CPTP unless a task explicitly
  asks for it.
- Do not present planned modes as implemented.
- Keep `SimulationConfig -> run_simulation(config) -> SimulationResult` stable.
- Do not change the `SimulationResponse` shape for display-label tasks unless
  there is no smaller UI-only alternative.
