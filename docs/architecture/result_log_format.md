# QuantaScope Result Log Format

Simulation result files use `.qscope.result.json`.

## Result JSON

The result envelope contains:

- `schema_version`
- `kind`: `quanta_scope.result`
- `created_at`
- `model_version`
- `input_config`
- `summary`
- `timeseries`
- `output_probabilities`
- `derived_parameters`
- `diagnostics`
- `warnings`

`summary` includes final fidelity, final purity, effective operation time, and
sample counts.

`derived_parameters` includes the unified environment metadata and rates:

- `environment_model`
- `input_mode`
- `n_th`
- `gamma_down_per_us`
- `gamma_up_per_us`
- `gamma_phi_per_us`
- `gamma_phi_base_per_us`
- `gamma_phi_flux_per_us`
- `t1_base_us`
- `tphi_base_us`
- `t1_effective_us`
- `t2_effective_us`

Compatibility aliases remain available for older consumers:

- `gamma1_per_us`
- `gammaphi_per_us`
- `gamma_phi_total_per_us`
- `t1_us`
- `t2_us`

## CSV

Single-run CSV columns:

- `time_us`
- `state_fidelity`
- `purity`

Comparison CSV columns:

- `time_us`
- `state_fidelity_a`
- `purity_a`
- `state_fidelity_b`
- `purity_b`

## Markdown Report

Markdown reports summarize the run in human-readable sections:

- Summary
- Circuit
- Environment
- Derived Parameters
- Diagnostics
- Output Probabilities
- Model Assumptions
- Warnings

Comparison reports include A/B labels, environments, summaries, delta metrics,
and warnings.
