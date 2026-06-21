from __future__ import annotations

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig


def environment(noise_level: float = 0.0) -> EnvironmentConfig:
    return EnvironmentConfig(
        mode="normalized",
        temperature=0.0,
        magnetic_field=0.0,
        noise_level=noise_level,
    )


def one_qubit_gate_config(gate_type: str, noise_level: float = 0.0) -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=1,
            initial_states=["0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(
                            type=gate_type,
                            targets=[0],
                            controls=[],
                            params={},
                        )
                    ],
                )
            ],
        ),
        environment=environment(noise_level),
        duration_us=0.001,
        time_steps=3,
        fidelity_threshold=0.9,
    )


def bell_config(noise_level: float = 0.0) -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
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
                            params={},
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
                            params={},
                        )
                    ],
                ),
            ],
        ),
        environment=environment(noise_level),
        duration_us=0.001,
        time_steps=3,
        fidelity_threshold=0.9,
    )
