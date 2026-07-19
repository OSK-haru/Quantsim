# VALIDATION-2: Zero-temperature thermal excitation limit

Use GPT-5.5 Thinking.

## Objective

Validate that the current QuantaScope physical-parameter conversion layer satisfies the zero-temperature thermal limit:

\[
T = 0 \quad \Longrightarrow \quad n_{\mathrm{th}} = 0
\]

and therefore

\[
\gamma_{\uparrow}=0,
\qquad
\gamma_{\downarrow}=\gamma_0.
\]

This task is a **validation task**, not a physics redesign task.

Do not change the physical model merely to make tests pass. If the current implementation disagrees with the expected limit, record the disagreement quantitatively and report the suspected source.

---

## Scope

Inspect and validate the conversion path from physical inputs to thermal occupation and transition rates.

Expected conceptual path:

```text
Temperature T
Qubit frequency f_q
Base zero-temperature decay rate gamma_0
        ↓
Bose-Einstein thermal occupation n_th
        ↓
gamma_up   = gamma_0 * n_th
gamma_down = gamma_0 * (n_th + 1)
```

Primary target files are likely to include:

- `core/physical_environment.py`
- `core/results.py`
- `core/gates.py`
- existing physical-environment tests
- validation helper modules

Do not assume these paths are exact. Inspect the repository first.

---

## Required physical convention

Use the ordinary frequency form

\[
n_{\mathrm{th}}
=
\frac{1}{\exp\!\left(\frac{h f_q}{k_B T}\right)-1}.
\]

If the code uses angular frequency \(\omega_q\), the equivalent form is

\[
n_{\mathrm{th}}
=
\frac{1}{\exp\!\left(\frac{\hbar \omega_q}{k_B T}\right)-1}.
\]

These must not be mixed. Explicitly document which convention the code uses.

Required rate convention:

\[
\gamma_{\uparrow}=\gamma_0 n_{\mathrm{th}},
\qquad
\gamma_{\downarrow}=\gamma_0(n_{\mathrm{th}}+1).
\]

At exactly zero temperature:

\[
n_{\mathrm{th}}=0,
\quad
\gamma_{\uparrow}=0,
\quad
\gamma_{\downarrow}=\gamma_0.
\]

Do not evaluate the Bose-Einstein expression by dividing by zero. The implementation should use an explicit physical branch for \(T=0\).

---

## Validation questions

Answer all of the following.

1. Does `temperature_mk = 0` produce exactly `n_th = 0.0`?
2. Does it produce exactly `gamma_up_per_us = 0.0`?
3. Does the downward rate remain finite and equal to the zero-temperature base decay rate?
4. Is the zero-temperature branch numerically safe, with no NaN, infinity, overflow, warning, or exception?
5. Is the result independent of qubit frequency at exactly `T = 0`?
6. For very small positive temperatures, does `n_th` remain nonnegative, finite, and approach zero continuously?
7. For fixed positive temperature, does increasing qubit frequency reduce `n_th`?
8. For fixed qubit frequency, does increasing temperature increase `n_th`?
9. Does the detailed-balance identity hold for positive temperature?

\[
\frac{\gamma_{\uparrow}}{\gamma_{\downarrow}}
=
\frac{n_{\mathrm{th}}}{n_{\mathrm{th}}+1}
=
\exp\!\left(-\frac{h f_q}{k_B T}\right).
\]

10. Are the documented units consistent from UI input through the internal rate calculation?

---

## Required audit before writing tests

Record the current implementation exactly as found.

Create an audit table with at least these rows:

| Quantity | Current symbol/code field | Definition found in code | Unit | Source file/function | Expected convention | Status |
|---|---|---|---|---|---|---|
| Temperature | | | mK input, K internal | | | |
| Qubit frequency | | | GHz input, Hz internal | | | |
| Thermal occupation | | | dimensionless | | | |
| Base decay rate | | | 1/us | | | |
| Upward rate | | | 1/us | | | |
| Downward rate | | | 1/us | | | |
| Effective T1 if present | | | us | | | |

Explicitly determine whether the code treats `T1` as:

\[
T_1 = \frac{1}{\gamma_{\downarrow}}
\]

or

\[
T_1 = \frac{1}{\gamma_{\downarrow}+\gamma_{\uparrow}}.
\]

Do not silently rename or reinterpret fields in this task. Report any ambiguous naming, especially fields such as `gamma1_per_us`.

---

## Required test cases

Implement automated tests covering at least the following.

### V2-1: Exact zero temperature

Use representative physical inputs such as:

```text
temperature_mk = 0.0
qubit_frequency_ghz = 5.0
finite nonzero base decay rate
```

Expected:

```text
n_th == 0.0
gamma_up_per_us == 0.0
gamma_down_per_us == gamma_0
all values finite
```

Use exact equality for the expected zero values if the implementation has an explicit zero-temperature branch.

### V2-2: Zero temperature across frequencies

Test at least:

```text
1 GHz
5 GHz
10 GHz
```

Expected for all:

```text
n_th == 0.0
gamma_up_per_us == 0.0
```

### V2-3: Very low positive temperature

Test representative values such as:

```text
1e-9 mK
1e-6 mK
0.001 mK
```

Expected:

- finite values
- no exceptions
- `n_th >= 0`
- `gamma_up >= 0`
- values approach zero

Do not require exact equality to zero for positive temperature.

### V2-4: Monotonicity in temperature

At fixed frequency, test an ordered sequence such as:

```text
0 mK
1 mK
10 mK
20 mK
100 mK
1000 mK
```

Expected:

```text
n_th is nondecreasing
gamma_up is nondecreasing
gamma_down is nondecreasing
```

