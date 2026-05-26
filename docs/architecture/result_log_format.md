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
sample counts. `derived_parameters` includes T1/T2 and gamma values when
available.

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
