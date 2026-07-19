# Rate Variable Naming Migration

## Purpose

This note records the canonical names used for environmental dissipation rates.
It prevents the historical `gamma1` label from being interpreted as the finite-temperature population-relaxation rate.

## Canonical Definitions

All rates use `1/us`; all times use `us`.

| Canonical name | Definition | Physical meaning |
| --- | --- | --- |
| `gamma0_per_us` | `1 / t1_base_us` | Zero-temperature base rate |
| `gamma_down_per_us` | `gamma0_per_us * (n_th + 1)` | Downward transition rate |
| `gamma_up_per_us` | `gamma0_per_us * n_th` | Thermal upward transition rate |
| `gamma_population_relaxation_per_us` | `gamma_down_per_us + gamma_up_per_us` | Population relaxation rate |
| `gamma_phi_per_us` | Model-derived pure-dephasing rate | Pure dephasing rate |
| `t1_effective_us` | `1 / gamma_population_relaxation_per_us` | Finite-temperature effective T1 |

The physical collapse operators use the individual rates:

- `sqrt(gamma_down_per_us) * sigma_minus`
- `sqrt(gamma_up_per_us) * sigma_plus`
- `sqrt(gamma_phi_per_us / 2) * sigma_z`

The total population relaxation rate is not used as a collapse-operator coefficient.

## Compatibility

`gamma1_per_us` remains a read-only compatibility alias for `gamma_down_per_us` in saved derived data and API responses. It never means `gamma_population_relaxation_per_us`. New model, UI, and calculation code must use canonical names.

## API and UI Contract

The React response has a `rates` object containing the canonical rate and time fields. It also retains `gamma1_per_us` plus `gamma1_per_us_deprecation` for older consumers. The Diagnostics drawer displays only canonical fields: downward rate, upward rate, population relaxation rate, pure-dephasing rate, base T1, and effective T1.

## Implementation Audit

| Area | Status | Notes |
| --- | --- | --- |
| `core/physical_environment.py` | Canonical | Computes base, downward, upward, population, and dephasing rates. |
| `core/gates.py` | Canonical | Physical collapse operators take individual `*_per_us` rates. |
| `core/expert_data.py` | Compatibility retained | Reads old saved `gamma1_per_us` only when reconstructing legacy results. |
| `core/ui_response.py` | Canonical plus compatibility | Serializes canonical values and the deprecated alias. |
| `frontend/src/components/DiagnosticsCard.tsx` | Canonical | Does not display the legacy alias. |
| Tests and historical documents | Intentional references | Preserve alias compatibility evidence or historical context. |

## Validation Coverage

- V1: zero dissipation reproduces the ideal gate trajectory.
- V2: zero temperature removes thermal upward excitation.
- V3: an excited state decays exponentially with the configured downward rate.
- `tests/test_rate_variable_naming_refactor.py` checks canonical definitions and compatibility aliases.
- API/UI adapter tests check the serialized rate contract.

## Residual `gamma1` References

Residual references are limited to the compatibility property, derived-data/API alias, legacy result reconstruction, regression tests, and historical or migration documentation. They are not used by the active physical collapse-operator path.
