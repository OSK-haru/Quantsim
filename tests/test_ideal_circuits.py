import unittest

from tests.physics_test_helpers import (
    make_bell_config,
    make_ideal_environment,
    make_one_qubit_gate_config,
    run_and_reconstruct,
)


class IdealCircuitsTest(unittest.TestCase):
    def test_h_on_zero_outputs_balanced_probabilities(self) -> None:
        result, _ = run_and_reconstruct(
            make_one_qubit_gate_config("H", environment=make_ideal_environment())
        )

        self.assertAlmostEqual(result.output_probabilities["0"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.fidelity[-1], 1.0, delta=1e-10)
        self.assertAlmostEqual(result.purity[-1], 1.0, delta=1e-10)

    def test_x_on_zero_outputs_one(self) -> None:
        result, _ = run_and_reconstruct(
            make_one_qubit_gate_config("X", environment=make_ideal_environment())
        )

        self.assertAlmostEqual(result.output_probabilities["0"], 0.0, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["1"], 1.0, delta=1e-10)
        self.assertAlmostEqual(result.fidelity[-1], 1.0, delta=1e-10)
        self.assertAlmostEqual(result.purity[-1], 1.0, delta=1e-10)

    def test_z_on_plus_gives_minus_density_matrix(self) -> None:
        result, density = run_and_reconstruct(
            make_one_qubit_gate_config(
                "Z",
                environment=make_ideal_environment(),
                initial_state="+",
            )
        )

        expected = (
            (0.5 + 0.0j, -0.5 + 0.0j),
            (-0.5 + 0.0j, 0.5 + 0.0j),
        )
        for row in range(2):
            for column in range(2):
                self.assertAlmostEqual(
                    density[row][column].real,
                    expected[row][column].real,
                    delta=1e-10,
                )
                self.assertAlmostEqual(density[row][column].imag, 0.0, delta=1e-10)
        self.assertAlmostEqual(result.fidelity[-1], 1.0, delta=1e-10)
        self.assertAlmostEqual(result.purity[-1], 1.0, delta=1e-10)

    def test_bell_circuit_outputs_00_and_11(self) -> None:
        result, _ = run_and_reconstruct(make_bell_config(make_ideal_environment()))

        self.assertAlmostEqual(result.output_probabilities["00"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["11"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["01"], 0.0, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["10"], 0.0, delta=1e-10)
        self.assertAlmostEqual(result.fidelity[-1], 1.0, delta=1e-10)
        self.assertAlmostEqual(result.purity[-1], 1.0, delta=1e-10)


if __name__ == "__main__":
    unittest.main()
