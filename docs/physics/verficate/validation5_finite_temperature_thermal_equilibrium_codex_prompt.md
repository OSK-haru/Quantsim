# VALIDATION-5: Finite-Temperature Thermal Equilibrium

## Codex implementation instruction

Implement the next physics-validation package for QuantaScope.

This task must validate that a one-qubit Lindblad model with both downward and upward thermal transitions approaches the correct finite-temperature equilibrium state, independently of the initial population.

Do not change the production physics equations merely to make the validation pass. First measure and report any discrepancy. Production physics, API behavior, frontend behavior, and default solver policy must remain unchanged unless an actual defect is demonstrated and documented separately.

---

## 1. Validation objective

For one qubit with

```text
H = 0
gamma_phi_per_us = 0
gamma_down_per_us > 0
gamma_up_per_us >= 0
```

and collapse operators

```text
L_down = sqrt(gamma_down_per_us) * sigma_minus
L_up   = sqrt(gamma_up_per_us)   * sigma_plus
```

validate the population equation

```text
dP1/dt = -gamma_down * P1 + gamma_up * (1 - P1)
```

or equivalently

```text
dP1/dt = -(gamma_down + gamma_up) * P1 + gamma_up
```

The analytic solution is

```text
P1(t) = P1_eq + (P1(0) - P1_eq)
        * exp(-(gamma_down + gamma_up) * t)
```

where

```text
P1_eq = gamma_up / (gamma_down + gamma_up)
P0_eq = gamma_down / (gamma_down + gamma_up)

gamma_population_relaxation_per_us
  = gamma_down_per_us + gamma_up_per_us

t1_effective_us
  = 1 / gamma_population_relaxation_per_us
```

For the bosonic thermal-bath convention already used by QuantaScope,

```text
gamma_down = gamma0 * (n_th + 1)
gamma_up   = gamma0 * n_th
```

so

```text
P1_eq = n_th / (2 * n_th + 1)
```

and, using detailed balance,

```text
P1_eq / P0_eq = exp(-h * f_q / (k_B * T))
```

This is the thermal Gibbs population for a two-level system whose energy gap is `h * f_q`.

---

## 2. Scope separation

This validation must be split into two layers.

### Layer A: direct-rate solver validation

Provide known values of

```text
gamma_down_per_us
gamma_up_per_us
```

directly to the production collapse-operator and Lindblad-evolution path.

This layer validates:

- simultaneous upward and downward transitions
- equilibrium population
- total population-relaxation rate
- independence from initial population
- analytic transient behavior
- long-time limit
- density-matrix physicality

### Layer B: physical-input end-to-end validation

Use the production physical-environment conversion path with explicit

```text
temperature_mk
qubit_frequency_ghz
t1_max_us
device_quality
flux_noise_phi0 = 0
```

Then obtain the canonical derived rates and validate that the simulated equilibrium agrees with both:

1. `gamma_up / (gamma_down + gamma_up)`
2. the Gibbs/Boltzmann ratio obtained independently from `h*f/(k_B*T)`

Do not independently reimplement QuantaScope's complete environment model for the primary comparison. Only the Bose/Gibbs analytic reference may be independently calculated.

---

## 3. Required direct-rate cases

Use at least these three cases.

### V5-1: moderate finite temperature analogue

```text
gamma_down_per_us = 0.012
gamma_up_per_us   = 0.002
```

Expected:

```text
P1_eq = 1 / 7
gamma_population_relaxation_per_us = 0.014
T1_eff = 71.4285714286 us
```

### V5-2: stronger thermal excitation

```text
gamma_down_per_us = 0.020
gamma_up_per_us   = 0.010
```

Expected:

```text
P1_eq = 1 / 3
gamma_population_relaxation_per_us = 0.030
T1_eff = 33.3333333333 us
```

### V5-3: near-symmetric high-temperature analogue

```text
gamma_down_per_us = 0.051
gamma_up_per_us   = 0.049
```

Expected:

