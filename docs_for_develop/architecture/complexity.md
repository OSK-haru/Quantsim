# Computational Complexity

Yuragi-Strider uses dense density matrices. The public backend remains
`python_dense`; when NumPy is installed, its active dense execution engine is
`numpy_dense_v1`. A pure-Python tuple implementation remains available for
regression comparison. `rust_dense_preview` is an optional preview request
path and is not the default.

## Symbols

- `n`: logical qubits
- `d = 2^n`: Hilbert space dimension
- `T`: configured time samples
- `C`: circuit column count
- `S_total`: total RK4 integration steps after internal substepping
- `S_gate`: RK4 substeps spent in gate-Hamiltonian segments
- `S_idle`: RK4 substeps spent in post-circuit idle segments

## Memory

A density matrix stores `d x d` complex entries:

```text
O(d^2) = O(4^n)
```

If all recorded states are retained, storage scales as:

```text
O(T d^2)
```

The simulator currently stores recorded noisy and ideal states internally while
building fidelity and purity series.

## Gate Application

Dense unitary application uses:

```text
U rho U dagger
```

This is dominated by dense matrix multiplication:

```text
O(d^3) = O(8^n)
```

## Lindblad RHS

For the unified physical rates model, the simulator estimates three collapse
operators per qubit: relaxation, thermal excitation, and pure dephasing.

```text
collapse operators ~= 3n
```

Each Lindblad RHS evaluation is therefore dominated by:

```text
O(n d^3) = O(n 8^n)
```

## RK4

RK4 evaluates the RHS four times per integration step:

```text
4 * S_total RHS evaluations
```

## Gate-Aware Total

Gate-aware effective-Hamiltonian Lindblad simulation evolves during gate
columns and idle time. Its dominant work is estimated as:

```text
O(S_total n 8^n)
```

Additional dense gate/column construction contributes roughly:

```text
O(C 8^n)
```

The diagnostics also expose a segment-aware estimate. Each nonzero-duration
circuit column is treated as a `gate` segment, and post-circuit waiting time is
treated as an `idle` segment. For each segment the simulator estimates:

- `duration_us`
- Hamiltonian commutator scale
- environment rate scale
- total generator scale
- RK4 substeps
- RHS evaluations

For an effective involution Hamiltonian:

```text
H = pi / (2 tau) * (I - U)
```

the Hamiltonian spectral scale is approximately `pi / tau`, so the commutator
scale used for substep estimates is approximately:

```text
2 pi / tau
```

The segmented estimate uses:

```text
rhs_work_units_per_eval = (1 + collapse_operator_count) * d^3
estimated_work_units_segmented =
  total_rhs_evaluations * rhs_work_units_per_eval
```

## Completion vs Final

Gate-aware results distinguish:

- `completion_*`: immediately after the last circuit column
- `final_*`: after the configured idle duration has also evolved

This matters when comparing long gates against short gates. A longer gate can
reduce post-gate idle time under a fixed total duration, so the final fidelity
may improve even though the gate itself took longer.

## Practical Note

NumPy reduces the dense-operation constant factor but does not change the
exponential memory and runtime scaling. The estimates are useful for scaling
intuition, not precise wall-clock prediction.

## Recommendation

- Keep default UI flows focused on 2 qubits.
- Treat 3-4 qubit runs as bounded, potentially expensive experiments.
- Treat 5-6 qubits as requiring optimization, reduced sampling, or a future
  backend change.
- Avoid large parameter sweeps until runtime and memory budgets are measured
  with `scripts/benchmark_complexity.py`.
