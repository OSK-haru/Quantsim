"""Print compact state-snapshot diagnostics for representative circuits."""

from __future__ import annotations

import json
import sys
from time import perf_counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


def main() -> None:
    cases = [
        ("2q Bell", _bell_circuit(), 1.0, 21),
        ("3q GHZ-style", _ghz_style_circuit(), 1.4, 29),
        ("4q empty default", _empty_circuit(4), 1.0, 21),
        ("4q multi-column + idle", _four_qubit_multi_column(), 2.0, 41),
    ]

    print("case | qubits | snapshot count | times | kinds | matrix dimension | JSON size | sim ms | response ms")
    for name, circuit, duration_us, time_steps in cases:
        config = SimulationConfig(
            circuit=circuit,
            environment=EnvironmentConfig(),
            duration_us=duration_us,
            time_steps=time_steps,
            fidelity_threshold=0.9,
        )
        started_at = perf_counter()
        result = run_simulation(config)
        sim_ms = (perf_counter() - started_at) * 1000.0
        response_started_at = perf_counter()
        response = simulation_result_to_ui_response(result)
        response_ms = (perf_counter() - response_started_at) * 1000.0
        encoded = json.dumps(response, separators=(",", ":"))
        snapshots = result.state_snapshots
        times = ",".join(f"{snapshot.time_us:.3g}" for snapshot in snapshots)
        kinds = ",".join(snapshot.kind for snapshot in snapshots)
        dimension = len(snapshots[0].density_matrix) if snapshots else 0
        print(
            f"{name} | {circuit.logical_qubits} | {len(snapshots)} | "
            f"{times} | {kinds} | {dimension}x{dimension} | "
            f"{len(encoded)} bytes | {sim_ms:.3f} | {response_ms:.3f}"
        )


def _empty_circuit(logical_qubits: int) -> CircuitConfig:
    return CircuitConfig(
        logical_qubits=logical_qubits,
        initial_states=["0" for _ in range(logical_qubits)],
        columns=[],
    )


def _bell_circuit() -> CircuitConfig:
    return CircuitConfig(
        logical_qubits=2,
        initial_states=["0", "0"],
        columns=[
            GateColumn(step=0, gates=[GateOperation(type="H", targets=[0])]),
            GateColumn(step=1, gates=[GateOperation(type="CNOT", controls=[0], targets=[1])]),
        ],
    )


def _ghz_style_circuit() -> CircuitConfig:
    return CircuitConfig(
        logical_qubits=3,
        initial_states=["0", "0", "0"],
        columns=[
            GateColumn(step=0, gates=[GateOperation(type="H", targets=[0])]),
            GateColumn(step=1, gates=[GateOperation(type="CNOT", controls=[0], targets=[1])]),
            GateColumn(step=2, gates=[GateOperation(type="CNOT", controls=[1], targets=[2])]),
        ],
    )


def _four_qubit_multi_column() -> CircuitConfig:
    columns = []
    for step in range(12):
        columns.append(
            GateColumn(
                step=step,
                gates=[
                    GateOperation(
                        type="H" if step % 2 == 0 else "X",
                        targets=[step % 4],
                    )
                ],
            )
        )
    return CircuitConfig(
        logical_qubits=4,
        initial_states=["0", "0", "0", "0"],
        columns=columns,
    )


if __name__ == "__main__":
    main()