```text
P1_eq = 0.49
gamma_population_relaxation_per_us = 0.100
T1_eff = 10 us
```

For each case, run at least these initial states:

```text
|0><0|
|1><1|
I/2
```

Optional but recommended:

```text
|+><+|
```

The `|+>` case should show population convergence to the same equilibrium while the off-diagonal element also decays according to the combined transition-induced decoherence rate.

---

## 4. Required physical-input cases

Use at least the following positive-temperature cases through the production environment conversion path.

```text
Case P5-1:
  temperature_mk = 50
  qubit_frequency_ghz = 5
  device_quality = 1.0
  t1_max_us = 100
  flux_noise_phi0 = 0

Case P5-2:
  temperature_mk = 100
  qubit_frequency_ghz = 5
  device_quality = 1.0
  t1_max_us = 100
  flux_noise_phi0 = 0

Case P5-3:
  temperature_mk = 200
  qubit_frequency_ghz = 5
  device_quality = 1.0
  t1_max_us = 100
  flux_noise_phi0 = 0
```

If the device profile still creates nonzero pure dephasing even when `flux_noise_phi0=0`, this does not alter the population equilibrium. Record the actual `gamma_phi_per_us`, but keep the population validation separate.

Do not use `ideal_reference=True`.

---

## 5. Simulation conditions

For all cases:

```text
logical_qubits = 1
H = 0
gate list = empty
idle evolution only
```

Use exact requested snapshot times without interpolation whenever the current snapshot scheduler supports exact boundary capture.

For each rate case, sample at normalized times such as

```text
t / T1_eff =
0,
0.25,
0.5,
1,
2,
3,
5,
8,
10
```

The final time must be long enough that

```text
exp(-10) < 5e-5
```

so the simulated state is visibly close to equilibrium.

Do not infer convergence from only the final point. Compare the full transient curve to the analytic solution.

---

## 6. Required numerical comparisons

For every case and snapshot, calculate and store:

```text
time_us
requested_time_us
t_over_t1_effective
initial_state
simulated_p0
simulated_p1
analytic_p0
analytic_p1
absolute_error_p0
absolute_error_p1
relative_error_p1 where meaningful
rho01_abs
rho10_abs
trace_error
hermiticity_error
minimum_eigenvalue
purity
```

For each case and initial state, summarize:

```text
max_abs_error_p1
rmse_p1
max_abs_error_p0
final_equilibrium_error_p1
max_trace_error
max_hermiticity_error
minimum_density_eigenvalue
```

Fit the numerical population trajectory to

```text
P1(t) = A + B * exp(-lambda * t)
```

or use an equivalent linearized/nonlinear fit that does not assume the exact configured value.

Report:

```text
fitted_equilibrium_p1
fitted_population_relaxation_rate_per_us
relative_equilibrium_fit_error
relative_rate_fit_error
```

The fitted rate must be compared to

```text
gamma_down_per_us + gamma_up_per_us
```

not to either individual transition rate.

---

## 7. Initial-state independence test

For each rate pair, verify that all initial states approach the same equilibrium.

At the final snapshot, compute

```text
max_pairwise_final_p1_difference
```

across `|0>`, `|1>`, and `I/2`.

This must be below the selected equilibrium tolerance.

Also verify monotonic direction where applicable:

- from `|1>`, `P1(t)` should decrease toward `P1_eq`
- from `|0>`, `P1(t)` should increase toward `P1_eq`
- from `I/2`, `P1(t)` should move toward `P1_eq` unless already equal

Do not impose a monotonic test on values already within floating-point tolerance of equilibrium.

---

## 8. Gibbs and detailed-balance audit

For physical-input cases, independently calculate

```text
beta_delta_e = h * frequency_hz / (k_B * temperature_k)
boltzmann_ratio = exp(-beta_delta_e)
analytic_gibbs_p1 = boltzmann_ratio / (1 + boltzmann_ratio)
```

Then verify:

