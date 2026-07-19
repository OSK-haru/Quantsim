# VALIDATION-6: Time-Step and Numerical Convergence

## Role

You are working on QuantaScope, a local open-quantum-system simulator with a React frontend, FastAPI boundary, Python orchestration, and an optimized dense numerical backend. The current continuous-time model is a gate-aware Lindblad master equation solved numerically. VALIDATION-1 through VALIDATION-5 have passed.

This task is a **numerical verification package**. Do not change the production physics equations, rate conventions, gate semantics, API contract, frontend behavior, or default solver policy merely to make tests pass.

## Goal

Verify that the numerical solution converges as the integration time step is refined, and quantify the observed convergence behavior for representative one-qubit and gate-aware open-system cases.

The validation must distinguish between:

1. **Output sampling density**
2. **Actual internal integration step size**
3. **Requested snapshot times**
4. **Gate/event boundaries**

Changing the number of output points alone is not a valid convergence test if the internal integration step remains unchanged.

## Required physical conventions

Use the canonical names introduced by the rate-variable migration:

```text
gamma_down_per_us
gamma_up_per_us
gamma_population_relaxation_per_us
gamma_phi_per_us
t1_base_us
t1_effective_us
```

Use:

```text
gamma_population_relaxation_per_us
  = gamma_down_per_us + gamma_up_per_us
```

Do not use the deprecated `gamma1_per_us` except in explicit compatibility assertions.

The production pure-dephasing convention is:

```text
L_phi = sqrt(gamma_phi_per_us / 2) * sigma_z
```

## Scope

Create:

```text
tests/test_validation_time_step_convergence.py
scripts/validate_time_step_convergence.py
docs/validation/validation-6-time-step-convergence.md
validation_results/validation6_time_step_convergence.json
validation_results/validation6_time_step_convergence.csv
validation_results/validation6_time_step_convergence.png
validation_results/validation6_observed_order.png
```

Do not edit production physics code unless a real numerical defect is found. If a defect is found, first record the failing case and error quantitatively before proposing a production change.

## Part A: Audit the current integration policy

Before implementing the validation, inspect and document:

- where internal substep count is chosen
- whether the solver uses fixed-step RK4 or another method
- how gate boundaries are split
- how requested snapshot times affect segment splitting
- whether event boundaries force exact integration endpoints
- whether `time_steps` controls output sampling, internal step size, or both
- whether NumPy and pure-Python dense paths use the same numerical algorithm
- whether any normalization, Hermitization, clipping, or trace correction occurs after a step

Record exact function names and file paths in the report.

## Part B: Add a validation-only internal-step control

The test package must be able to run the same physical case with explicitly controlled maximum integration step sizes.

Preferred approach:

- add a validation-only helper or existing internal parameter such as `integration_step_us`
- do not expose it through the public API or UI
- do not change the default production behavior
- do not duplicate the Lindblad RHS implementation
- call the real production evolution path

If the existing solver already supports a step override, use it.

## Step grid

For each case, run at least these maximum internal steps:

```text
1.0 us
0.5 us
0.25 us
0.125 us
0.0625 us
```

If a case has a much shorter natural timescale, scale this grid so that the coarsest case remains stable but visibly inaccurate. Record the actual grid used.

Also compute one finer reference solution, for example:

```text
0.03125 us
```

or a sufficiently fine independently justified value.

Do not use the same result as both the candidate and the reference.

## Validation cases

Implement all cases below.

### V6-1: Pure downward relaxation

Conditions:

```text
1 qubit
initial state |1>
H = 0
gamma_down_per_us = 0.1
gamma_up_per_us = 0
gamma_phi_per_us = 0
```

Use the analytic solution:

```text
P1(t) = exp(-gamma_down_per_us * t)
```

Suggested duration:

```text
0 <= t <= 5 * T1
T1 = 1 / gamma_down_per_us
```

Compare each step size directly against the analytic solution.

### V6-2: Pure dephasing

Conditions:

