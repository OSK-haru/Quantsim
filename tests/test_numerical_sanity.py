import math
import unittest

from core.expert_data import build_expert_inspector_data
from core.simulator import run_simulation
from tests.phase8_helpers import bell_config, one_qubit_gate_config


class NumericalSanityTest(unittest.TestCase):
    def test_standard_cases_have_no_nan_or_inf(self) -> None:
        for config in [
            one_qubit_gate_config("I"),
            one_qubit_gate_config("X"),
            one_qubit_gate_config("Z"),
            one_qubit_gate_config("H"),
            bell_config(),
        ]:
            with self.subTest(circuit=config.circuit.to_dict()):
                result = run_simulation(config)
                values = [
                    *result.times,
                    *result.fidelity,
                    *result.purity,
                    *result.output_probabilities.values(),
                ]

                self.assertTrue(values)
                self.assertTrue(all(math.isfinite(value) for value in values))

    def test_probability_fidelity_and_purity_ranges(self) -> None:
        result = run_simulation(bell_config())

        self.assertTrue(all(-1e-10 <= value <= 1.0 + 1e-10 for value in result.fidelity))
        self.assertTrue(all(-1e-10 <= value <= 1.0 + 1e-10 for value in result.purity))
        self.assertAlmostEqual(sum(result.output_probabilities.values()), 1.0, delta=1e-8)

    def test_density_matrix_diagnostics_are_sane(self) -> None:
        result = run_simulation(bell_config())
        state_data = build_expert_inspector_data(result)["state"]

        self.assertAlmostEqual(state_data["Trace"]["real"], 1.0, delta=1e-8)
        self.assertAlmostEqual(state_data["Trace"]["imag"], 0.0, delta=1e-8)
        self.assertLessEqual(state_data["Hermiticity error"], 1e-8)
        self.assertGreaterEqual(state_data["Minimum eigenvalue"], -1e-8)


if __name__ == "__main__":
    unittest.main()
