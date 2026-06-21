import unittest

from core.simulator import run_simulation
from tests.phase8_helpers import bell_config, one_qubit_gate_config


class PhysicalSanityTest(unittest.TestCase):
    def test_x_on_zero_outputs_one(self) -> None:
        result = run_simulation(one_qubit_gate_config("X"))

        self.assertAlmostEqual(result.output_probabilities["1"], 1.0, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["0"], 0.0, delta=1e-4)

    def test_z_on_zero_preserves_zero(self) -> None:
        result = run_simulation(one_qubit_gate_config("Z"))

        self.assertAlmostEqual(result.output_probabilities["0"], 1.0, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.0, delta=1e-4)

    def test_h_on_zero_outputs_balanced_probabilities(self) -> None:
        result = run_simulation(one_qubit_gate_config("H"))

        self.assertAlmostEqual(result.output_probabilities["0"], 0.5, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.5, delta=1e-4)

    def test_bell_circuit_supports_00_and_11(self) -> None:
        result = run_simulation(bell_config())

        self.assertAlmostEqual(result.output_probabilities["00"], 0.5, delta=1e-4)
        self.assertAlmostEqual(result.output_probabilities["11"], 0.5, delta=1e-4)
        self.assertLess(result.output_probabilities["01"], 1e-4)
        self.assertLess(result.output_probabilities["10"], 1e-4)


if __name__ == "__main__":
    unittest.main()
