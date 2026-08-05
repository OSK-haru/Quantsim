# PERF-3D Dense Backend Regression Notes

## Purpose

PERF-3D validates that the internal `numpy_dense_v1` execution path remains
behaviorally equivalent to the pure-Python dense path for representative
2/3/4-qubit simulations.

This pass is diagnostic and regression-focused. It does not change the
Lindblad equation, collapse operators, environment rates, Hamiltonian
construction, time-step policy, public API payloads, or public response shape.

## Dense Representations

The public core matrix representation remains:

```text
tuple[tuple[complex, ...], ...]
```

The NumPy path converts stable boundary inputs to `numpy.ndarray` before the
hot RK4/Lindblad loop:

- current density matrix
- Hamiltonian
- precomputed collapse operators
- precomputed `L dagger`
- precomputed `L dagger L`

The hot loop stays in NumPy arrays and converts the final state back to the
tuple representation only at the segment boundary.

## Equivalence Tolerances

The regression tests use:

```text
absolute tolerance <= 1e-10
relative tolerance <= 5e-8
trace tolerance <= 1e-9
Hermiticity tolerance <= 1e-9
probability-sum tolerance <= 1e-9
minimum eigenvalue >= -1e-9
```

Small negative eigenvalues can appear from floating-point roundoff after RK4
steps and density-matrix cleanup. PERF-3D only detects and reports this; it does
not clamp eigenvalues or alter the state.

## Fallback Controls

The backend choice is internal-only:

```python
from core.dense_numpy import force_numpy_dense_execution, force_python_dense_execution

with force_numpy_dense_execution():
    ...

with force_python_dense_execution():
    ...
```

Nested contexts restore their previous state through `ContextVar` tokens, so
tests can force either engine without leaking state into later runs.

## Regression Script

Run:

```powershell
.\.venv\Scripts\python.exe scripts\check_dense_backend_regression.py
```

The script compares NumPy and pure-Python results across representative 2/3/4
qubit circuits, prints compact pass/fail rows, reports density matrix
differences, probability differences, trace error, Hermiticity error, selected
minimum eigenvalues, and exits non-zero on failure.
