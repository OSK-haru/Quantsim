import json
import unittest

from core.circuit_model import CircuitConfig
from core.expert_data import (
    build_comparison_expert_summary,
    build_expert_inspector_data,
)
from core.comparison import ComparisonConfig, run_comparison
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation


class ExpertDataTest(unittest.TestCase):
    def test_expert_data_contains_overview_noise_state_and_assumptions(self) -> None:
        result = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(noise_level=0.01),
            duration_us=20.0,
            time_steps=11,
            fidelity_threshold=0.9,
        ))

        data = build_expert_inspector_data(result)

        self.assertEqual(data["overview"]["Model"], "weak_coupling_lindblad")
        self.assertEqual(data["overview"]["Logical qubits"], 1)
        self.assertIn("T1 relaxation time", data["noise"])
        self.assertIn("T2 dephasing time", data["noise"])
        self.assertIn("gamma1", data["noise"])
        self.assertIn("gammaphi", data["noise"])
        self.assertIn("Downward transition rate gamma_down [1/us]", data["noise"])
        self.assertIn("Upward transition rate gamma_up [1/us]", data["noise"])
        self.assertIn("Population relaxation rate gamma_1,total [1/us]", data["noise"])
        self.assertIn("Effective T1 [us]", data["noise"])
        self.assertIn("Final density matrix", data["state"])
        self.assertEqual(data["h_eff"]["Status"], "not enabled")
        self.assertIn("Born-Markov approximation", data["assumptions"])
        json.dumps(data)

    def test_operator_data_is_available_for_valid_result(self) -> None:
        result = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(noise_level=0.01),
            duration_us=20.0,
            time_steps=11,
            fidelity_threshold=0.9,
        ))

        data = build_expert_inspector_data(result)

        self.assertIn("Collapse operators", data["operators"])
        self.assertGreaterEqual(len(data["operators"]["Collapse operators"]), 1)

    def test_comparison_expert_summary_contains_condition_noise_values(self) -> None:
        comparison = run_comparison(ComparisonConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment_a=EnvironmentConfig(noise_level=0.01),
            environment_b=EnvironmentConfig(noise_level=0.8),
            label_a="Low",
            label_b="High",
        ))

        summary = build_comparison_expert_summary(comparison)

        self.assertIn("Low", summary)
        self.assertIn("High", summary)
        self.assertIn("T1 relaxation time", summary["Low"])
        self.assertIn("gamma1", summary["High"])
        json.dumps(summary)


if __name__ == "__main__":
    unittest.main()
