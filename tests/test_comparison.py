import unittest

from core.circuit_model import CircuitConfig
from core.comparison import ComparisonConfig, ComparisonResult, run_comparison
from core.results import EnvironmentConfig, SimulationResult


class ComparisonTest(unittest.TestCase):
    def test_one_qubit_h_low_noise_vs_high_noise_runs(self) -> None:
        result = run_comparison(_comparison_config())

        self.assertIsInstance(result, ComparisonResult)
        self.assertIsInstance(result.result_a, SimulationResult)
        self.assertIsInstance(result.result_b, SimulationResult)
        self.assertTrue(result.result_a.times)
        self.assertTrue(result.result_b.times)

    def test_delta_values_are_calculated(self) -> None:
        result = run_comparison(_comparison_config())

        self.assertIsNotNone(result.delta_final_fidelity)
        self.assertIsNotNone(result.delta_final_purity)
        self.assertIsNotNone(result.delta_effective_operation_time_us)
        self.assertIn(result.better_condition, {"Low noise", "High noise", "Tie"})

    def test_warnings_from_both_results_are_collected(self) -> None:
        result = run_comparison(
            ComparisonConfig(
                circuit=CircuitConfig.one_qubit_h(),
                environment_a=EnvironmentConfig(noise_level=1.2),
                environment_b=EnvironmentConfig(noise_level=1.3),
                label_a="A",
                label_b="B",
            )
        )

        self.assertGreaterEqual(len(result.warnings), 2)
        self.assertTrue(any("INVALID_NOISE_LEVEL" in warning for warning in result.warnings))


def _comparison_config() -> ComparisonConfig:
    return ComparisonConfig(
        circuit=CircuitConfig.one_qubit_h(),
        environment_a=EnvironmentConfig(
            mode="normalized",
            temperature=0.1,
            magnetic_field=0.1,
            noise_level=0.1,
        ),
        environment_b=EnvironmentConfig(
            mode="normalized",
            temperature=0.8,
            magnetic_field=0.1,
            noise_level=0.8,
        ),
        duration_us=20.0,
        time_steps=101,
        fidelity_threshold=0.9,
        label_a="Low noise",
        label_b="High noise",
    )


if __name__ == "__main__":
    unittest.main()
