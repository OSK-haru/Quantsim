# QuantaScope Config Format

QuantaScope circuit files use `.qscope.json`.

## Envelope

Required top-level fields:

- `schema_version`: format version, currently `1.0`
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

## Validation

Loaded configs are converted into `SimulationConfig` and validated through the
core validation layer before they are accepted.
