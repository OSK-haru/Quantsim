import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.comparison import ComparisonConfig, run_comparison
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation


class GateExecutionTest(unittest.TestCase):
    def test_one_qubit_x_on_zero_outputs_one(self) -> None:
        result = run_simulation(_config_for_gate("X"))

        self.assertEqual(result.issues, [])
        self.assertAlmostEqual(result.output_probabilities["0"], 0.0, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 1.0, delta=1e-4)

    def test_one_qubit_z_on_zero_keeps_zero(self) -> None:
        result = run_simulation(_config_for_gate("Z"))

        self.assertEqual(result.issues, [])
        self.assertAlmostEqual(result.output_probabilities["0"], 1.0, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.0, delta=1e-4)

    def test_one_qubit_h_on_zero_outputs_balanced_distribution(self) -> None:
        result = run_simulation(_config_for_gate("H"))

        self.assertEqual(result.issues, [])
        self.assertAlmostEqual(result.output_probabilities["0"], 0.5, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.5, delta=1e-4)

    def test_measure_is_noop_for_evolution(self) -> None:
        result = run_simulation(_config_for_gate("Measure"))

        self.assertEqual(result.issues, [])
        self.assertAlmostEqual(result.output_probabilities["0"], 1.0, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.0, delta=1e-4)

    def test_run_comparison_works_for_non_h_one_qubit_circuit(self) -> None:
        comparison = run_comparison(
            ComparisonConfig(
                circuit=_circuit_for_gate("X"),
                environment_a=_environment(),
                environment_b=EnvironmentConfig(
                    mode="normalized",
                    temperature=0.8,
                    magnetic_field=0.1,
                    noise_level=0.8,
                ),
                duration_us=0.001,
                time_steps=3,
                fidelity_threshold=0.9,
                label_a="Low",
                label_b="High",
            )
        )

        self.assertTrue(comparison.result_a.times)
        self.assertTrue(comparison.result_b.times)
        self.assertIsNotNone(comparison.delta_final_fidelity)


def _config_for_gate(gate_type: str) -> SimulationConfig:
    return SimulationConfig(
        circuit=_circuit_for_gate(gate_type),
        environment=_environment(),
        duration_us=0.001,
        time_steps=3,
        fidelity_threshold=0.9,
    )


def _circuit_for_gate(gate_type: str) -> CircuitConfig:
    return CircuitConfig(
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
    )


def _environment() -> EnvironmentConfig:
    return EnvironmentConfig(
        mode="normalized",
        temperature=0.0,
        magnetic_field=0.0,
        noise_level=0.0,
    )


if __name__ == "__main__":
    unittest.main()
