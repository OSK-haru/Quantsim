"""Export a small React UI response example JSON.

This is a smoke script for inspecting the backend-to-frontend response shape.
It does not start an API server or connect the React app.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


OUTPUT_PATH = Path("outputs") / "ui_response_example.json"


def build_example_config() -> SimulationConfig:
    circuit = CircuitConfig(
        logical_qubits=2,
        initial_states=["0", "0"],
        columns=[
            GateColumn(
                step=0,
                gates=[
                    GateOperation(
                        type="H",
                        targets=[0],
                        controls=[],
                        params={"duration_us": 0.02},
                    )
                ],
            ),
            GateColumn(
                step=1,
                gates=[
                    GateOperation(
                        type="CNOT",
                        targets=[1],
                        controls=[0],
                        params={"duration_us": 0.2},
                    )
                ],
            ),
        ],
    )
    return SimulationConfig(
        circuit=circuit,
        environment=EnvironmentConfig(),
        duration_us=2.0,
        time_steps=11,
        fidelity_threshold=0.9,
        simulation_backend="python_dense",
    )


def main() -> None:
    config = build_example_config()
    result = run_simulation(config)
    response = simulation_result_to_ui_response(result)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as file:
        json.dump(response, file, indent=2)

    summary = response["summary"]
    run = response["run"]
    print(f"Wrote {OUTPUT_PATH}")
    print(f"final_fidelity={summary['final_fidelity']}")
    print(f"final_purity={summary['final_purity']}")
    print(f"timeline_length={len(response['timeline'])}")
    print(f"selected_backend={run['selected_backend']}")


if __name__ == "__main__":
    main()
