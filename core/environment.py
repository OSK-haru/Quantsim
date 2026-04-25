"""Environment-to-T1/T2 mapping for the 1-qubit MVP."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping


REFERENCE_PROFILE_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "reference_profile.json"
)


@dataclass
class EnvironmentProfile:
    """Minimal environmental inputs for the MVP."""

    temperature_kelvin: float = 0.02
    magnetic_field_tesla: float = 0.0
    noise_level: float = 0.01


def load_reference_profile(path: str | Path = REFERENCE_PROFILE_PATH) -> dict[str, Any]:
    """Load reference lifetimes and sensitivity coefficients from JSON."""

    with Path(path).open("r", encoding="utf-8") as profile_file:
        return json.load(profile_file)


def map_environment_to_t1_t2(
    temperature_kelvin: float,
    magnetic_field_tesla: float,
    noise_level: float,
    reference_profile: Mapping[str, Any] | None = None,
) -> tuple[float, float]:
    """Convert MVP environment inputs into positive T1 and T2 lifetimes.

    Higher temperature, stronger magnetic-field magnitude, and higher noise all
    shorten the reference lifetimes according to the JSON sensitivity values.
    """

    profile = (
        load_reference_profile()
        if reference_profile is None
        else reference_profile
    )
    sensitivity = profile["sensitivity"]

    temperature = _non_negative(temperature_kelvin, "temperature_kelvin")
    magnetic_field = abs(_finite(magnetic_field_tesla, "magnetic_field_tesla"))
    noise = _non_negative(noise_level, "noise_level")

    t1_ref_us = _positive(profile["T1_ref_us"], "T1_ref_us")
    t2_ref_us = _positive(profile["T2_ref_us"], "T2_ref_us")

    t1_pressure = 1.0 + (
        _non_negative(sensitivity["a_T"], "a_T") * temperature
        + _non_negative(sensitivity["a_B"], "a_B") * magnetic_field
        + _non_negative(sensitivity["a_n"], "a_n") * noise
    )
    t2_pressure = 1.0 + (
        _non_negative(sensitivity["b_T"], "b_T") * temperature
        + _non_negative(sensitivity["b_B"], "b_B") * magnetic_field
        + _non_negative(sensitivity["b_n"], "b_n") * noise
    )

    t1_us = t1_ref_us / t1_pressure
    t2_us = min(t2_ref_us / t2_pressure, 2.0 * t1_us)

    return t1_us, t2_us


def t1_t2_to_gammas(t1_us: float, t2_us: float) -> tuple[float, float]:
    """Convert T1/T2 lifetimes into relaxation and pure dephasing rates."""

    t1_us = _positive(t1_us, "t1_us")
    t2_us = _positive(t2_us, "t2_us")

    gamma1 = 1.0 / t1_us
    gammaphi = max((1.0 / t2_us) - (0.5 * gamma1), 0.0)

    return gamma1, gammaphi


def _finite(value: float, name: str) -> float:
    value = float(value)
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
    return value


def _non_negative(value: float, name: str) -> float:
    value = _finite(value, name)
    if value < 0.0:
        raise ValueError(f"{name} must be non-negative")
    return value


def _positive(value: float, name: str) -> float:
    value = _finite(value, name)
    if value <= 0.0:
        raise ValueError(f"{name} must be positive")
    return value
