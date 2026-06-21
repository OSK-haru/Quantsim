# Module Structure

## Direction

Core code stays independent from Streamlit, React, FastAPI, and other UI or
service layers. UI code calls the stable core API instead of lower-level physics
helpers.

The public simulation entry point is:

- `core.simulator.run_simulation(config)`

The public data contract is:

- `CircuitConfig`
- `EnvironmentConfig`
- `SimulationConfig`
- `SimulationResult`
- `ComparisonConfig`
- `ComparisonResult`

## Core

```text
core/
  simulator.py              unified simulation entry point
  comparison.py             A/B workflow built on run_simulation
  circuit_model.py          JSON-friendly circuit config models
  circuit_state.py          editable circuit state
  circuit_history.py        undo/redo state history
  circuit_validation.py     circuit editing validation
  gates.py                  gate expansion, density matrix operations
  physical_environment.py   unified environment rates
  metrics.py                small result metrics
  validation.py             config/result validation
  results.py                simulation config/result models
  expert_data.py            expert inspector data aggregation
  io/                       config, result, CSV, report export
```

Legacy MVP modules for one-qubit-only evolution were removed from active code.
Old environment model IDs are retained only as migration aliases for loading
older `.qscope.json` files.

## UI

```text
app/
  app.py
  ui/
    beginner_mode.py
    expert_mode.py
    environment_panel.py
    circuit_editor.py
    result_summary.py
    result_drawers.py
    comparison_*.py
    persistence_panel.py
```

Beginner mode uses normalized input controls. Expert mode can switch between
normalized controls and physical-unit inputs. Both input modes flow into the
same unified environment-rate pipeline.
