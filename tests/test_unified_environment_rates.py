import math
import unittest

from core.physical_environment import (
    compute_environment_rates,
    map_normalized_to_physical,
)
from tests.physics_test_helpers import (
    make_ideal_environment,
    make_normalized_environment,
    make_physical_environment,
)


class UnifiedEnvironmentRatesTest(unittest.TestCase):
    def test_normalized_inputs_map_monotonically_to_physical_inputs(self) -> None:
        low = map_normalized_to_physical(make_normalized_environment(0.0, 0.0, 0.0))
        high = map_normalized_to_physical(make_normalized_environment(1.0, 1.0, 1.0))

        self.assertLess(low.temperature_mk, high.temperature_mk)
        self.assertLess(low.flux_noise_phi0, high.flux_noise_phi0)
        self.assertGreater(low.device_quality, high.device_quality)

    def test_higher_temperature_increases_thermal_occupation_and_gamma_up(self) -> None:
        cold = compute_environment_rates(
            make_physical_environment(temperature_mk=0.0)
        )
        hot = compute_environment_rates(
            make_physical_environment(temperature_mk=500.0)
        )

        self.assertLess(cold.n_th, hot.n_th)
        self.assertLess(cold.gamma_up_per_us, hot.gamma_up_per_us)

    def test_higher_flux_noise_increases_dephasing_rate(self) -> None:
        quiet = compute_environment_rates(
            make_physical_environment(flux_noise_phi0=0.0)
        )
        loud = compute_environment_rates(
            make_physical_environment(flux_noise_phi0=1e-5)
        )

        self.assertLess(quiet.gamma_phi_flux_per_us, loud.gamma_phi_flux_per_us)
        self.assertLess(quiet.gamma_phi_per_us, loud.gamma_phi_per_us)

    def test_higher_device_quality_increases_base_coherence_times(self) -> None:
        low_quality = compute_environment_rates(
            make_physical_environment(device_quality=0.0)
        )
        high_quality = compute_environment_rates(
            make_physical_environment(device_quality=1.0)
        )

        self.assertLess(low_quality.t1_base_us, high_quality.t1_base_us)
        self.assertLess(low_quality.tphi_base_us, high_quality.tphi_base_us)

    def test_profile_maxima_still_leave_baseline_rates_when_not_ideal(self) -> None:
        rates = compute_environment_rates(
            make_physical_environment(
                device_quality=1.0,
                temperature_mk=0.0,
                flux_noise_phi0=0.0,
                t1_max_us=100.0,
                tphi_max_us=100.0,
            )
        )

        self.assertGreater(rates.gamma_down_per_us, 0.0)
        self.assertGreater(rates.gamma_phi_per_us, 0.0)

    def test_ideal_reference_has_zero_environment_rates(self) -> None:
        rates = compute_environment_rates(make_ideal_environment())

        self.assertEqual(rates.gamma_down_per_us, 0.0)
        self.assertEqual(rates.gamma_up_per_us, 0.0)
        self.assertEqual(rates.gamma_phi_per_us, 0.0)
        self.assertTrue(math.isinf(rates.t1_effective_us))
        self.assertTrue(math.isinf(rates.t2_effective_us))


if __name__ == "__main__":
    unittest.main()
