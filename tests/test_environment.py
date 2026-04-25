import unittest

from core.environment import (
    load_reference_profile,
    map_environment_to_t1_t2,
    t1_t2_to_gammas,
)


class EnvironmentMappingTest(unittest.TestCase):
    def test_zero_environment_uses_reference_lifetimes(self) -> None:
        reference = load_reference_profile()

        t1, t2 = map_environment_to_t1_t2(
            temperature_kelvin=0.0,
            magnetic_field_tesla=0.0,
            noise_level=0.0,
            reference_profile=reference,
        )

        self.assertAlmostEqual(t1, reference["T1_ref_us"])
        self.assertAlmostEqual(t2, reference["T2_ref_us"])

    def test_harsher_environment_shortens_lifetimes(self) -> None:
        quiet_t1, quiet_t2 = map_environment_to_t1_t2(
            temperature_kelvin=0.02,
            magnetic_field_tesla=0.0,
            noise_level=0.0,
        )
        noisy_t1, noisy_t2 = map_environment_to_t1_t2(
            temperature_kelvin=0.02,
            magnetic_field_tesla=0.2,
            noise_level=0.4,
        )

        self.assertLess(noisy_t1, quiet_t1)
        self.assertLess(noisy_t2, quiet_t2)

    def test_outputs_stay_physically_valid(self) -> None:
        t1, t2 = map_environment_to_t1_t2(
            temperature_kelvin=0.04,
            magnetic_field_tesla=-0.2,
            noise_level=0.5,
        )

        self.assertGreater(t1, 0.0)
        self.assertGreater(t2, 0.0)
        self.assertLessEqual(t2, 2.0 * t1)

    def test_t1_t2_to_gammas_returns_relaxation_and_dephasing_rates(self) -> None:
        gamma1, gammaphi = t1_t2_to_gammas(120.0, 90.0)

        self.assertAlmostEqual(gamma1, 1.0 / 120.0)
        self.assertAlmostEqual(gammaphi, (1.0 / 90.0) - (0.5 / 120.0))
        self.assertGreater(gamma1, 0.0)
        self.assertGreaterEqual(gammaphi, 0.0)

    def test_negative_temperature_or_noise_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            map_environment_to_t1_t2(-0.01, 0.0, 0.0)

        with self.assertRaises(ValueError):
            map_environment_to_t1_t2(0.02, 0.0, -0.01)


if __name__ == "__main__":
    unittest.main()
