# QuantaScope Config Format

QuantaScope circuit files use `.qscope.json`.

## Envelope

Required top-level fields:

- `schema_version`: format version, currently `1.1`
- `kind`: `quanta_scope.config`
- `metadata`: user-facing name, description, or tags
- `circuit`: serialized `CircuitConfig`
- `environment`: serialized `EnvironmentConfig`
- `simulation`: duration, time steps, threshold, and model
- `ui`: optional UI hints

## Circuit

`circuit` contains:

- `logical_qubits`: currently 1 or 2
- `initial_states`: one of `0`, `1`, `+`, `-` per qubit
- `columns`: ordered gate columns with `step` and `gates`

Supported gate types are `I`, `H`, `X`, `Z`, `Measure`, and `CNOT`.
For basis labels, `q0` is the most significant bit.

## Environment

`environment` uses the unified environment model:

- `model`: `generic_superconducting_open_system_v1`
- `input_mode`: `normalized` or `physical`
- `normalized`: beginner-friendly normalized controls
- `physical`: expert physical-unit controls

Normalized input contains:

- `temperature_parameter`
- `magnetic_field_parameter` legacy key, interpreted as normalized flux-noise strength
- `noise_level`

Physical input contains:

- `device_quality`
- `temperature_mk`
- `flux_noise_phi0`
- `qubit_frequency_ghz`

Older `1.0` configs with `environment_model` values such as
`normalized_phenomenological_v1` or `superconducting_qubit_profile_v1` are
accepted and migrated to the unified model when loaded.

## Validation

Loaded configs are converted into `SimulationConfig` and validated through the
core validation layer before they are accepted.
