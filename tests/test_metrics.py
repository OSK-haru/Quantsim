import unittest

from core.metrics import DEFAULT_FIDELITY_THRESHOLD, effective_time


class MetricsTest(unittest.TestCase):
    def test_effective_time_uses_first_drop_below_reference_threshold(self) -> None:
        times = [0.0, 0.5, 1.0]
        fidelities = [1.0, 0.91, 0.89]

        self.assertEqual(effective_time(times, fidelities), 1.0)

    def test_effective_time_returns_last_time_if_threshold_is_not_crossed(self) -> None:
        times = [0.0, 0.5, 1.0]
        fidelities = [1.0, 0.95, 0.91]

        self.assertEqual(effective_time(times, fidelities), 1.0)

    def test_default_threshold_is_explicit_constant(self) -> None:
        self.assertEqual(DEFAULT_FIDELITY_THRESHOLD, 0.9)

    def test_effective_time_rejects_mismatched_series(self) -> None:
        with self.assertRaises(ValueError):
            effective_time([0.0], [1.0, 0.9])


if __name__ == "__main__":
    unittest.main()