```text
1 qubit
initial state |+>
H = 0
gamma_down_per_us = 0
gamma_up_per_us = 0
gamma_phi_per_us = 0.1
```

Use:

```text
rho01(t) = 0.5 * exp(-gamma_phi_per_us * t)
```

Verify that populations remain constant while coherence converges.

### V6-3: Finite-temperature relaxation

Conditions:

```text
1 qubit
initial state |1>
H = 0
gamma_down_per_us = 0.051
gamma_up_per_us = 0.049
gamma_phi_per_us = 0
```

Use:

```text
P1_eq = gamma_up / (gamma_down + gamma_up)
P1(t) = P1_eq + (1 - P1_eq) * exp(-(gamma_down + gamma_up) * t)
```

This checks simultaneous upward and downward channels.

### V6-4: Driven gate with dissipation

Use a representative gate-aware case where no simple full analytic density-matrix solution is required.

Recommended:

```text
1 qubit
initial state |0>
finite-duration H gate
gamma_down_per_us > 0
gamma_phi_per_us > 0
gamma_up_per_us = 0 or a small positive value
idle duration = 0
```

Requirements:

- use the real gate-aware effective Hamiltonian path
- include gate and dissipation simultaneously
- compare each step result against the finest-step reference
- compare the full density matrix, not only output probabilities

### V6-5: Two-qubit entangling gate with dissipation

Recommended circuit:

```text
H(q0)
CNOT(q0 -> q1)
```

Use nonzero downward relaxation and pure dephasing.

Requirements:

- preserve q0-as-MSB convention
- use the production multi-qubit operator embedding
- compare the full final density matrix against the fine reference
- optionally compare selected intermediate snapshots at column boundaries

### V6-6: Snapshot-grid independence

Run the same physical case with:

```text
few output snapshots
many output snapshots
custom requested times
```

while holding the internal integration step fixed.

Verify that the state at common physical times agrees within tolerance.

This test must prove that output sampling does not silently alter the physical result beyond expected floating-point noise.

### V6-7: Backend consistency under refinement

If both NumPy dense and pure-Python dense paths remain available, run at least one one-qubit and one two-qubit case through both backends using the same internal step.

Compare:

- final density matrix
- selected snapshots
- trace
- Hermiticity
- minimum eigenvalue

Do not require bitwise equality. Use numerical tolerance.

## Error metrics

For each step size and case, record:

```text
max density-matrix element error
Frobenius norm error
trace distance
population error
coherence error when applicable
trace error
Hermiticity error
minimum density-matrix eigenvalue
runtime
number of internal steps
```

For analytic cases, compare against the analytic solution.

For gate-aware and multi-qubit cases, compare against the finest-step numerical reference.

## Observed convergence order

For error values `E(h)` at step size `h`, estimate the observed order:

```text
p = log(E(h) / E(h/2)) / log(2)
```

Do not compute an order when either error is zero or dominated by floating-point noise. Mark such rows as `not_reliable`.

Because the current solver is expected to use RK4, the asymptotic global error may approach fourth order in sufficiently smooth segments. However:

- do not hard-code an expectation of exactly 4
- gate boundaries, segment splitting, adaptive substep policy, clipping, or roundoff can alter the observed slope
- report what is measured

The validation passes based on monotonic convergence and sufficiently small fine-step error, not solely on fitted order.

## Required acceptance criteria

Use explicit criteria, preferably:

### Analytic one-qubit cases

```text
fine-step max observable error <= 1e-8
fine-step full-matrix error <= 1e-8
error decreases monotonically for at least the final three refinements
```

Allow tiny non-monotonicity only when errors are already near machine precision. Document the reason.

### Gate-aware and two-qubit cases

```text
0.125 us vs fine-reference max element error <= 1e-7
0.0625 us vs fine-reference max element error <= 1e-8
trace error <= 1e-10
Hermiticity error <= 1e-10
minimum eigenvalue >= -1e-10
```

