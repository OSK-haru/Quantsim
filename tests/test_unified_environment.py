import math
import unittest

from core.physical_environment import (
    INPUT_MODE_NORMALIZED,
    INPUT_MODE_PHYSICAL,
    UNIFIED_ENVIRONMENT_MODEL,
    baseline_profile_noise_info,
    compute_environment_rates,
    device_quality_mapping_info,
    map_normalized_to_physical,
)
from core.results import EnvironmentConfig


class UnifiedEnvironmentTest(unittest.TestCase):
    def test_normalized_input_maps_to_finite_physical_inputs(self) -> None:
        environment = EnvironmentConfig(
            input_mode=INPUT_MODE_NORMALIZED,
            temperature=0.5,
            magnetic_field=0.5,
            noise_level=0.25,
        )

        physical = map_normalized_to_physical(environment)

        self.assertTrue(math.isfinite(physical.temperature_mk))
        self.assertTrue(math.isfinite(physical.flux_noise_phi0))
        self.assertTrue(math.isfinite(physical.device_quality))
        self.assertTrue(math.isfinite(physical.qubit_frequency_ghz))

    def test_normalized_mapping_is_monotonic(self) -> None:
        low = map_normalized_to_physical(EnvironmentConfig(
            temperature=0.1,
            magnetic_field=0.1,
            noise_level=0.1,
        ))
        high = map_normalized_to_physical(EnvironmentConfig(
            temperature=0.9,
            magnetic_field=0.9,
            noise_level=0.9,
        ))

        self.assertGreater(high.temperature_mk, low.temperature_mk)
        self.assertGreater(high.flux_noise_phi0, low.flux_noise_phi0)
        self.assertLess(high.device_quality, low.device_quality)

    def test_physical_input_computes_finite_rates(self) -> None:
        rates = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            device_quality=0.8,
            temperature_mk=15.0,
            flux_noise_phi0=1e-6,
            qubit_frequency_ghz=5.0,
        ))

        self.assertEqual(rates.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(rates.input_mode, INPUT_MODE_PHYSICAL)
        self.assertGreaterEqual(rates.gamma_down_per_us, rates.gamma_up_per_us)
        self.assertGreaterEqual(rates.gamma_phi_per_us, 0.0)
        for value in (
            rates.n_th,
            rates.gamma_down_per_us,
            rates.gamma_up_per_us,
            rates.gamma_phi_per_us,
            rates.t1_effective_us,
            rates.t2_effective_us,
        ):
            self.assertTrue(math.isfinite(value))

    def test_nth_increases_with_temperature(self) -> None:
        low = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            temperature_mk=15.0,
        ))
        high = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            temperature_mk=100.0,
        ))

        self.assertGreater(high.n_th, low.n_th)

    def test_zero_thermal_and_flux_inputs_still_have_profile_baseline_rates(self) -> None:
        rates = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            device_quality=1.0,
            temperature_mk=0.0,
            flux_noise_phi0=0.0,
            t1_max_us=100.0,
            tphi_max_us=100.0,
        ))

        self.assertEqual(rates.gamma_up_per_us, 0.0)
        self.assertEqual(rates.gamma_phi_flux_per_us, 0.0)
        self.assertGreater(rates.gamma_down_per_us, 0.0)
        self.assertGreater(rates.gamma_phi_per_us, 0.0)
        self.assertIsNotNone(baseline_profile_noise_info(rates))

    def test_device_quality_zero_uses_profile_minimum_not_maximum(self) -> None:
        rates = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            device_quality=0.0,
            temperature_mk=0.0,
            flux_noise_phi0=0.0,
            t1_max_us=10000.0,
            tphi_max_us=10000.0,
        ))

        self.assertAlmostEqual(rates.t1_base_us, 1.0)
        self.assertAlmostEqual(rates.tphi_base_us, 1.0)
        self.assertGreater(rates.gamma_down_per_us, 0.0)
        self.assertGreater(rates.gamma_phi_per_us, 0.0)
        self.assertIsNotNone(device_quality_mapping_info(rates))


if __name__ == "__main__":
    unittest.main()
