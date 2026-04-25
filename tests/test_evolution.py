import unittest

from core.circuit import h_gate_hamiltonian, initial_zero_density_matrix
from core.evolution import DEFAULT_TIME_STEPS, simulate_once


class CircuitPrimitivesTest(unittest.TestCase):
    def test_h_gate_hamiltonian_is_one_qubit_hermitian_operator(self) -> None:
        hamiltonian = h_gate_hamiltonian()

        self.assertEqual(_matrix_shape(hamiltonian), (2, 2))
        self.assertTrue(_is_hermitian(hamiltonian))

    def test_initial_state_is_zero_density_matrix(self) -> None:
        rho0 = initial_zero_density_matrix()

        self.assertEqual(_matrix_shape(rho0), (2, 2))
        self.assertTrue(_is_hermitian(rho0))
        self.assertAlmostEqual(_trace(rho0).real, 1.0)
        self.assertAlmostEqual(rho0[0][0].real, 1.0)
        self.assertAlmostEqual(rho0[1][1].real, 0.0)


class EvolutionTest(unittest.TestCase):
    def test_simulate_once_returns_time_and_state_series(self) -> None:
        times, states = simulate_once(
            temperature_kelvin=0.02,
            magnetic_field_tesla=0.0,
            noise_level=0.01,
        )

        self.assertEqual(len(times), DEFAULT_TIME_STEPS)
        self.assertEqual(len(states), DEFAULT_TIME_STEPS)
        self.assertAlmostEqual(times[0], 0.0)
        self.assertGreater(times[-1], times[0])
        self.assertTrue(all(later > earlier for earlier, later in zip(times, times[1:])))

        for state in states:
            self.assertEqual(_matrix_shape(state), (2, 2))
            self.assertTrue(_is_hermitian(state))
            self.assertAlmostEqual(_trace(state).real, 1.0, places=6)


def _matrix_shape(matrix: tuple[tuple[complex, ...], ...]) -> tuple[int, int]:
    return len(matrix), len(matrix[0])


def _is_hermitian(matrix: tuple[tuple[complex, ...], ...]) -> bool:
    tolerance = 1e-9
    return all(
        abs(matrix[row][column] - matrix[column][row].conjugate()) < tolerance
        for row in range(2)
        for column in range(2)
    )


def _trace(matrix: tuple[tuple[complex, ...], ...]) -> complex:
    return matrix[0][0] + matrix[1][1]


if __name__ == "__main__":
    unittest.main()