Adjust only if the measured scale justifies it, and document any adjustment. Do not loosen thresholds silently.

### Snapshot-grid independence

At common times:

```text
max element difference <= 1e-10
```

unless the current implementation necessarily changes segment boundaries. If so, explain and use a stricter internal-step-fixed comparison design.

### Backend consistency

```text
max element difference <= 1e-10
```

or the existing backend-regression tolerance, whichever is stricter and justified.

## Physicality checks

At every recorded snapshot verify:

```text
all values finite
trace approximately 1
Hermiticity
minimum eigenvalue within tolerance
populations within numerical tolerance of [0, 1]
```

Do not silently renormalize or clip only inside the validation code.

## CSV schema

At minimum include:

```text
case
reference_type
backend
max_internal_step_us
actual_internal_step_count
requested_time_us
actual_time_us
max_element_error
frobenius_error
trace_distance
population_error
coherence_error
trace_error
hermiticity_error
minimum_eigenvalue
runtime_ms
observed_order
order_reliable
result
```

## JSON report

Include:

```text
validation
base_git_commit
solver_method
integration_policy_audit
step_grids
reference_policy
tolerances
cases
snapshot_grid_independence
backend_consistency
overall_pass
scope
```

For every case preserve raw per-step metrics, not only summaries.

## Plots

Generate at least two actual calculation figures.

### Figure 1: Error versus step size

- x-axis: internal step size on log scale
- y-axis: error on log scale
- one line per validation case or metric
- invert x-axis if useful so refinement reads left-to-right
- title must identify this as an actual calculation result

### Figure 2: Observed order

- plot observed order versus step refinement level
- include a horizontal reference line at 4 only as a visual guide, not as a pass condition
- omit or mark unreliable points

Do not specify hard-coded plotting colors unless the existing project plotting conventions require it.

## Markdown report

Write a report that clearly distinguishes:

1. what was controlled
2. what was held fixed
3. what was used as the reference
4. whether output sampling changed the result
5. whether convergence was monotonic
6. measured convergence order
7. numerical stability and physicality
8. limitations

The conclusion must not claim that finite-step RK4 is structurally CPTP. A converged and physically valid tested trajectory does not prove complete positivity for arbitrary step size or arbitrary input state.

Use wording such as:

> The tested trajectories converge under internal-step refinement and preserve trace, Hermiticity, and positivity within the stated numerical tolerances. This supports numerical consistency of the current Lindblad integration path for the tested regimes, but does not constitute a general proof that every finite RK4 step is a CPTP map.

## Regression requirements

Run:

```text
VALIDATION-1
VALIDATION-2
VALIDATION-3
VALIDATION-4
VALIDATION-5
new VALIDATION-6 tests
full Python regression suite
frontend build only if production TypeScript files changed
git diff --check
```

Do not regenerate or alter prior validation results unless necessary. If prior artifacts change due only to formatting or environment metadata, explain why.

## Non-goals

Do not:

- implement QuTiP comparison here
- add pulse-level Hamiltonians
- add adaptive ODE solvers
- add CPTP/Kraus replacement
- change physical rate formulas
- change gate durations
- change public API defaults
- optimize performance at the expense of validation clarity

## Completion checklist

- [ ] current integration policy audited
- [ ] validation-only step control implemented or existing one reused
- [ ] V6-1 through V6-7 implemented
- [ ] analytic and fine-reference comparisons completed
- [ ] observed order estimated carefully
- [ ] snapshot-grid independence checked
- [ ] backend consistency checked
- [ ] physicality checked at all snapshots
- [ ] JSON, CSV, PNG, and Markdown artifacts generated
- [ ] V1-V5 rerun successfully
- [ ] full regression suite passes
- [ ] production physics remains unchanged
- [ ] limitations documented

## Final response format

Report:

```text
files changed
commands run
step grids used
per-case maximum errors
observed convergence orders
snapshot-grid independence result
backend consistency result
physicality result
regression result
whether production code changed
remaining limitations
```
