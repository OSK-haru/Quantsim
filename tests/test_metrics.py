import unittest

from core.circuit import initial_zero_density_matrix
from core.evolution import simulate_once
from core.metrics import (
    effective_time,
    fidelity_series,
    ideal_state_series,
    purity_series,
)


class MetricsTest(unittest.TestCase):
    def test_purity_series_uses_trace_of_rho_squared(self) -> None:
        pure_state = initial_zero_density_matrix()
        mixed_state = (
            (0.5 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 0.5 + 0.0j),
        )

        purities = purity_series([pure_state, mixed_state])

        self.assertAlmostEqual(purities[0], 1.0)
        self.assertAlmostEqual(purities[1], 0.5)

    def test_fidelity_series_uses_pure_reference_overlap(self) -> None:
        zero_state = initial_zero_density_matrix()
        one_state = (
            (0.0 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 1.0 + 0.0j),
        )

        fidelities = fidelity_series(
            states=[zero_state, one_state],
            ideal_states=[zero_state, zero_state],
        )

        self.assertAlmostEqual(fidelities[0], 1.0)
        self.assertAlmostEqual(fidelities[1], 0.0)

    def test_effective_time_uses_first_drop_below_reference_threshold(self) -> None:
        times = [0.0, 0.5, 1.0]
        fidelities = [1.0, 0.91, 0.89]

        self.assertEqual(effective_time(times, fidelities), 1.0)

    def test_effective_time_returns_last_time_if_threshold_is_not_crossed(self) -> None:
        times = [0.0, 0.5, 1.0]
        fidelities = [1.0, 0.95, 0.91]

        self.assertEqual(effective_time(times, fidelities), 1.0)

    def test_ideal_state_series_matches_noisy_trajectory_shape(self) -> None:
        times, noisy_states = simulate_once(
            temperature_kelvin=0.02,
            magnetic_field_tesla=0.0,
            noise_level=0.01,
        )

        ideal_states = ideal_state_series(times)
        fidelities = fidelity_series(noisy_states, ideal_states)
        purities = purity_series(noisy_states)

        self.assertEqual(len(ideal_states), len(times))
        self.assertEqual(len(fidelities), len(times))
        self.assertEqual(len(purities), len(times))
        self.assertAlmostEqual(fidelities[0], 1.0)
        self.assertAlmostEqual(purities[0], 1.0)


if __name__ == "__main__":
    unittest.main()
