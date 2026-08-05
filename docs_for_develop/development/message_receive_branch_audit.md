# Message / Receive branch audit

## Scope

The existing Physical Timeline View is unchanged. This audit covers only the
measurement-branch data that could be used by the separate
`animation_parameter_t` state-transfer view.

## Findings

- `core/classical_branching.py` and `core/statevector.py` generate branches in
  the backend. The records exposed to the UI contain branch probability,
  classical bits, and measurement history.
- The exposed records do **not** contain branch density matrices. They are not
  frontend-derived, but they are also not sufficient to calculate a received
  ensemble density matrix.
- Branch probabilities are now normalized by the backend and the response
  exposes `branch_probability_sum` and `branch_probability_normalized`.
- Classical corrections are only conditional when `condition` or `conditions`
  are present in the circuit model. The UI now exposes them as `X[c1=1]`-style
  labels; visual placement alone is not treated as conditioning.

## Safety boundary

Until branch density matrices are added to the response, the Message / Receive
view must not claim `rho_receive = sum_c p_c rho_receive_corrected[c]`. The next
implementation stage is an explicit, bounded branch-state contract that carries
post-correction density matrices and validates their weighted trace.

## Deferred idea

An `animation_parameter_t` sweep remains documented as a future idea, but its
UI and endpoint are intentionally disabled for the MVP. The current product
priority is direct teleportation verification and physical-time understanding.
