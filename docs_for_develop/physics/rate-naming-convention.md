# Rate Naming Convention

This project uses rates in `1/us` and time constants in `us`.

## Canonical names

For the energy-relaxation channel at finite temperature:

```text
gamma0_per_us = 1 / t1_zero_temperature_us
gamma_down_per_us = gamma0_per_us * (n_th + 1)
gamma_up_per_us = gamma0_per_us * n_th
gamma_population_relaxation_per_us = gamma_down_per_us + gamma_up_per_us
t1_effective_us = 1 / gamma_population_relaxation_per_us
```

`gamma_down_per_us` is the downward transition rate. `gamma_up_per_us` is
the thermally induced upward transition rate. At finite temperature, the
population relaxation rate is their sum, and this sum determines the
effective `T1`.

For pure dephasing:

```text
gamma_phi_per_us = gamma_phi_base_per_us + gamma_phi_flux_per_us
tphi_effective_us = 1 / gamma_phi_per_us
```

The Lindblad operator convention is
`L_phi = sqrt(gamma_phi_per_us / 2) * sigma_z`, so the off-diagonal density
matrix elements decay at `gamma_phi_per_us`.

## Compatibility names

The following names remain in derived result metadata for older consumers:

- `gamma1_per_us`: deprecated alias for `gamma_down_per_us`; it is not the
  finite-temperature population relaxation rate.
- `gammaphi_per_us`: deprecated spelling alias for `gamma_phi_per_us`.
- `t1_base_us`: deprecated alias for `t1_zero_temperature_us`.
- `tphi_base_us`: deprecated alias for the zero-temperature/profile baseline.
- `gamma_phi_total_per_us`, `t1_us`, and `t2_us`: compatibility aliases for
  the corresponding canonical values.

New code, diagnostics, and documentation should use the canonical names.
Legacy names should only appear in compatibility mappings or migration tests.
