# Decisions And Open Questions

## Status

Last reviewed 2026-08-14, after the multi-qubit scale-up, the explicit CPTP
path, and the Pulse Extension B / coupled transmon-pair work. It contains only
current decisions and genuinely open questions.

## Decided

### Application Stack

- React/Vite is the active UI.
- FastAPI is the active service boundary.
- Python/NumPy is the reference computation path.
- QuTiP is used for independent validation, not production execution.
- Godot is not an active production target.

### Gate-Aware Circuit Scope

- Core and `POST /api/simulate` support 1-18 logical qubits. Noisy
  density-matrix evolution is capped at 8, explicit CPTP at 5, and ideal
  measurement-free circuits above 5 use the statevector path.
- Circuit Studio supports 2-8 logical qubits.
- The frontend palette covers H, X, Y, Z, S, T, RX, RY, RZ, CNOT, CZ, CP, CCX,
  SWAP, QFT, ORACLE, MEASURE, and the MESSAGE/RECEIVED annotation pair.
- `MEASURE` is a real computational-basis projection, with classical
  feed-forward branches when it is bound to a classical bit.
- Click placement, drag-and-drop, movement, deletion, Clear, Undo, Redo, and
  circuit JSON import/export are implemented.
- React submits arbitrary `circuit_config`; Bell preset compatibility remains
  available at the API boundary.

### Environment Inputs

- React uses `input_mode: "physical"`.
- API compatibility for `normalized` input remains.
- Physical inputs are educational profile parameters, not hardware
  calibration.
- Finite-temperature population relaxation uses
  `gamma_down + gamma_up`.
- Pure dephasing uses `sqrt(gamma_phi / 2) sigma_z`.

### Pulse Baseline A

- The frozen model is `driven_two_level_rwa_experimental_v1`.
- The frozen API contract is `pulse-baseline-a-v1`.
- Baseline A is one two-level qubit in the rotating frame under RWA.
- Baseline A itself does not include qutrit leakage, DRAG, or multi-qubit
  pulse control.

### Pulse Extension B

- The implementation order is fixed by
  `docs_for_develop/development/pulse-extension-b/README.md`.
- B-0 through B-7 are all complete. B-7 integration and freeze closed with
  `PASS WITH RESTRICTIONS`.
- The frozen qutrit contract is `pulse-extension-b-v1` with model
  `driven_transmon_qutrit_rwa_experimental_v1` and capability status
  `available`.
- A coupled transmon-pair model (`pulse-coupled-pair-v1`) is served from the
  same endpoint with capability status `experimental`.

### Q2 Strict CPTP Path (resolved)

Resolved in favour of matrix-exponential Liouvillian propagation. The
`explicit_cptp` evolution method builds one constant-GKSL exponential map per
finite interval and Choi-audits it before application. It is frozen as
`gate_aware_constant_gksl_exponential_v1` (see
`validation/gate-aware-cptp-freeze.md`).

`fixed_step_rk4` remains the default and must still not be described as
intrinsically CPTP. Explicit CPTP stays capped at 5 noisy qubits because the
Liouvillian is `4^n x 4^n`.

## Open

### Q3 External Validity

Execute V8 using public hardware datasets or cloud-accessible devices after the
relevant implementation freeze. No private laboratory connection is assumed.

### Q4 Performance Boundary

Re-profile before increasing beyond the current 8-qubit noisy gate-aware
ceiling or before adding pulse control beyond the coupled transmon pair. Dense
cost remains exponential in qubit count, and 6-8 qubit runs already depend on
the sparse-Hamiltonian optimizations in the Rust preview kernel.
