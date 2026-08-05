# Decisions And Open Questions

## Status

This file was updated after the React/FastAPI migration and the 1-4 qubit and
Pulse Baseline A work. It contains only current decisions and genuinely open
questions.

## Decided

### Application Stack

- React/Vite is the active UI.
- FastAPI is the active service boundary.
- Python/NumPy is the reference computation path.
- QuTiP is used for independent validation, not production execution.
- Godot is not an active production target.

### Gate-Aware Circuit Scope

- Core and `POST /api/simulate` support 1-4 logical qubits.
- Circuit Studio supports 2-4 logical qubits.
- H, X, Z, CNOT, and MEASURE are editable in the current frontend.
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
  `docs/development/pulse-extension-b/README.md`.
- B-0 qutrit operators and contract are complete.
- B-1 closed-system qutrit evolution and leakage are complete.
- B-2 transition-specific qutrit dissipation is complete.
- B-3 qutrit convergence and the non-DRAG safe-step policy are complete.
- B-4 Gaussian DRAG control and convergence are complete.
- QuTiP acceptance, public qutrit HTTP execution, and Pulse Lab UI remain
  staged work.

## Open

### Q2 Strict CPTP Production Path

Decide whether the next production solver should use:

- exact channel/Kraus composition,
- matrix exponential Liouvillian propagation,
- or another explicitly CPTP integrator.

The existing fixed-step RK4 paths must not be described as intrinsically CPTP.

### Q3 External Validity

Execute V8 using public hardware datasets or cloud-accessible devices after the
relevant implementation freeze. No private laboratory connection is assumed.

### Q4 Performance Boundary

Re-profile before increasing beyond the current 4-qubit gate-aware scope or
before adding qutrit/multi-qubit pulse simulation. Dense cost remains
exponential in qubit count.