### V2-5: Monotonicity in frequency

At fixed positive temperature, test frequencies such as:

```text
1 GHz
3 GHz
5 GHz
10 GHz
```

Expected:

```text
n_th is nonincreasing
gamma_up is nonincreasing
```

### V2-6: Detailed balance

At several positive `(T, f_q)` pairs, compare

\[
\gamma_{\uparrow}/\gamma_{\downarrow}
\]

with

\[
\exp[-h f_q/(k_B T)].
\]

Use a strict but realistic numerical tolerance, for example:

```text
abs <= 1e-12
rel <= 1e-10
```

Adjust only if the current code's floating-point pathway justifies it, and document the reason.

### V2-7: Collapse-operator consequence

For one qubit at `T = 0`, confirm that the generated environment collapse operators contain:

- a nonzero downward relaxation operator when `gamma_0 > 0`
- no upward thermal excitation operator

Do not rely only on rate fields. Check the actual collapse-operator construction path.

### V2-8: Ideal-reference separation

Confirm that:

```text
ideal_reference = True
```

forces all dissipative rates to zero as a separate ideal-mode policy, while

```text
temperature = 0
ideal_reference = False
```

still retains spontaneous downward relaxation if the base decay rate is nonzero.

These are physically different cases and must not be conflated.

---

## Numerical robustness requirements

The implementation and tests must explicitly check:

- no division by zero at `T = 0`
- no `NaN`
- no positive or negative infinity
- no negative thermal occupation
- no negative transition rates
- no overflow exception for very large exponent arguments
- deterministic repeated results

If the current implementation uses a safe exponential clamp or asymptotic branch, document it.

Do not introduce a clamp that changes moderate-temperature physics merely to satisfy the test.

---

## Validation script

Create:

```text
scripts/validate_zero_temperature_thermal_excitation.py
```

The script must:

1. run all representative cases
2. print a compact human-readable table
3. write JSON and CSV artifacts
4. return exit code `0` only when every required condition passes

Suggested output files:

```text
validation_results/validation2_zero_temperature.json
validation_results/validation2_zero_temperature.csv
```

Suggested table columns:

```text
case
temperature_mk
frequency_ghz
n_th
gamma_0_per_us
gamma_up_per_us
gamma_down_per_us
detailed_balance_error
finite
result
```

The JSON report should include:

- validation name and description
- Git commit if available
- formula convention
- unit convention
- exact implementation functions inspected
- tolerances
- all cases
- overall pass/fail
- any ambiguity or mismatch found

---

## Automated test file

Create a focused test module such as:

```text
tests/test_validation_zero_temperature_thermal_excitation.py
```

Keep it independent from UI tests.

Use the public or stable internal physical-environment conversion path that production simulation uses. Do not duplicate the full QuantaScope conversion algorithm inside the test.

For analytic comparisons such as Bose-Einstein occupation and detailed balance, compute the expected value independently in the test using physical constants and clearly documented unit conversion.

This is important:

- production code computes the QuantaScope value
- the test independently computes the analytic reference

Do not compare a function to itself.

---

## Documentation

Create:

```text
docs/validation/validation-2-zero-temperature-thermal-excitation.md
```

Include:

1. purpose
2. implementation audit
3. formula and units
4. test matrix
5. numerical tolerances
6. results table
7. edge-case behavior
8. distinction between `T = 0` and `ideal_reference`
9. interpretation
10. limitations
11. files and commands
12. scope audit

The final interpretation should use careful wording such as:

> Under the current physical-parameter convention, the zero-temperature branch produces zero thermal excitation while retaining the spontaneous downward transition associated with the base decay rate.

Do not claim that this alone validates the full temperature/noise model.

---

## Expected commands

Use the repository's active virtual environment. Typical commands:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_temperature_thermal_excitation
.\.venv\Scripts\python.exe scripts\validate_zero_temperature_thermal_excitation.py
```

Also run the relevant existing regression subset for physical-environment and validation behavior.

Do not run an unnecessarily enormous test suite if the existing dense-backend regression is known to take several minutes, unless needed to verify that this task changed production code.

---

## Change restrictions

Do not change any of the following unless an actual implementation defect prevents the documented zero-temperature limit and the change is explicitly reported:

- Lindblad equation
- Hamiltonian construction
- gate semantics
- basis order
- snapshot policy
- API request/response shape
- frontend UI
- Rust backend
- NumPy dense engine
- default physical-parameter policy

If production code must be changed:

1. explain the defect before changing it
2. make the smallest possible correction
3. add a regression test proving the correction
4. report before/after values
5. do not alter unrelated conventions

---

## Acceptance criteria

The task is complete when all of the following are true:

- exact `T = 0` yields `n_th = 0`
- exact `T = 0` yields `gamma_up = 0`
- spontaneous downward rate remains according to the current base-rate convention
- zero-temperature collapse operators contain no excitation operator
- low-positive-temperature behavior is finite and approaches zero
- temperature and frequency monotonicity pass
- detailed balance passes at positive temperature
- `ideal_reference` and physical `T = 0` are verified as distinct cases
- units and formulas are documented
- automated tests pass
- validation script passes
- JSON and CSV artifacts are generated
- no unrelated physics or API behavior changes

---

## Final report format

When finished, report:

1. changed files
2. current code convention discovered
3. exact zero-temperature results
4. monotonicity results
5. detailed-balance maximum error
6. collapse-operator check
7. ideal-reference distinction
8. test commands and counts
9. any production-code fix made
10. remaining ambiguity, especially the meaning of `T1` and `gamma1_per_us`
