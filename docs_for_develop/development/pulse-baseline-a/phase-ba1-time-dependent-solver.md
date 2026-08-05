# BA-1: Time-Dependent Solver Path

## Implementation Status

Status: complete on 2026-07-23.

Implemented:

- Added a separate `evolve_time_dependent_segment(...)` reference path
- Evaluated $H(t)$ independently at all four RK4 stage times
- Added exact segment-boundary and final partial-step handling
- Added bounded, strictly increasing local checkpoint times
- Preserved raw and cleaned states at checkpoints and final time
- Added raw trace, Hermiticity, eigenvalue, and cleanup diagnostics
- Kept the existing gate-level constant path unchanged

Numerical audit semantics:

- Cleanup is never applied inside an RK4 stage.
- Cleanup is applied once after each completed internal RK4 step.
- `raw_trace_error` and `raw_hermiticity_error` are maxima over all raw steps.
- `raw_minimum_eigenvalue` is the minimum eigenvalue of each raw state's
  Hermitian part, minimized over the segment.
- `cleanup_correction_norm` is the maximum Frobenius correction over the
  segment.
- Final time is always retained as a checkpoint.

Verified:

```text
BA-0 and BA-1 tests: 28 passed
Dense and gate-aware nearby regressions: 34 passed
V1-V7 validations: 36 passed
Full Python suite: 350 passed
Frontend production build: passed
git diff --check: passed
```

## 1. Goal

Add a Python/NumPy reference integrator for time-dependent Hamiltonians while
preserving the existing constant-Hamiltonian path.

## 2. Prerequisites

- BA-0 is complete.
- The current constant-path regression baseline is available.

## 3. In Scope

- Time-dependent Hamiltonian interface
- Dedicated RK4 evolution function
- Correct RK4 stage-time evaluation
- Final partial-step handling
- Raw and cleaned density-matrix diagnostics
- Constant-Hamiltonian equivalence tests

## 4. Out of Scope

- Rust time-dependent execution
- Adaptive ODE solvers
- Pulse-specific UI
- Qutrit dimensions
- Strict finite-step CPTP guarantees

## 5. Solver Boundary

Keep two explicit paths:

```text
evolve_constant_segment(...)
evolve_time_dependent_segment(...)
```

The time-dependent Hamiltonian boundary should be equivalent to:

```python
class TimeDependentHamiltonian(Protocol):
    def evaluate(self, local_time_us: float) -> Matrix:
        ...
```

For a step starting at $t$ with width $h$, RK4 must evaluate:

```text
H(t)
H(t + h/2)
H(t + h/2)
H(t + h)
```

The two midpoint evaluations may share a matrix value only if the provider is
pure and the call-count diagnostic remains well defined.

## 6. Numerical Requirements

- Require finite, positive internal step sizes.
- Never integrate beyond the segment endpoint.
- Use a shorter final step when duration is not divisible by the nominal step.
- Pass local segment time to the provider.
- Keep collapse operators constant within this Baseline A path.
- Do not apply cleanup inside individual RK4 stages.
- Record the state before cleanup at configured checkpoints.

## 7. Diagnostics

Record at least:

```text
internal_step_count
rhs_evaluation_count
hamiltonian_evaluation_count
minimum_internal_step_us
maximum_internal_step_us
raw_trace_error
raw_hermiticity_error
raw_minimum_eigenvalue
cleanup_correction_norm
```

## 8. Tests

- Fake provider records exact RK4 stage times.
- Constant provider matches the existing constant RK4 result.
- Zero Hamiltonian preserves the state without collapse operators.
- A final partial step reaches the exact requested endpoint.
- Invalid duration and step inputs are rejected.
- Cleanup diagnostics are populated before and after correction.
- Existing constant-path tests and V1-V7 remain unchanged.

## 9. Completion Criteria

- The new path evaluates all RK4 stage times correctly.
- Constant and time-dependent paths agree for constant $H$ within a fixed,
  documented tolerance.
- No existing gate-level call is routed through the new provider path.
- Raw physicality can be audited without relying on cleanup to hide error.
