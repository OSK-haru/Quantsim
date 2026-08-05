# EXT2-3A State Snapshots

## Purpose

State snapshots provide a bounded backend data model for later density-matrix and per-qubit state visualizations.
They preserve computed density matrices at semantic simulation points, but they do not change the Lindblad equation,
gate semantics, integration behavior, backend selection, or API request payloads.

## Snapshot Kinds

- `initial`: state before circuit or idle evolution.
- `column_boundary`: state after a circuit column has completed.
- `after_circuit`: state when all circuit columns have completed, when distinct from the final state.
- `idle_sample`: small number of samples during idle evolution after the circuit has completed.
- `final`: final simulated state.

When multiple meanings land on the same timestamp, the backend keeps one snapshot using deterministic priority:
`final`, `initial`, `after_circuit`, `column_boundary`, then `idle_sample`.

## Bounded Policy

The API does not return every RK4 step or every timeline state. The default hard cap is 10 snapshots.

The collector first records semantic candidates, deduplicates near-equal timestamps, then keeps:

- initial and final states
- circuit completion when distinct
- a deterministic subset of column boundaries and idle samples when the candidate list exceeds the cap

For idle evolution, samples are selected from the existing timeline grid rather than forcing extra integration targets.
This keeps snapshot capture lightweight and avoids changing the simulation path.

## Complex Matrix Format

Density matrices are serialized as separate real and imaginary components:

```json
{
  "real": [[1.0, 0.0], [0.0, 0.0]],
  "imag": [[0.0, 0.0], [0.0, 0.0]]
}
```

The backend validates that serialized matrices are square and finite. It does not renormalize, clamp eigenvalues,
repair positivity, or otherwise alter the computed state.

## Size Implications

For 4 qubits, each density matrix is 16 x 16. With the default maximum of 10 snapshots, the bounded payload contains
at most 2,560 complex entries, represented as real and imaginary numeric arrays.

Use `scripts/check_state_snapshots.py` to inspect representative snapshot counts, semantic kinds, matrix dimensions,
timings, and JSON response sizes.
