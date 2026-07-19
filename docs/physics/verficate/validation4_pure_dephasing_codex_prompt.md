# VALIDATION-4: Pure Dephasing Analytic Validation

## Role

You are working in the existing QuantaScope repository.
Implement a self-contained validation package for the current pure-dephasing convention.

Do not redesign the production physics model in this task.
Do not change the Lindblad equation, Hamiltonian semantics, API contract, frontend behavior, or default environment policy unless a failing validation reveals a pre-existing defect. If a defect is found, record it first, isolate the cause, and make the smallest justified correction with regression coverage.

## Validation objective

Confirm that the current one-qubit pure-dephasing collapse operator

```text
L_phi = sqrt(gamma_phi_per_us / 2) * sigma_z
```

produces the analytic evolution expected under the convention

```text
rho_01(t) = rho_01(0) * exp(-gamma_phi_per_us * t)
rho_10(t) = rho_10(0) * exp(-gamma_phi_per_us * t)
rho_00(t) = rho_00(0)
rho_11(t) = rho_11(0)
```

for zero Hamiltonian and no upward/downward population transitions.

This validation must settle the coefficient convention raised during the physical-model audit:

```text
sqrt(gamma_phi) * sigma_z
vs
sqrt(gamma_phi / 2) * sigma_z
```

The expected production convention is the second one, where `gamma_phi_per_us` is directly the exponential decay rate of the off-diagonal density-matrix elements.

## Analytic derivation to document

For

```text
L_phi = sqrt(gamma_phi / 2) * sigma_z
```

and

```text
drho/dt = L rho L^dagger - 1/2 {L^dagger L, rho}
```

use `sigma_z^2 = I` to obtain

```text
drho/dt = (gamma_phi / 2) * (sigma_z rho sigma_z - rho)
```

For

```text
rho = [[rho_00, rho_01],
       [rho_10, rho_11]]
```

this gives

```text
drho_00/dt = 0
drho_11/dt = 0
drho_01/dt = -gamma_phi * rho_01
drho_10/dt = -gamma_phi * rho_10
```

Therefore

```text
rho_01(t) = rho_01(0) exp(-gamma_phi t)
```

and the populations remain unchanged.

Also document the alternative convention:

```text
L_phi = sqrt(gamma_phi) * sigma_z
```

would instead give off-diagonal decay `exp(-2 gamma_phi t)`.
Do not silently switch conventions.

## Required implementation files

Add or update the following, following existing repository conventions:

```text
tests/test_validation_pure_dephasing.py
scripts/validate_pure_dephasing.py
docs/validation/validation-4-pure-dephasing.md
validation_results/validation4_pure_dephasing.json
validation_results/validation4_pure_dephasing.csv
validation_results/validation4_pure_dephasing.png
validation_results/validation4_pure_dephasing_error.png
```

Reuse the naming and artifact patterns from VALIDATION-1 through VALIDATION-3.

## Test setup

Use a one-qubit direct-rate fixture so the solver path is tested independently of the UI-to-rate conversion layer.

Required conditions:

```text
initial state: |+><+|
H = 0
gamma_down_per_us = 0
gamma_up_per_us = 0
gamma_phi_per_us > 0
collapse operator count = 1
collapse operator = sqrt(gamma_phi_per_us / 2) * sigma_z
```

Construct

```text
|+> = (|0> + |1>) / sqrt(2)
```

so the initial density matrix is

```text
rho(0) = 1/2 [[1, 1],
              [1, 1]]
```

## Required rate cases

Use at least three rates:

```text
V4-1 gamma_phi_per_us = 0.01, T_phi = 100 us
V4-2 gamma_phi_per_us = 0.05, T_phi = 20 us
V4-3 gamma_phi_per_us = 0.10, T_phi = 10 us
```

Use requested sample times corresponding to approximately:

```text
t / T_phi = 0, 0.25, 0.5, 1, 2, 3, 5
```

Ensure `requested_time_us == actual time_us` for validation samples. Do not interpolate density matrices.

## Quantities to compare

For every requested time, record:

