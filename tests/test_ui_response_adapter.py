import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.errors import ValidationIssue
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


class UiResponseAdapterTests(unittest.TestCase):
    def test_adapter_returns_all_top_level_keys(self):
        result = run_simulation(SimulationConfig())

        response = simulation_result_to_ui_response(result)

        self.assertEqual(
            {
                "circuit",
                "parameters",
                "diagnostics",
                "summary",
                "timeline",
                "output_probabilities",
                "run",
                "warnings",
                "issues",
            },
            set(response.keys()),
        )

    def test_one_qubit_h_maps_summary_timeline_and_probabilities(self):
        result = run_simulation(SimulationConfig())

        response = simulation_result_to_ui_response(result)

        self.assertIsNotNone(response["summary"]["final_fidelity"])
        self.assertIsNotNone(response["summary"]["final_purity"])
        self.assertEqual(len(result.times), len(response["timeline"]))
        self.assertEqual(result.output_probabilities, response["output_probabilities"])

    def test_diagnostics_include_model_evolution_and_backend(self):
        result = run_simulation(SimulationConfig())

        diagnostics = simulation_result_to_ui_response(result)["diagnostics"]

        self.assertIn("simulation_model", diagnostics)
        self.assertIn("evolution_mode", diagnostics)
        self.assertEqual("python_dense", diagnostics["simulation_backend"])

    def test_physical_parameters_include_temperature_k_and_mk(self):
        config = SimulationConfig(
            environment=EnvironmentConfig(
                input_mode="physical",
                temperature_mk=15.0,
                qubit_frequency_ghz=5.0,
                device_quality=0.85,
                flux_noise_phi0=0.02,
            )
        )
        result = run_simulation(config)

        parameters = simulation_result_to_ui_response(result)["parameters"]

        self.assertAlmostEqual(0.015, parameters["temperature_k"])
        self.assertAlmostEqual(15.0, parameters["temperature_mk"])
        self.assertIsNone(parameters["normalized_temperature"])

    def test_normalized_parameters_do_not_invent_temperature_k(self):
        result = run_simulation(SimulationConfig())

        parameters = simulation_result_to_ui_response(result)["parameters"]

        self.assertIsNone(parameters["temperature_k"])
        self.assertIsNone(parameters["temperature_mk"])
        self.assertIsNotNone(parameters["normalized_temperature"])

    def test_cnot_maps_to_control_and_target_entries(self):
        circuit = CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(
                            type="CNOT",
                            controls=[0],
                            targets=[1],
                            params={"duration_us": 0.2},
                        )
                    ],
                )
            ],
        )
        result = run_simulation(SimulationConfig(circuit=circuit))

        gates = simulation_result_to_ui_response(result)["circuit"]["columns"][0]["gates"]

        self.assertIn("control", [gate["kind"] for gate in gates])
        self.assertIn("target", [gate["kind"] for gate in gates])

    def test_timeline_uses_shortest_length_and_warns(self):
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0, 2.0],
            fidelity=[1.0, 0.9],
            purity=[1.0, 0.95, 0.9],
            effective_operation_time_us=None,
        )

        response = simulation_result_to_ui_response(result)

        self.assertEqual(2, len(response["timeline"]))
        self.assertTrue(any("shortest length" in warning for warning in response["warnings"]))

    def test_issues_are_json_safe(self):
        result = SimulationResult(
            config=SimulationConfig(),
            times=[],
            fidelity=[],
            purity=[],
            effective_operation_time_us=None,
            issues=[
                ValidationIssue(
                    level="error",
                    code="TEST",
                    message="Test issue",
                    detail="detail",
                    suggestion="suggestion",
                )
            ],
        )

        response = simulation_result_to_ui_response(result)

        self.assertEqual("Completed with issues", response["run"]["status"])
        self.assertEqual("TEST", response["issues"][0]["code"])


if __name__ == "__main__":
    unittest.main()
