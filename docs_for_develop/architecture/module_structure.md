# Module Structure

## Direction

The active product path is:

```text
React/Vite -> FastAPI -> Python core
```

Core code remains independent from React, FastAPI, and other UI/service
layers. QuTiP is validation-only. Rust is an optional preview backend and is
not required for the standard Python path.

## Public Boundaries

Gate-aware simulation:

```text
SimulationConfig -> core.simulator.run_simulation -> SimulationResult
POST /api/simulate -> SimulationResponse
```

Pulse Baseline A:

```text
PulseSimulateRequest -> api.pulse_service.run_pulse_request
POST /api/pulse/simulate -> PulseSimulateResponse
```

## Active Directories

```text
frontend/
  src/pages/                  application views
  src/components/             circuit, result, and state UI
  src/context/                shared circuit editor state
  src/utils/                  editing, validation, import/export helpers

api/
  main.py                     FastAPI application and gate API
  pulse_models.py             strict pulse request/response schemas
  pulse_service.py            bounded Pulse Baseline A orchestration
  pulse_qutrit_service.py     bounded Extension B qutrit orchestration
  pulse_transmon_network_service.py  bounded 1-4 transmon network orchestration
  pulse_backend_logging.py    pulse backend resolution diagnostics

core/
  simulator.py                gate-aware simulation entry point
  capabilities.py             shared limits, gate set, and model identifiers
  execution_representation.py statevector/density-matrix selection policy
  circuit_model.py            JSON-friendly circuit models
  circuit_state.py            core-side editable circuit state
  circuit_history.py          core-side undo/redo model
  circuit_validation.py       placement validation
  classical_branching.py      measurement feed-forward branch execution
  physical_environment.py     physical/normalized input to rates
  gates.py                    operators and Lindblad RHS
  gate_compiler.py            advanced-gate decomposition rules
  gate_aware_cptp.py          explicit CPTP exponential maps and Choi audit
  cptp*.py                    Liouvillian/Kraus construction and comparison
  dense_numpy.py              default NumPy dense execution
  rust_dense_kernel.py        optional Rust preview wrapper
  pulse_*.py                  Pulse Baseline A and staged Extension B paths
  pulse_qutrit.py             B-1 closed qutrit evolution and leakage
  pulse_qutrit_open_system.py B-2 qutrit dissipation and thermal rates
  pulse_qutrit_contract.py    B-0 qutrit operators and Hamiltonian contract
  pulse_transmon_network.py   coupled 1-4 transmon register and GKSL evolution
  pulse_step_policy.py        Baseline A and B-3/B-4 qutrit step policies
  quasi_static_noise.py       quasi-static detuning quadrature and correlation
  state_snapshots.py          bounded snapshot policy
  io/                         .qscope.json config/result/report export.
                              Streamlit-era; no shipping surface imports it,
                              and only tests exercise it. The React client
                              exports through frontend/src/utils/resultExport.ts
                              instead. See "Divergent export formats" below.

validation_pulse/             reusable pulse validation helpers
scripts/                      validation, profiling, and diagnostics
tests/                        Python unittest suite
validation_results/           machine-readable validation artifacts
docs_for_develop/             requirements, architecture, physics, reports
docs/                         generated performance notes and packaging guide
packaging/, desktop_app.py    optional Windows desktop launcher
formalweb/website/            public Docusaurus documentation site
```

The former `app/` Streamlit tree is not active and must not be referenced by
new runtime instructions.

## Current Capabilities

- Gate-aware core/API: 1-18 logical qubits; noisy density-matrix evolution is
  limited to 8, explicit CPTP to 5, and ideal measurement-free circuits above
  5 qubits use the statevector path.
- Circuit Studio UI: 2-8 logical qubits.
- Supported gate labels: I, H, X, Y, Z, S, T, RX, RY, RZ, CNOT, CZ, CP, CCX,
  SWAP, QFT, ORACLE, MEASURE, and MESSAGE.
- Evolution methods: `fixed_step_rk4` (default) and `explicit_cptp`.
- React uses physical inputs; normalized API compatibility remains.
- Arbitrary `circuit_config` and Bell preset compatibility coexist.
- State snapshot serialization is bounded by request policy.
- The public Pulse Baseline A path is one two-level qubit, with a Pulse Lab
  frontend route at `/pulse-lab`.
- Pulse Extension B (qutrit) is frozen as `pulse-extension-b-v1` with
  capability status `available`; qutrit HTTP execution is enabled with a
  25,000-step preflight work ceiling.
- A coupled transmon-network pulse model (`pulse-transmon-network-v1`) is
  served from the same `POST /api/pulse/simulate` endpoint with capability
  status `experimental`. It covers 1-4 transmons at 2 or 3 local levels; the
  earlier `pulse-coupled-pair-v1` model was retired into it.

## Divergent export formats

Two independent export paths exist, and they do not agree on the `kind`
discriminator written into the JSON:

| Path | Reached by | `kind` values |
|---|---|---|
| `core/io/` | tests only | `yuragi_strider.config`, `yuragi_strider.result`, `yuragi_strider.comparison_result` |
| `frontend/src/utils/` | the shipping React client | `quantscope_circuit_config`, `quantscope_gate_aware_result`, `quantscope_pulse_result` |

`quantscope` is a misspelling of an abandoned working title; the product is
Yuragi-Strider, and `resultExport.ts` already writes `generator:
"Yuragi-Strider"` next to that `kind`.

These strings are load-bearing on the frontend, and increasingly so. Both
`circuitConfigTransfer.ts` and `resultExport.ts` (`openEnvelope`) reject a file
whose `kind` does not match, and `openEnvelope` additionally compares against
the *other* result kind so it can tell the user they opened a pulse file on the
gate-aware screen. Renaming is therefore a file-format migration -- the readers
must keep accepting the old `quantscope_*` value, or every file exported before
the rename stops loading in the app that wrote it -- and not a
search-and-replace.
