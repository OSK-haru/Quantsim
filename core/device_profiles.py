"""Educational device profiles for expert physical-unit models."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GenericTransmonProfile:
    """Generic transmon-inspired profile, not a calibrated hardware model."""

    qubit_frequency_ghz: float = 5.0
    anharmonicity_mhz: float = -250.0
    t1_min_us: float = 1.0
    t1_max_us: float = 100.0
    tphi_min_us: float = 1.0
    tphi_max_us: float = 100.0
    default_temperature_mk: float = 15.0
    flux_noise_min_phi0: float = 1e-6
    flux_noise_max_phi0: float = 1e-5
    flux_noise_gamma_phi_per_us_at_max: float = 0.05
