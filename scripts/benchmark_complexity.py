"""Benchmark dense Lindblad complexity cases with standard-library tools."""

from __future__ import annotations

import sys
import time
import tracemalloc
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation


def main() -> None:
    cases = [
        ("smoke", "1Q H", _one_qubit(["H"])),
        ("smoke", "1Q HX", _one_qubit(["H", "X"])),
        ("A fixed total", "Bell CNOT 0.2 total 20", _bell(0.2, 20.0)),
        ("A fixed total", "Bell CNOT 2 total 20", _bell(2.0, 20.0)),
        ("B fixed idle", "Bell CNOT 0.2 idle 5", _bell_with_idle(0.2, 5.0)),
        ("B fixed idle", "Bell CNOT 2 idle 5", _bell_with_idle(2.0, 5.0)),
        ("C completion-only", "Bell CNOT 0.2 no idle", _bell_completion_only(0.2)),
        ("C completion-only", "Bell CNOT 20 no idle", _bell_completion_only(20.0)),
    ]
    print(",".join([
        "group",
        "case",
        "qubits",
        "gates",
        "columns",
        "time_steps",
        "duration_us",
        "total_gate_duration_us",
        "idle_duration_us",
        "wall_time_seconds",
        "peak_memory_bytes",
        "completion_fidelity",
        "final_fidelity",
        "completion_purity",
        "final_purity",
        "total_rk4_substeps",
        "total_rhs_evaluations",
        "max_generator_scale",
        "segmented_estimated_work_units",
    ]))
    for group, name, config in cases:
        result, wall_time, peak_memory = _run_profiled(config)
        diagnostics = result.diagnostics
        print(",".join(str(value) for value in [
            group,
            name,
            config.circuit.logical_qubits,
            _gate_count(config),
            len(config.circuit.columns),
            config.time_steps,
            config.duration_us,
            f"{diagnostics.get('total_gate_duration_us', 0.0):.12g}",
            f"{diagnostics.get('idle_duration_us', 0.0):.12g}",
            f"{wall_time:.6f}",
            peak_memory,
            f"{diagnostics.get('completion_fidelity', 0.0):.12g}",
            f"{result.fidelity[-1]:.12g}",
            f"{diagnostics.get('completion_purity', 0.0):.12g}",
            f"{result.purity[-1]:.12g}",
            f"{diagnostics.get('complexity_total_rk4_substeps', 0.0):.12g}",
            f"{diagnostics.get('complexity_total_rhs_evaluations', 0.0):.12g}",
            f"{diagnostics.get('complexity_max_generator_scale_per_us', 0.0):.12g}",
            f"{diagnostics.get('complexity_estimated_work_units_segmented', 0.0):.12g}",
        ]))


def _run_profiled(config: SimulationConfig):
    tracemalloc.start()
    start = time.perf_counter()
    result = run_simulation(config)
    wall_time = time.perf_counter() - start
    _, peak_memory = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return result, wall_time, peak_memory


def _environment() -> EnvironmentConfig:
    return EnvironmentConfig(
        input_mode="physical",
        device_quality=1.0,
        temperature_mk=0.0,
        flux_noise_phi0=0.0,
        t1_max_us=100.0,
        tphi_max_us=100.0,
    )


def _one_qubit(gates: list[str]) -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=1,
            initial_states=["0"],
            columns=[
                GateColumn(
                    step=index,
                    gates=[GateOperation(type=gate, targets=[0])],
                )
                for index, gate in enumerate(gates)
            ],
        ),
        environment=_environment(),
        duration_us=1.0,
        time_steps=51,
        fidelity_threshold=0.9,
    )


def _bell(cnot_duration_us: float = 0.2, duration_us: float = 1.0) -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[GateOperation(type="H", targets=[0])],
                ),
                GateColumn(
                    step=1,
                    gates=[
                        GateOperation(
                            type="CNOT",
                            targets=[1],
                            controls=[0],
                            params={"duration_us": cnot_duration_us},
                        )
                    ],
                ),
            ],
        ),
        environment=_environment(),
        duration_us=duration_us,
        time_steps=51,
        fidelity_threshold=0.9,
    )


def _bell_with_idle(cnot_duration_us: float, idle_duration_us: float) -> SimulationConfig:
    return _bell(
        cnot_duration_us=cnot_duration_us,
        duration_us=0.02 + cnot_duration_us + idle_duration_us,
    )


def _bell_completion_only(cnot_duration_us: float) -> SimulationConfig:
    return _bell(
        cnot_duration_us=cnot_duration_us,
        duration_us=0.02 + cnot_duration_us,
    )


def _gate_count(config: SimulationConfig) -> int:
    return sum(len(column.gates) for column in config.circuit.columns)


if __name__ == "__main__":
    main()