```text
gamma_up / gamma_down ~= boltzmann_ratio
rate_equilibrium_p1 ~= analytic_gibbs_p1
simulated_long_time_p1 ~= analytic_gibbs_p1
```

Store all three equilibrium references separately:

```text
p1_eq_from_rates
p1_eq_from_bose_occupation
p1_eq_from_gibbs_ratio
```

They should agree within numerical tolerance.

Use ordinary frequency `f` with Planck constant `h`. Do not mix this with angular frequency unless converting consistently to `hbar * omega`.

---

## 9. Collapse-operator audit

For each direct-rate case verify that the production path constructs exactly the intended operators:

```text
sqrt(gamma_down_per_us) * sigma_minus
sqrt(gamma_up_per_us)   * sigma_plus
```

and no pure-dephasing operator in the direct-rate cases.

For physical-input cases, record the full operator inventory. If the profile creates dephasing, the validation must explicitly state that it affects coherence but not the thermal population equilibrium.

Also verify that

```text
gamma_population_relaxation_per_us
```

is not used as a collapse-operator coefficient.

---

## 10. Physicality checks

At every sampled time verify:

```text
trace(rho) ~= 1
rho ~= rho_dagger
minimum eigenvalue >= -tolerance
0 <= P0 <= 1
0 <= P1 <= 1
P0 + P1 ~= 1
all matrix values finite
```

For initially diagonal states and zero Hamiltonian, off-diagonal elements must remain zero within tolerance.

For the optional `|+>` case, off-diagonal elements may decay, but must not alter the predicted population trajectory.

---

## 11. Time-step refinement

Perform at least one explicit refinement study for a direct-rate case and one physical-input case.

Recommended internal maximum steps:

```text
0.5 us
0.25 us
0.125 us
```

or equivalent settings supported by the current solver.

Compare the full density matrices at the same physical snapshot times.

Record:

```text
coarse_vs_fine_max_density_element_difference
medium_vs_fine_max_density_element_difference
```

This is still a local refinement audit. Do not label it the full VALIDATION-6 convergence study.

---

## 12. Suggested tolerances

Use tolerances that are strict enough to reveal coefficient or unit mistakes but realistic for the current RK4 solver.

Suggested defaults:

```text
max_abs_error_p1 <= 1e-6
rmse_p1 <= 1e-7
final_equilibrium_error_p1 <= 1e-5
relative_rate_fit_error <= 1e-4
relative_equilibrium_fit_error <= 1e-4
max_pairwise_final_p1_difference <= 1e-5
max_trace_error <= 1e-10
max_hermiticity_error <= 1e-10
minimum_eigenvalue >= -1e-10
max_step_refinement_difference <= 1e-7
```

If a case fails only because the chosen integration step is too coarse, report the failure and refinement behavior before changing any production default.

---

## 13. Required files

Add:

```text
tests/test_validation_finite_temperature_equilibrium.py
scripts/validate_finite_temperature_equilibrium.py
docs/validation/validation-5-finite-temperature-equilibrium.md
validation_results/validation5_finite_temperature_equilibrium.json
validation_results/validation5_finite_temperature_equilibrium.csv
validation_results/validation5_finite_temperature_equilibrium.png
validation_results/validation5_finite_temperature_equilibrium_error.png
```

Optional additional plot:

```text
validation_results/validation5_equilibrium_initial_state_comparison.png
```

---

## 14. Plot requirements

The main result plot must be labeled as an actual numerical result, not a concept diagram.

Title example:

```text
Actual calculation result / 実際の計算結果:
finite-temperature relaxation to equilibrium
```

Plot numerical and analytic curves together.

Recommended axes:

```text
x = t / T1_eff
y = P1(t)
```

Use separate lines or markers for different initial states and thermal conditions. Avoid an unreadable tangle of curves; multiple output figures are acceptable.

The error plot should use either linear or logarithmic y scale as appropriate and clearly label absolute population error.

Do not modify global UI styling or production frontend components for this task.

---

## 15. JSON report structure