```text
time_us
requested_time_us
t_over_tphi
simulated_rho00
analytic_rho00
absolute_error_rho00
simulated_rho11
analytic_rho11
absolute_error_rho11
simulated_rho01_real
simulated_rho01_imag
simulated_rho01_abs
analytic_rho01_real
analytic_rho01_abs
absolute_error_rho01
simulated_rho10_real
simulated_rho10_imag
simulated_rho10_abs
absolute_error_rho10
bloch_x
bloch_y
bloch_z
analytic_bloch_x
trace_error
hermiticity_error
minimum_eigenvalue
purity
```

For this setup, the analytic expectations are:

```text
rho00(t) = 0.5
rho11(t) = 0.5
rho01(t) = 0.5 * exp(-gamma_phi * t)
rho10(t) = 0.5 * exp(-gamma_phi * t)
Bloch x(t) = exp(-gamma_phi * t)
Bloch y(t) = 0
Bloch z(t) = 0
purity(t) = 0.5 * (1 + exp(-2 gamma_phi * t))
```

## Required assertions

### 1. Collapse-operator audit

Assert that the production helper generates exactly one operator and that it equals

```text
sqrt(gamma_phi_per_us / 2) * SIGMA_Z
```

within repository-standard matrix comparison tolerance.

Also assert that no `SIGMA_MINUS` or `SIGMA_PLUS` population operator is present.

### 2. Population invariance

For every snapshot:

```text
abs(rho00 - 0.5) <= tolerance
abs(rho11 - 0.5) <= tolerance
```

The population difference must remain zero within tolerance.

### 3. Off-diagonal exponential decay

Compare the numerical result against

```text
0.5 * exp(-gamma_phi_per_us * time_us)
```

for both `rho01` and `rho10`.

Record:

```text
max_abs_error_rho01
rmse_rho01
max_abs_error_rho10
```

### 4. Phase preservation

Because the initial coherence is positive and real and `H=0`, verify:

```text
abs(Im rho01) <= tolerance
abs(Im rho10) <= tolerance
Re rho01 >= -tolerance
Re rho10 >= -tolerance
```

Pure dephasing should reduce coherence magnitude without rotating its phase in this fixture.

### 5. Fitted dephasing rate

Fit

```text
log(2 * abs(rho01(t))) = -gamma_fit * t
```

using all points with coherence above a safe floor.

Record:

```text
fitted_gamma_phi_per_us
relative_gamma_fit_error
```

The fitted rate must agree with the input rate.

### 6. Bloch-vector behavior

Verify:

```text
x(t) = exp(-gamma_phi t)
y(t) = 0
z(t) = 0
```

This creates a physically intuitive check that the Bloch vector contracts along the equatorial x-axis without population motion.

### 7. Density-matrix physicality

For every snapshot verify:

```text
trace approximately 1
Hermiticity preserved
minimum eigenvalue >= negative numerical tolerance
all values finite
purity between 1/2 and 1
```

Purity should decrease monotonically from 1 toward 1/2.

### 8. Time-step refinement

For at least one representative case, run the production internal-step policy and a refined policy with at least half the step size.

Record:

```text
normal_internal_step_us
refined_internal_step_us
max_density_element_difference
max_coherence_difference
```

This is a local stability audit only. Do not claim it replaces the later full convergence validation.

### 9. Alternative-coefficient diagnostic

Do not alter production code for this check.
In the validation script only, calculate the wrong-convention analytic curve corresponding to

```text
L = sqrt(gamma_phi) * sigma_z
rho01(t) = 0.5 exp(-2 gamma_phi t)
```

Record a diagnostic error against this alternative curve for one representative case.
The production result should match `exp(-gamma_phi t)` and clearly fail to match `exp(-2 gamma_phi t)` except at `t=0`.

This diagnostic is important because it directly distinguishes the two disputed conventions.

## Suggested tolerances

Use tolerances consistent with the current RK4 behavior and prior validations, initially:

```text
max_abs_error_coherence <= 1e-6
rmse_coherence <= 1e-7
max_population_drift <= 1e-10
max_trace_error <= 1e-10
max_hermiticity_error <= 1e-10
minimum_eigenvalue >= -1e-10
max_imaginary_coherence <= 1e-10
max_relative_gamma_fit_error <= 1e-4
max_step_refinement_difference <= 1e-8
```

