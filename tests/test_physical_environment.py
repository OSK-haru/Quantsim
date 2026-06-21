import math
import unittest

from core.circuit_model import CircuitConfig
from core.io.config_io import config_from_dict, config_to_dict
from core.physical_environment import (
    INPUT_MODE_PHYSICAL,
    PHYSICAL_ENVIRONMENT_MODEL,
    UNIFIED_ENVIRONMENT_MODEL,
    compute_device_quality_times,
    compute_physical_rates,
    compute_thermal_occupation,
)
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation


class PhysicalEnvironmentTest(unittest.TestCase):
    def test_higher_device_quality_increases_base_times(self) -> None:
        low = compute_device_quality_times(0.1)
        high = compute_device_quality_times(0.9)

        self.assertGreater(high["t1_base_us"], low["t1_base_us"])
        self.assertGreater(high["tphi_base_us"], low["tphi_base_us"])

    def test_higher_temperature_increases_nth_and_gamma_up(self) -> None:
        low_nth = compute_thermal_occupation(15.0, 5.0)
        high_nth = compute_thermal_occupation(200.0, 5.0)
        low_rates = compute_physical_rates(_physical_environment(temperature_mk=15.0))
        high_rates = compute_physical_rates(_physical_environment(temperature_mk=200.0))

        self.assertGreater(high_nth, low_nth)
        self.assertGreater(
            high_rates["gamma_up_per_us"],
            low_rates["gamma_up_per_us"],
        )

    def test_higher_flux_noise_increases_gamma_phi(self) -> None:
        low = compute_physical_rates(_physical_environment(flux_noise_phi0=1e-6))
        high = compute_physical_rates(_physical_environment(flux_noise_phi0=1e-5))

        self.assertGreater(
            high["gamma_phi_flux_per_us"],
            low["gamma_phi_flux_per_us"],
        )
        self.assertGreater(
            high["gamma_phi_total_per_us"],
            low["gamma_phi_total_per_us"],
        )

    def test_physical_derived_values_are_finite(self) -> None:
        rates = compute_physical_rates(_physical_environment())

        for value in rates.values():
            self.assertTrue(math.isfinite(value))

    def test_physical_mode_run_simulation_works_for_one_qubit_h(self) -> None:
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=_physical_environment(),
            duration_us=2.0,
            time_steps=11,
            fidelity_threshold=0.9,
        )

        result = run_simulation(config)

        self.assertIsInstance(result, SimulationResult)
        self.assertEqual(len(result.times), config.time_steps)
        self.assertIn("gamma_down_per_us", result.derived_parameters)
        self.assertIn("gamma_up_per_us", result.derived_parameters)
        self.assertIn("gamma_phi_total_per_us", result.derived_parameters)
        self.assertIn("0", result.output_probabilities)
        self.assertIn("1", result.output_probabilities)

    def test_physical_config_round_trips_through_qscope_dict(self) -> None:
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=_physical_environment(
                device_quality=0.7,
                temperature_mk=25.0,
                flux_noise_phi0=5e-6,
                qubit_frequency_ghz=4.8,
            ),
        )

        encoded = config_to_dict(config)
        decoded = config_from_dict(encoded)

        self.assertEqual(decoded.environment.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(decoded.environment.input_mode, INPUT_MODE_PHYSICAL)
        self.assertEqual(decoded.environment.device_quality, 0.7)
        self.assertEqual(decoded.environment.temperature_mk, 25.0)
        self.assertEqual(decoded.environment.flux_noise_phi0, 5e-6)
        self.assertEqual(decoded.environment.qubit_frequency_ghz, 4.8)


def _physical_environment(**overrides) -> EnvironmentConfig:
    values = {
        "mode": "normalized",
        "environment_model": PHYSICAL_ENVIRONMENT_MODEL,
        "temperature": 0.1,
        "magnetic_field": 0.1,
        "noise_level": 0.1,
        "device_quality": 0.5,
        "temperature_mk": 15.0,
        "flux_noise_phi0": 1e-6,
        "qubit_frequency_ghz": 5.0,
    }
    values.update(overrides)
    return EnvironmentConfig(**values)


if __name__ == "__main__":
    unittest.main()
