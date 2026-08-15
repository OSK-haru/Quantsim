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
| `driven_coupled_transmon_pair_rwa_experimental_v1` | Coupled two-transmon pulse RWA experimental model | RK4 / Explicit CPTP, Python / Rust |
| `gate_aware_cptp_kraus` | CPTP Kraus evolution | Planned execution mode, not selectable |
| `explicit_cptp` | Explicit CPTP evolution | Public request value, selectable in both the gate-aware API/Run panel and the Pulse API/Pulse Lab |
| `gate_aware_constant_gksl_exponential_v1` | Gate-aware constant GKSL exponential v1 | Frozen gate-aware evolution method that `explicit_cptp` resolves to |
| `explicit_cptp_midpoint_gksl_v1` | Explicit CPTP midpoint GKSL v1 | Frozen Pulse evolution method that `explicit_cptp` resolves to |
| `logical_direct` | Logical gate (direct) | Gate-aware advanced-gate mode |
| `auto_decompose` | Auto-decompose to native gates | Gate-aware advanced-gate mode |
| `gate_aware_hxyzst_rz_cnot_v3` | Gate-aware native gate set v3 | Current compiler target; logical RX/RY are lowered to H/RZ |

## Current Computation Path

The current simulation path is:

```text
SimulationConfig -> run_simulation(config) -> SimulationResult
```

The active model is a gate-aware open-system simulation. The current evolution
mode is `gate_aware_hamiltonian_lindblad_v1`: each gate column is represented
by an effective Hamiltonian while Lindblad noise acts during the operation.
The Hamiltonian construction is `effective_unitary_spectral_generator_v2`.
Hermitian involutions retain the frozen legacy generator, while other unitary
gates use a principal-eigenphase Hermitian generator. This supports Y, S, and
T without routing circuit state through Pulse Lab.

Advanced logical gates select either `logical_direct` or `auto_decompose` at
execution time. The first implemented rule is
`CZ -> H(target), CNOT(control, target), H(target)`. Both modes retain the
Gate-aware environment during their respective gate durations; direct does
not mean noiseless. Compiler cost and source-map details are returned with the
run result. See `docs_for_develop/physics/gate-aware-advanced-gate-compilation.md`.

The second audited rule is
`SWAP(a,b) -> CNOT(a,b), CNOT(b,a), CNOT(a,b)`. SWAP is represented with two
targets and no controls, preserving its symmetric logical meaning. Disjoint CZ
and SWAP gates in one logical column share the same three compiled layers.

The parameterized rule is `CP(theta) -> RZ(control, theta/2) +
RZ(target, theta/2), CNOT, RZ(target, -theta/2), CNOT`. Its unitary differs
from the standard controlled-phase matrix only by the global phase
`exp(-i theta/4)`, so the density-matrix channel is identical. Source maps
retain signed `theta_rad` values and native durations.

The three-qubit rule is `CCX -> H/CNOT/RZ(±pi/4)` with 15 operations in 13
layers. CCX uses two controls and one distinct target. Under the native RZ
convention, the compiled unitary is `exp(-i pi/8) CCX`; its density-matrix
channel and all eight computational-basis truth-table entries match the
logical gate.

Parameterized single-qubit rotations use the standard convention
`RP(theta) = exp(-i theta P/2)`. The audited compiler rules are
`RX(theta) -> H, RZ(theta), H` and
`RY(theta) -> RZ(-pi/2), H, RZ(theta), H, RZ(pi/2)` in time order. The
signed input angle is retained in the source map, and both decompositions
match their logical unitaries without an additional global phase.

`MEASURE` is implemented as a computational-basis projective channel at its
circuit-column boundary. A `MEASURE` with no classical bit assigned is
non-selective and its outcome is discarded. A `MEASURE` bound to a classical
bit acts as a selective instrument: outcomes are retained as classical branches
and drive conditional feed-forward corrections, with Gate-aware noise applied
per branch. Post-selection and readout error are not implemented. Independently,
the final computational-basis distribution is sampled with configurable
`shots` and `seed`, and the UI exposes reproducible counts. Because an ideal
state may become mixed after measurement, mixed-reference comparisons use
Uhlmann fidelity. See `docs_for_develop/physics/gate-aware-measurement-model.md`
for the formula, implementation transformation, and current limitations.

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

model_id: driven_coupled_transmon_pair_rwa_experimental_v1
contract_version: pulse-coupled-pair-v1
```

The first two contracts are single-subsystem rotating-frame RWA models. The
coupled-pair contract uses two three-level transmons, a nine-dimensional
density matrix, and exchange coupling. None is a calibrated hardware pulse
simulator. See `docs_for_develop/physics/pulse-baseline-a-model.md`,
`docs_for_develop/physics/pulse-extension-b-qutrit-contract.md`, and
`docs_for_develop/physics/pulse-coupled-transmon-pair-model.md`.

The two single-subsystem Pulse request contracts accept `evolution_method` with
`fixed_step_rk4` as the backward-compatible default and `explicit_cptp` as an
explicit alternative. The latter uses audited midpoint-frozen GKSL
exponential maps and does not apply density-matrix cleanup.

The coupled-pair contract accepts `fixed_step_rk4` and audited `explicit_cptp`
with Python, Rust, or automatic backend resolution.

The C10 freeze ID is `yuragi_strider_explicit_cptp_v1`. On the Pulse endpoint
the public API value `explicit_cptp` resolves to
`explicit_cptp_midpoint_gksl_v1`. The same public value on the gate-aware
endpoint resolves to the separately frozen
`gate_aware_constant_gksl_exponential_v1`; the two share the Choi audit
contract but not the map construction.

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
and Pulse Lab, and separately through gate-aware `run_simulation` via
`evolution_method: "explicit_cptp"`, which builds one constant-GKSL
exponential map per finite gate column and idle interval
(`gate_aware_constant_gksl_exponential_v1`, see
`docs_for_develop/validation/gate-aware-cptp-freeze.md`). Gate-aware explicit
CPTP is capped at 5 noisy qubits, and 5-qubit conditional circuits fall back to
RK4 for their branches. None of this makes the planned `gate_aware_cptp_kraus`
Kraus-composition execution mode available.

RK4 and explicit CPTP accuracy, physicality, and local runtime observations
are recorded in `docs_for_develop/validation/cptp-rk4-comparison.md`. The comparison does
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
