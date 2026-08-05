# VALIDATION-2: Zero-Temperature Thermal Excitation

## Purpose

This validation checks the physical-parameter conversion layer at zero
temperature and compares it with the independent Bose-Einstein formula. It
does not validate the full temperature/noise model or change the production
physics.

The expected convention is

```text
n_th = 1 / (exp(h*f_q/(k_B*T)) - 1)
gamma_up   = gamma0_per_us * n_th
gamma_down = gamma0_per_us * (n_th + 1)
```

At exactly `T=0`, the implementation takes an explicit branch and returns
`n_th=0.0`; it does not divide by zero.

## Implementation Audit

| Quantity | Code field | Definition found | Unit | Source | Status |
|---|---|---|---|---|---|
| Temperature | `temperature_mk` | `temperature_mk * 1e-3` | mK input, K internal | `compute_thermal_occupation` | Consistent |
| Qubit frequency | `qubit_frequency_ghz` | `qubit_frequency_ghz * 1e9` | GHz input, Hz internal | `compute_thermal_occupation` | Consistent |
| Thermal occupation | `n_th` | Bose-Einstein occupation using `h*f` | dimensionless | `compute_thermal_occupation` | Consistent |
| Base transition rate | `gamma0_per_us` | `1 / t1_zero_temperature_us` | 1/us | `_compute_rates_from_physical_inputs` | Consistent |
| Upward rate | `gamma_up_per_us` | `gamma0_per_us * n_th` | 1/us | `_compute_rates_from_physical_inputs` | Consistent |
| Downward rate | `gamma_down_per_us` | `gamma0_per_us * (n_th + 1)` | 1/us | `_compute_rates_from_physical_inputs` | Consistent |
| Population relaxation rate | `gamma_population_relaxation_per_us` | `gamma_down + gamma_up` | 1/us | `_compute_rates_from_physical_inputs` | Consistent |
| Effective T1 | `t1_effective_us` | `1 / gamma_population_relaxation_per_us` | us | `_compute_rates_from_physical_inputs` | Consistent |
| Legacy alias | `gamma1_per_us` | aliases `gamma_down_per_us` | 1/us | `environment_rates_to_derived_parameters` | Deprecated |

The code uses ordinary frequency `f_q`, not angular frequency `omega_q`, in
the thermal formula. This is equivalent to the angular-frequency form only if
`h*f_q` is replaced consistently by `hbar*omega_q`.

## Zero Temperature

Representative inputs:

- `device_quality=1.0`
- `t1_max_us=100.0`
- `temperature_mk=0.0`
- `flux_noise_phi0=0.0`
- `qubit_frequency_ghz=5.0`

The resulting base decay rate is:

```text
gamma0_per_us = 1 / t1_zero_temperature_us = 0.01 /us
```

The exact zero-temperature result is:

```text
n_th              = 0.0
gamma_up_per_us   = 0.0
gamma_down_per_us = 0.01
gamma_population_relaxation_per_us = 0.01
t1_effective_us   = 100.0
```

The same exact result was obtained at `1 GHz`, `5 GHz`, and `10 GHz`.

## Test Matrix

| Case | Coverage | Result |
|---|---|---|
| V2-1 | Exact `T=0`, finite base decay | PASS |
| V2-2 | `T=0` at 1/5/10 GHz | PASS |
| V2-3 | `1e-9`, `1e-6`, `0.001 mK` | PASS |
| V2-4 | Temperature monotonicity | PASS |
| V2-5 | Frequency monotonicity | PASS |
| V2-6 | Detailed balance at four positive-temperature points | PASS |
| V2-7 | Actual collapse-operator construction | PASS |
| V2-8 | Physical `T=0` versus `ideal_reference=True` | PASS |
| Robustness | Large exponent and deterministic repeated evaluation | PASS |
| T1 audit | `1/(gamma_down + gamma_up)` at finite temperature | PASS |

## Numerical Results

At low positive temperatures, the values were finite and nonnegative. For the
three requested low-temperature cases, the current safe exponent branch
returned `n_th=0.0` because the exponent exceeded the overflow-safe threshold;
this is numerically appropriate at this scale.

Representative positive-temperature values at `5 GHz`:

| Temperature | `n_th` | `gamma_up_per_us` | `gamma_down_per_us` |
|---:|---:|---:|---:|
| `0 mK` | `0.0` | `0.0` | `1.000000e-2` |
| `1 mK` | `6.106056e-105` | `6.106056e-107` | `1.000000e-2` |
| `10 mK` | `3.789449e-11` | `3.789449e-13` | `1.000000e-2` |
| `100 mK` | `9.981031e-2` | `9.981031e-4` | `1.099810e-2` |
| `1000 mK` | `3.687302` | `3.687302e-2` | `4.687302e-2` |

The maximum absolute detailed-balance error was:

```text
5.55e-17
```

This is below the configured absolute tolerance `1e-12` and relative
tolerance `1e-10`.

## Collapse Operators

At physical `T=0` with nonzero base decay:

- `gamma_down_per_us > 0`
- `gamma_up_per_us == 0`
- the generated one-qubit operator list contains the nonzero downward
  relaxation operator
- no upward thermal excitation operator is generated
- the remaining operator is pure dephasing from the device profile

This checks the actual construction path, not only the scalar rate fields.

## Ideal Reference Is Separate

These two configurations are intentionally different:

| Configuration | `gamma_down` | `gamma_up` | Interpretation |
|---|---:|---:|---|
| Physical `T=0`, `ideal_reference=False` | `0.01 /us` | `0.0 /us` | Spontaneous downward relaxation remains |
| `ideal_reference=True` | `0.0 /us` | `0.0 /us` | Explicit ideal-mode policy disables all dissipation |

Therefore, `T=0` does not mean a completely noiseless simulation. It removes
thermal excitation but retains spontaneous decay and profile dephasing unless
the separate ideal-reference policy is enabled.

## Numerical Safety

The implementation has these relevant branches:

- `temperature_k <= 0` returns `0.0` before evaluating the Bose expression.
- exponent values above `700` return `0.0` to avoid `exp()` overflow.
- `math.expm1()` is used for moderate positive exponents.

The tests checked finite/nonnegative occupation and rates, no exceptions for
very large exponents, and deterministic repeated results.

## Scope and Limitations

The result supports the current conversion convention and zero-temperature
limit. It does not establish that the generic device profile is calibrated to
any particular hardware, nor does it validate all finite-temperature dynamics.

The field `gamma1_per_us` remains only as a compatibility alias for the
downward rate. At finite temperature, use `gamma_down_per_us` and
`gamma_up_per_us` explicitly; use `gamma_population_relaxation_per_us` and
`t1_effective_us` for total population relaxation.

## Files and Commands

Added:

- `tests/test_validation_zero_temperature_thermal_excitation.py`
- `scripts/validate_zero_temperature_thermal_excitation.py`
- `docs/validation/validation-2-zero-temperature-thermal-excitation.md`
- `validation_results/validation2_zero_temperature.json`
- `validation_results/validation2_zero_temperature.csv`

Commands:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_validation_zero_temperature_thermal_excitation
.\.venv\Scripts\python.exe scripts\validate_zero_temperature_thermal_excitation.py
```

Observed:

- Focused validation tests: `10 tests OK`
- Validation script: all rows `PASS`

## Scope Audit

- Core physical equations: unchanged
- Lindblad equation: unchanged
- Hamiltonian construction: unchanged
- Gate semantics and basis order: unchanged
- API request/response shape: unchanged
- Frontend UI: unchanged
- Rust backend: unchanged
- NumPy dense engine: unchanged
- Default physical-parameter policy: unchanged
