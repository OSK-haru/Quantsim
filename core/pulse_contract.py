"""Fixed physical conventions for the experimental two-level pulse model."""

from __future__ import annotations

import math

from core.gates import I as IDENTITY_2
from core.gates import Matrix
from core.gates import X as SIGMA_X
from core.gates import Z as SIGMA_Z


Ket = tuple[complex, ...]

KET_ZERO: Ket = (1.0 + 0.0j, 0.0 + 0.0j)
KET_ONE: Ket = (0.0 + 0.0j, 1.0 + 0.0j)
SIGMA_Y: Matrix = (
    (0.0 + 0.0j, 0.0 - 1.0j),
    (0.0 + 1.0j, 0.0 + 0.0j),
)

PULSE_FRAME = "rotating"
PULSE_APPROXIMATION = "RWA"
PULSE_TIME_UNIT = "us"
PULSE_ANGULAR_FREQUENCY_UNIT = "rad/us"
PULSE_RATE_UNIT = "1/us"
DETUNING_CONVENTION = "drive_minus_qubit"
POSITIVE_PHASE_CONVENTION = "positive_x_toward_positive_y"


def mhz_to_rad_per_us(frequency_mhz: float) -> float:
    """Convert ordinary frequency in MHz to angular frequency in rad/us."""

    value = _finite_float(frequency_mhz, "frequency_mhz")
    return 2.0 * math.pi * value


def ghz_to_rad_per_us(frequency_ghz: float) -> float:
    """Convert ordinary frequency in GHz to angular frequency in rad/us."""

    value = _finite_float(frequency_ghz, "frequency_ghz")
    return mhz_to_rad_per_us(1000.0 * value)


def detuning_rad_per_us(
    drive_angular_frequency_rad_per_us: float,
    qubit_angular_frequency_rad_per_us: float,
) -> float:
    """Return detuning using Delta = omega_drive - omega_qubit."""

    drive = _finite_float(
        drive_angular_frequency_rad_per_us,
        "drive_angular_frequency_rad_per_us",
    )
    qubit = _finite_float(
        qubit_angular_frequency_rad_per_us,
        "qubit_angular_frequency_rad_per_us",
    )
    return drive - qubit


def _finite_float(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted):
        raise ValueError(f"{field_name} must be finite")
    return converted
