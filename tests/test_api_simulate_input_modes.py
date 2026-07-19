import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from api.main import SimulateRequest, build_config_from_simulate_request, simulate


class ApiSimulateInputModesTest(unittest.TestCase):
    def test_existing_normalized_payload_defaults_to_normalized_mode(self) -> None:
        request = SimulateRequest(
            circuit_preset="bell",
            simulation_backend="python_dense",
            parameters={
                "normalized_temperature": 0.2,
                "normalized_magnetic_field": 0.3,
                "noise_level": 0.4,
                "duration_us": 2.0,
                "time_steps": 11,
                "fidelity_threshold": 0.9,
            },
        )

        config = build_config_from_simulate_request(request)

        self.assertEqual(config.environment.input_mode, "normalized")
        self.assertAlmostEqual(config.environment.temperature, 0.2)
        self.assertAlmostEqual(config.environment.magnetic_field, 0.3)
        self.assertAlmostEqual(config.environment.noise_level, 0.4)
        self.assertAlmostEqual(config.duration_us, 2.0)
        self.assertEqual(config.time_steps, 11)
        self.assertAlmostEqual(config.fidelity_threshold, 0.9)

    def test_physical_payload_builds_physical_environment(self) -> None:
        request = SimulateRequest(
            circuit_preset="bell",
            simulation_backend="python_dense",
            input_mode="physical",
            parameters={
                "device_quality": 0.8,
                "temperature_mk": 15.0,
                "flux_noise_phi0": 0.000001,
                "qubit_frequency_ghz": 5.0,
                "t1_max_us": 100.0,
                "tphi_max_us": 100.0,
                "duration_us": 2.0,
                "time_steps": 11,
                "fidelity_threshold": 0.9,
            },
        )

        config = build_config_from_simulate_request(request)

        self.assertEqual(config.environment.input_mode, "physical")
        self.assertAlmostEqual(config.environment.device_quality, 0.8)
        self.assertAlmostEqual(config.environment.temperature_mk, 15.0)
        self.assertAlmostEqual(config.environment.flux_noise_phi0, 0.000001)
        self.assertAlmostEqual(config.environment.qubit_frequency_ghz, 5.0)
        self.assertAlmostEqual(config.environment.t1_max_us, 100.0)
        self.assertAlmostEqual(config.environment.tphi_max_us, 100.0)

    def test_gate_duration_defaults_override_bell_preset_gate_durations(self) -> None:
        request = SimulateRequest(
            circuit_preset="bell",
            simulation_backend="python_dense",
            input_mode="physical",
            gate_duration_defaults={
                "H": 0.05,
                "X": 0.02,
                "Z": 0.0,
                "CNOT": 0.4,
                "MEASURE": 0.0,
            },
            parameters={
                "device_quality": 0.8,
                "temperature_mk": 15.0,
                "flux_noise_phi0": 0.000001,
                "qubit_frequency_ghz": 5.0,
                "t1_max_us": 100.0,
                "tphi_max_us": 100.0,
                "duration_us": 2.0,
                "time_steps": 11,
                "fidelity_threshold": 0.9,
            },
        )

        config = build_config_from_simulate_request(request)

        h_gate = config.circuit.columns[0].gates[0]
        cnot_gate = config.circuit.columns[1].gates[0]
        self.assertAlmostEqual(h_gate.params["duration_us"], 0.05)
        self.assertAlmostEqual(cnot_gate.params["duration_us"], 0.4)

    def test_gate_duration_defaults_reject_zero_hamiltonian_gate_duration(self) -> None:
        with self.assertRaises(ValidationError):
            SimulateRequest(
                circuit_preset="bell",
                simulation_backend="python_dense",
                input_mode="physical",
                gate_duration_defaults={
                    "H": 0.0,
                    "X": 0.02,
                    "Z": 0.0,
                    "CNOT": 0.2,
                    "MEASURE": 0.0,
                },
                parameters={
                    "device_quality": 0.8,
                    "temperature_mk": 15.0,
                    "flux_noise_phi0": 0.000001,
                    "qubit_frequency_ghz": 5.0,
                    "t1_max_us": 100.0,
                    "tphi_max_us": 100.0,
                    "duration_us": 2.0,
                    "time_steps": 11,
                    "fidelity_threshold": 0.9,
                },
            )

    def test_simulate_accepts_physical_payload_with_rate_details(self) -> None:
        request = SimulateRequest(
            circuit_preset="bell",
            simulation_backend="python_dense",
            input_mode="physical",
            parameters={
                "device_quality": 0.8,
                "temperature_mk": 15.0,
                "flux_noise_phi0": 0.000001,
                "qubit_frequency_ghz": 5.0,
                "t1_max_us": 100.0,
                "tphi_max_us": 100.0,
                "duration_us": 2.0,
                "time_steps": 11,
                "fidelity_threshold": 0.9,
            },
        )

        response = simulate(request)

        self.assertIn("circuit", response)
        self.assertIn("parameters", response)
        self.assertIn("rates", response)
        self.assertIn("diagnostics", response)
        self.assertIn("summary", response)
        self.assertIn("timeline", response)
        self.assertIn("output_probabilities", response)
        self.assertIn("run", response)
        self.assertIn("warnings", response)
        self.assertIn("issues", response)
        self.assertEqual(response["parameters"]["input_mode"], "physical")
        self.assertIn("gamma_down_per_us", response["rates"])
        self.assertIn("gamma_up_per_us", response["rates"])
        self.assertIn("gamma_population_relaxation_per_us", response["rates"])
        self.assertEqual(
            response["rates"]["gamma_down_per_us"],
            response["rates"]["gamma1_per_us"],
        )
        self.assertIn("api_total_request_ms", response["diagnostics"])
        self.assertIn("api_build_config_ms", response["diagnostics"])
        self.assertIn("api_run_simulation_ms", response["diagnostics"])
        self.assertIn("api_ui_response_ms", response["diagnostics"])
        self.assertIn("api_logical_qubits", response["diagnostics"])

    def test_simulate_returns_structured_error_detail_on_failure(self) -> None:
        request = SimulateRequest(
            circuit_preset="bell",
            simulation_backend="python_dense",
            input_mode="physical",
            parameters={
                "device_quality": 0.8,
                "temperature_mk": 15.0,
                "flux_noise_phi0": 0.000001,
                "qubit_frequency_ghz": 5.0,
                "t1_max_us": 100.0,
                "tphi_max_us": 100.0,
                "duration_us": 2.0,
                "time_steps": 11,
                "fidelity_threshold": 0.9,
            },
        )

        with patch("api.main.run_simulation", side_effect=ValueError("boom")):
            with self.assertRaises(HTTPException) as context:
                simulate(request)

        detail = context.exception.detail
        self.assertIsInstance(detail, dict)
        self.assertEqual(detail["message"], "Simulation failed.")
        self.assertEqual(detail["error_type"], "ValueError")
        self.assertIn("boom", str(detail["error"]))

    def test_physical_payload_requires_physical_environment_fields(self) -> None:
        with self.assertRaises(ValidationError):
            SimulateRequest(
                circuit_preset="bell",
                simulation_backend="python_dense",
                input_mode="physical",
                parameters={
                    "device_quality": 0.8,
                    "temperature_mk": 15.0,
                    "flux_noise_phi0": 0.000001,
                    "qubit_frequency_ghz": 5.0,
                    "t1_max_us": 100.0,
                    "duration_us": 2.0,
                    "time_steps": 11,
                    "fidelity_threshold": 0.9,
                },
            )


if __name__ == "__main__":
    unittest.main()