If existing numerical behavior requires a different tolerance, report the observed values and justify the threshold. Do not loosen tolerances merely to make failures pass.

## JSON report requirements

The JSON artifact must contain at least:

```json
{
  "validation": "VALIDATION-4",
  "model": "one-qubit pure dephasing",
  "initial_state": "|+>",
  "hamiltonian": "zero",
  "gamma_down_per_us": 0.0,
  "gamma_up_per_us": 0.0,
  "collapse_operator_convention": "sqrt(gamma_phi_per_us / 2) * sigma_z",
  "analytic_solution": "rho01(t)=rho01(0)*exp(-gamma_phi_per_us*t)",
  "alternative_convention": "sqrt(gamma_phi_per_us)*sigma_z gives exp(-2*gamma_phi_per_us*t)",
  "tolerances": {},
  "collapse_operator_audit": {},
  "internal_step_audit": {},
  "alternative_convention_diagnostic": {},
  "cases": [],
  "overall_pass": true,
  "scope": {},
  "git_commit": "..."
}
```

## CSV requirements

Write one row per snapshot and include the case name and rate fields.
Use stable column ordering.

## Plot requirements

Generate two actual-calculation figures.

### Main plot

Plot versus `t / T_phi`:

```text
2 * abs(rho01(t)) numerical
exp(-t / T_phi) analytic
rho00(t)
rho11(t)
```

The coherence curves for all three rates should collapse onto the same normalized exponential curve.
The populations should remain at 0.5.

Title must explicitly state:

```text
Actual calculation result / 実際の計算結果: pure dephasing
```

### Error plot

Plot absolute coherence error versus `t / T_phi` for all rate cases.

Title must explicitly state:

```text
Actual calculation result / 実際の計算結果: pure-dephasing numerical error
```

Do not label these plots as conceptual diagrams.

## Markdown report requirements

The report must include:

1. Purpose
2. Adopted convention
3. Short analytic derivation
4. Test conditions
5. Results table
6. Population-invariance result
7. Coherence-decay result
8. Fitted-rate result
9. Alternative-convention diagnostic
10. Density-matrix physicality
11. Time-step refinement
12. Scope and limitations
13. Files and commands
14. Scope audit

Use the following conclusion only if all required tests pass:

> For a one-qubit initial |+> state with zero Hamiltonian and no population transitions, the numerical evolution preserves both populations and reproduces rho_01(t)=rho_01(0) exp(-gamma_phi t). This confirms that the production collapse operator convention L_phi=sqrt(gamma_phi/2) sigma_z makes gamma_phi the direct decay rate of the off-diagonal density-matrix elements.

## Scope and non-claims

This validation may establish:

```text
production pure-dephasing collapse operator coefficient
sigma_z orientation and embedding
coherence decay rate convention
population invariance under pure dephasing
Lindblad solver behavior for pure dephasing
snapshot timing for the tested path
```

It does not establish:

```text
flux-noise-to-gamma_phi calibration
hardware-specific T_phi accuracy
finite-temperature equilibrium
combined T1 and T_phi behavior
QuTiP agreement
non-Markovian dephasing
pulse-level noise spectra
```

## Regression requirements

After implementation, run at least:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_pure_dephasing
.\.venv\Scripts\python.exe scripts\validate_pure_dephasing.py
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_dissipation_unitary_limit
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_temperature_thermal_excitation
.\.venv\Scripts\python.exe -m unittest tests.test_validation_excited_state_exponential_decay
npm.cmd run build
```

Also run the repository's relevant regression suite and `git diff --check`.

## Completion report

At the end, report:

```text
files added or changed
production code changed or unchanged
exact collapse operator found
all rate cases and observed errors
fitted-rate errors
alternative-convention mismatch
step-refinement result
focused-test count
regression-test count
frontend build result
git diff --check result
```

If the production convention does not match the expected analytic behavior, do not conceal it. Return the failing numerical evidence and the smallest physically justified remediation proposal.
