import sys
import unittest

from core.circuit_model import CircuitConfig
from core.evolution import simulate_once
from core.metrics import effective_time, fidelity_series, ideal_state_series, purity_series
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation


class RunSimulationApiTest(unittest.TestCase):
    def test_run_simulation_returns_normalized_result_for_one_qubit_h(self) -> None:
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(
                mode="normalized",
                temperature=0.02,
                magnetic_field=0.0,
                noise_level=0.01,
            ),
            duration_us=20.0,
            time_steps=101,
            fidelity_threshold=0.9,
        )

        result = run_simulation(config)

        self.assertIsInstance(result, SimulationResult)
        self.assertEqual(len(result.times), config.time_steps)
        self.assertEqual(len(result.fidelity), config.time_steps)
        self.assertEqual(len(result.purity), config.time_steps)
        self.assertIsInstance(result.effective_operation_time_us, float)
        self.assertIn("t1_us", result.derived_parameters)
        self.assertIn("t2_us", result.derived_parameters)
        self.assertIn("gamma1_per_us", result.derived_parameters)
        self.assertIn("gamma_phi_per_us", result.derived_parameters)
        self.assertIn("gammaphi_per_us", result.derived_parameters)
        self.assertIn("final_fidelity", result.diagnostics)
        self.assertIn("final_purity", result.diagnostics)
        self.assertIsInstance(result.warnings, list)
        self.assertNotIn("streamlit", sys.modules)

    def test_run_simulation_matches_existing_mvp_metric_path(self) -> None:
        environment = EnvironmentConfig(
            mode="normalized",
            temperature=0.02,
            magnetic_field=0.0,
            noise_level=0.01,
        )
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=environment,
            duration_us=20.0,
            time_steps=101,
            fidelity_threshold=0.9,
        )

        result = run_simulation(config)
        times, states = simulate_once(
            temperature_kelvin=environment.temperature,
            magnetic_field_tesla=environment.magnetic_field,
            noise_level=environment.noise_level,
        )
        ideal_states = ideal_state_series(times)
        expected_fidelity = fidelity_series(states, ideal_states)
        expected_purity = purity_series(states)

        self.assertEqual(result.times, times)
        self.assertEqual(result.fidelity, expected_fidelity)
        self.assertEqual(result.purity, expected_purity)
        self.assertEqual(
            result.effective_operation_time_us,
            effective_time(times, expected_fidelity, 0.9),
        )


if __name__ == "__main__":
    unittest.main()
