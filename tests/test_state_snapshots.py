import json
import math
import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


TRACE_TOLERANCE = 1e-8
HERMITICITY_TOLERANCE = 1e-8


class StateSnapshotTests(unittest.TestCase):
    def test_two_qubit_empty_circuit_has_initial_and_final_snapshots(self) -> None:
        result = run_simulation(_config(_empty_circuit(2)))

        self.assertLessEqual(len(result.state_snapshots), 10)
        self.assertEqual("initial", result.state_snapshots[0].kind)
        self.assertEqual("final", result.state_snapshots[-1].kind)
        self.assertEqual(_times(result.state_snapshots), sorted(_times(result.state_snapshots)))
        _assert_numerically_safe(self, result)

    def test_bell_circuit_represents_column_boundary_and_final(self) -> None:
        result = run_simulation(_config(_bell_circuit(), duration_us=1.0))

        kinds = [snapshot.kind for snapshot in result.state_snapshots]
        self.assertIn("column_boundary", kinds)
        self.assertIn("after_circuit", kinds)
        self.assertEqual("final", result.state_snapshots[-1].kind)
        _assert_numerically_safe(self, result)

    def test_four_qubit_long_idle_case_is_bounded_with_16_by_16_matrices(self) -> None:
        result = run_simulation(_config(_four_qubit_long_circuit(), duration_us=2.0, time_steps=41))

        self.assertLessEqual(len(result.state_snapshots), 10)
        for snapshot in result.state_snapshots:
            self.assertEqual(16, len(snapshot.density_matrix))
            self.assertTrue(all(len(row) == 16 for row in snapshot.density_matrix))
        _assert_numerically_safe(self, result)

    def test_completion_equal_to_final_has_no_duplicate_terminal_snapshot(self) -> None:
        result = run_simulation(_config(_bell_circuit(), duration_us=0.22, time_steps=21))

        terminal_times = [
            snapshot.time_us
            for snapshot in result.state_snapshots
            if math.isclose(snapshot.time_us, result.times[-1], abs_tol=1e-12)
        ]
        self.assertEqual(1, len(terminal_times))
        self.assertEqual("final", result.state_snapshots[-1].kind)

    def test_idle_after_circuit_has_after_circuit_and_final_when_times_differ(self) -> None:
        result = run_simulation(_config(_bell_circuit(), duration_us=1.0, time_steps=21))

        kinds = [snapshot.kind for snapshot in result.state_snapshots]
        self.assertIn("after_circuit", kinds)
        self.assertEqual("final", result.state_snapshots[-1].kind)
        after_circuit = next(snapshot for snapshot in result.state_snapshots if snapshot.kind == "after_circuit")
        self.assertLess(after_circuit.time_us, result.state_snapshots[-1].time_us)

    def test_zero_duration_columns_are_deduplicated_deterministically(self) -> None:
        circuit = CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(step=0, gates=[GateOperation(type="Z", targets=[0])]),
                GateColumn(step=1, gates=[GateOperation(type="Z", targets=[1])]),
            ],
        )
        result = run_simulation(_config(circuit, duration_us=1.0, time_steps=21))

        self.assertEqual(len(_times(result.state_snapshots)), len(set(_times(result.state_snapshots))))
        self.assertEqual("initial", result.state_snapshots[0].kind)
        self.assertEqual("final", result.state_snapshots[-1].kind)

    def test_ui_response_serializes_real_and_imag_matrices(self) -> None:
        result = run_simulation(_config(_bell_circuit(), duration_us=1.0, time_steps=21))
        response = simulation_result_to_ui_response(result)

        snapshots = response["state_snapshots"]
        self.assertGreaterEqual(len(snapshots), 2)
        matrix = snapshots[0]["density_matrix"]
        self.assertIn("real", matrix)
        self.assertIn("imag", matrix)
        self.assertEqual(len(matrix["real"]), len(matrix["imag"]))
        self.assertIn("state_snapshot_serialization_ms", response["diagnostics"])
        json.dumps(response)

    def test_simulation_result_round_trips_with_snapshots(self) -> None:
        result = run_simulation(_config(_bell_circuit(), duration_us=1.0, time_steps=21))

        decoded = type(result).from_dict(result.to_dict())

        self.assertEqual(result.to_dict()["state_snapshots"], decoded.to_dict()["state_snapshots"])


def _config(
    circuit: CircuitConfig,
    *,
    duration_us: float = 1.0,
    time_steps: int = 21,
) -> SimulationConfig:
    return SimulationConfig(
        circuit=circuit,
        environment=EnvironmentConfig(),
        duration_us=duration_us,
        time_steps=time_steps,
        fidelity_threshold=0.9,
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


def _four_qubit_long_circuit() -> CircuitConfig:
    columns = []
    for step in range(12):
        target = step % 4
        columns.append(
            GateColumn(
                step=step,
                gates=[
                    GateOperation(
                        type="H" if step % 2 == 0 else "X",
                        targets=[target],
                    )
                ],
            )
        )
    return CircuitConfig(
        logical_qubits=4,
        initial_states=["0", "0", "0", "0"],
        columns=columns,
    )


def _times(snapshots) -> list[float]:
    return [round(snapshot.time_us, 12) for snapshot in snapshots]


def _assert_numerically_safe(test_case: unittest.TestCase, result) -> None:
    for snapshot in result.state_snapshots:
        matrix = snapshot.density_matrix
        dimension = len(matrix)
        test_case.assertGreater(dimension, 0)
        test_case.assertTrue(all(len(row) == dimension for row in matrix))
        trace = sum(matrix[index][index] for index in range(dimension))
        test_case.assertAlmostEqual(1.0, trace.real, delta=TRACE_TOLERANCE)
        test_case.assertAlmostEqual(0.0, trace.imag, delta=TRACE_TOLERANCE)
        for row in range(dimension):
            for column in range(dimension):
                value = matrix[row][column]
                test_case.assertTrue(math.isfinite(value.real))
                test_case.assertTrue(math.isfinite(value.imag))
                test_case.assertLessEqual(
                    abs(value - matrix[column][row].conjugate()),
                    HERMITICITY_TOLERANCE,
                )


if __name__ == "__main__":
    unittest.main()