The JSON report should contain at least:

```json
{
  "validation": "VALIDATION-5",
  "model": "one-qubit finite-temperature amplitude damping",
  "hamiltonian": "zero",
  "analytic_population_solution": "P1(t)=P1_eq+(P1(0)-P1_eq)exp(-(gamma_down+gamma_up)t)",
  "population_relaxation_convention": "gamma_population_relaxation_per_us = gamma_down_per_us + gamma_up_per_us",
  "direct_rate_cases": [],
  "physical_input_cases": [],
  "collapse_operator_audit": {},
  "initial_state_independence_audit": {},
  "gibbs_detailed_balance_audit": {},
  "time_step_refinement": {},
  "tolerances": {},
  "overall_pass": true,
  "scope": {
    "proves": [],
    "does_not_prove": []
  },
  "git_commit": "..."
}
```

---

## 16. Markdown report requirements

The Markdown report must explain:

1. the population master equation
2. derivation of the analytic solution
3. equilibrium population from rates
4. equivalence to the two-level Gibbs population under detailed balance
5. direct-rate test conditions
6. physical-input test conditions
7. results for every initial state
8. fitted relaxation rate and equilibrium population
9. density-matrix physicality checks
10. time-step refinement result
11. what this validation proves
12. what it does not prove

Include a concise table of all cases and errors.

Explicitly state:

```text
Finite temperature does not drive the qubit to |0>.
It drives the population to the balance point set by gamma_up and gamma_down.
```

Also state that pure dephasing, if present, does not change this population equilibrium.

---

## 17. Tests

Unit tests must cover at least:

- analytic transient from `|1>`
- analytic transient from `|0>`
- equilibrium from `I/2`
- same long-time equilibrium from multiple initial states
- fitted decay rate equals `gamma_down + gamma_up`
- collapse operator orientation and coefficients
- no use of total population rate as a collapse coefficient
- physical-input Gibbs agreement
- detailed-balance ratio
- exact or declared snapshot timing behavior
- trace preservation
- Hermiticity
- positivity
- deterministic repeated evaluation
- time-step refinement

Run the existing VALIDATION-1 through VALIDATION-4 tests after implementing this package.

---

## 18. Commands and acceptance criteria

Run at minimum:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_finite_temperature_equilibrium
.\.venv\Scripts\python.exe scripts\validate_finite_temperature_equilibrium.py
.\.venv\Scripts\python.exe -m unittest \
  tests.test_validation_zero_dissipation_unitary_limit \
  tests.test_validation_zero_temperature_thermal_excitation \
  tests.test_validation_excited_state_exponential_decay \
  tests.test_validation_pure_dephasing

git diff --check
```

Also run the broader regression suite if practical.

The task is complete only when:

- direct-rate cases match the analytic transient
- all tested initial states converge to the same equilibrium
- fitted rate matches `gamma_down + gamma_up`
- physical-input cases agree with Gibbs equilibrium
- density matrices remain physical within tolerance
- the validation script emits CSV, JSON, PNG, and Markdown artifacts
- previous validation tests still pass
- no production physics equation was silently changed

---

## 19. Non-goals

Do not add or change:

- QuTiP comparison
- pulse-level Hamiltonians
- CPTP discrete channels
- non-Markovian baths
- strong-coupling physics
- transmon multilevel dynamics
- hardware calibration claims
- frontend feature work

Those belong to separate later tasks.

---

## 20. Expected scientific conclusion

A successful result should support a statement of this form:

```text
For a one-qubit Lindblad model with upward and downward thermal transitions,
QuantaScope reproduces the analytic finite-temperature population dynamics

P1(t) = P1_eq + [P1(0)-P1_eq]
        exp[-(gamma_down+gamma_up)t],

with

P1_eq = gamma_up / (gamma_down+gamma_up).

The same equilibrium is reached from different initial populations, and the
physical-input path agrees with the two-level Gibbs population implied by
Bose occupation and detailed balance.
```
