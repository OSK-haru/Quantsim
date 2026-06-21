import unittest

from core.io.config_io import config_from_dict, config_to_dict
from core.physical_environment import (
    INPUT_MODE_NORMALIZED,
    INPUT_MODE_PHYSICAL,
    NORMALIZED_ENVIRONMENT_MODEL,
    PHYSICAL_ENVIRONMENT_MODEL,
    UNIFIED_ENVIRONMENT_MODEL,
)
from core.results import EnvironmentConfig, SimulationConfig


class EnvironmentMigrationTest(unittest.TestCase):
    def test_legacy_normalized_environment_config_migrates(self) -> None:
        environment = EnvironmentConfig.from_dict({
            "environment_model": NORMALIZED_ENVIRONMENT_MODEL,
            "temperature": 0.2,
            "magnetic_field": 0.3,
            "noise_level": 0.4,
        })

        self.assertEqual(environment.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(environment.input_mode, INPUT_MODE_NORMALIZED)
        self.assertEqual(environment.temperature, 0.2)
        self.assertEqual(environment.magnetic_field, 0.3)
        self.assertEqual(environment.noise_level, 0.4)

    def test_legacy_physical_environment_config_migrates(self) -> None:
        environment = EnvironmentConfig.from_dict({
            "environment_model": PHYSICAL_ENVIRONMENT_MODEL,
            "device_quality": 0.7,
            "temperature_mk": 25.0,
            "flux_noise_phi0": 5e-6,
            "qubit_frequency_ghz": 4.8,
        })

        self.assertEqual(environment.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(environment.input_mode, INPUT_MODE_PHYSICAL)
        self.assertEqual(environment.device_quality, 0.7)
        self.assertEqual(environment.temperature_mk, 25.0)
        self.assertEqual(environment.flux_noise_phi0, 5e-6)
        self.assertEqual(environment.qubit_frequency_ghz, 4.8)

    def test_schema_1_0_envelope_loads_and_migrates(self) -> None:
        encoded = config_to_dict(SimulationConfig())
        encoded["schema_version"] = "1.0"
        encoded["environment"] = {
            "environment_model": NORMALIZED_ENVIRONMENT_MODEL,
            "temperature": 0.2,
            "magnetic_field": 0.1,
            "noise_level": 0.3,
        }

        config = config_from_dict(encoded)

        self.assertEqual(config.environment.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(config.environment.input_mode, INPUT_MODE_NORMALIZED)

    def test_schema_1_1_envelope_loads(self) -> None:
        encoded = config_to_dict(SimulationConfig(
            environment=EnvironmentConfig(
                input_mode=INPUT_MODE_PHYSICAL,
                device_quality=0.6,
                temperature_mk=40.0,
                flux_noise_phi0=2e-6,
                qubit_frequency_ghz=5.2,
            )
        ))

        config = config_from_dict(encoded)

        self.assertEqual(encoded["schema_version"], "1.1")
        self.assertEqual(config.environment.model, UNIFIED_ENVIRONMENT_MODEL)
        self.assertEqual(config.environment.input_mode, INPUT_MODE_PHYSICAL)


if __name__ == "__main__":
    unittest.main()
