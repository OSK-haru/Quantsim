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

core/
  simulator.py                gate-aware simulation entry point
  circuit_model.py            JSON-friendly circuit models
  circuit_state.py            core-side editable circuit state
  circuit_history.py          core-side undo/redo model
  circuit_validation.py       placement validation
  physical_environment.py     physical/normalized input to rates
  gates.py                    operators and Lindblad RHS
  dense_numpy.py              default NumPy dense execution
  rust_dense_kernel.py        optional Rust preview wrapper
  pulse_*.py                  Pulse Baseline A and staged Extension B paths
  pulse_qutrit.py             B-1 closed qutrit evolution and leakage
  pulse_qutrit_open_system.py B-2 qutrit dissipation and thermal rates
  pulse_qutrit_contract.py    B-0 qutrit operators and Hamiltonian contract
  pulse_step_policy.py        Baseline A and B-3/B-4 qutrit step policies
  state_snapshots.py          bounded snapshot policy
  io/                         config/result/report export

validation_pulse/             reusable pulse validation helpers
scripts/                      validation, profiling, and diagnostics
tests/                        Python unittest suite
validation_results/           machine-readable validation artifacts
docs/                         requirements, architecture, physics, reports
```

The former `app/` Streamlit tree is not active and must not be referenced by
new runtime instructions.

## Current Capabilities

- Gate-aware core/API: 1-18 logical qubits; noisy density-matrix evolution is
  limited to 5, ideal measurement-free circuits above that use the
  statevector path.
- Circuit Studio UI: 2-4 logical qubits.
- Supported gate labels: I, H, X, Y, Z, S, T, RX, RY, RZ, CNOT, CZ, CP, CCX,
  SWAP, MEASURE, and MESSAGE.
- React uses physical inputs; normalized API compatibility remains.
- Arbitrary `circuit_config` and Bell preset compatibility coexist.
- State snapshot serialization is bounded by request policy.
- The public Pulse Baseline A path is one two-level qubit, with a Pulse Lab
  frontend route at `/pulse-lab`.
- Pulse Extension B (qutrit) is frozen as `pulse-extension-b-v1` with
  capability status `available`; qutrit HTTP execution is enabled with a
  25,000-step preflight work ceiling.
- A coupled transmon-pair pulse model (`pulse-coupled-pair-v1`) is served
  from the same `POST /api/pulse/simulate` endpoint with capability status
  `experimental`.
