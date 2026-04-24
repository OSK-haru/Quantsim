"""Environment parameter models for the Quantum-Sim MVP."""

from dataclasses import dataclass


@dataclass
class EnvironmentProfile:
    """Minimal environmental settings affecting circuit quality."""

    temperature_kelvin: float = 0.02
    magnetic_field_tesla: float = 0.0
    noise_level: float = 0.01
