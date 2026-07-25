"""Serializable pulse envelopes and two-level rotating-frame Hamiltonians."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Protocol

from core.gates import Matrix, add, scale
from core.pulse_contract import SIGMA_X, SIGMA_Y, SIGMA_Z


class PulseEnvelope(Protocol):
    """Real-valued control envelope in rad/us with finite active support."""

    @property
    def duration_us(self) -> float:
        """Return the active pulse duration."""

    @property
    def pulse_area_rad(self) -> float:
        """Return the finite-support integral of the envelope."""

    def amplitude_rad_per_us(self, local_time_us: float) -> float:
        """Return the envelope value at local time."""

    def integrated_area_rad(self, local_time_us: float) -> float:
        """Return the finite-support area accumulated through local time."""


@dataclass(frozen=True)
class SquarePulseEnvelope:
    peak_amplitude_rad_per_us: float
    duration_us: float

    def __post_init__(self) -> None:
        _finite(self.peak_amplitude_rad_per_us, "peak_amplitude_rad_per_us")
        _positive_finite(self.duration_us, "duration_us")

    @classmethod
    def from_target_rotation_angle(
        cls,
        target_rotation_angle_rad: float,
        duration_us: float,
    ) -> "SquarePulseEnvelope":
        angle = _finite(
            target_rotation_angle_rad,
            "target_rotation_angle_rad",
        )
        duration = _positive_finite(duration_us, "duration_us")
        return cls(
            peak_amplitude_rad_per_us=angle / duration,
            duration_us=duration,
        )

    @property
    def pulse_area_rad(self) -> float:
        return self.peak_amplitude_rad_per_us * self.duration_us

    def amplitude_rad_per_us(self, local_time_us: float) -> float:
        time_us = _finite(local_time_us, "local_time_us")
        if 0.0 <= time_us <= self.duration_us:
            return self.peak_amplitude_rad_per_us
        return 0.0

    def integrated_area_rad(self, local_time_us: float) -> float:
        time_us = _finite(local_time_us, "local_time_us")
        active_time = min(self.duration_us, max(0.0, time_us))
        return self.peak_amplitude_rad_per_us * active_time


@dataclass(frozen=True)
class GaussianPulseEnvelope:
    peak_amplitude_rad_per_us: float
    sigma_us: float
    truncation_sigma: float

    def __post_init__(self) -> None:
        _finite(self.peak_amplitude_rad_per_us, "peak_amplitude_rad_per_us")
        _positive_finite(self.sigma_us, "sigma_us")
        _positive_finite(self.truncation_sigma, "truncation_sigma")

    @classmethod
    def from_target_rotation_angle(
        cls,
        target_rotation_angle_rad: float,
        sigma_us: float,
        truncation_sigma: float,
    ) -> "GaussianPulseEnvelope":
        angle = _finite(
            target_rotation_angle_rad,
            "target_rotation_angle_rad",
        )
        sigma = _positive_finite(sigma_us, "sigma_us")
        truncation = _positive_finite(
            truncation_sigma,
            "truncation_sigma",
        )
        normalization = finite_gaussian_area_factor(sigma, truncation)
        return cls(
            peak_amplitude_rad_per_us=angle / normalization,
            sigma_us=sigma,
            truncation_sigma=truncation,
        )

    @property
    def duration_us(self) -> float:
        return 2.0 * self.truncation_sigma * self.sigma_us

    @property
    def center_us(self) -> float:
        return self.truncation_sigma * self.sigma_us

    @property
    def pulse_area_rad(self) -> float:
        return (
            self.peak_amplitude_rad_per_us
            * finite_gaussian_area_factor(
                self.sigma_us,
                self.truncation_sigma,
            )
        )

    def amplitude_rad_per_us(self, local_time_us: float) -> float:
        time_us = _finite(local_time_us, "local_time_us")
        if time_us < 0.0 or time_us > self.duration_us:
            return 0.0
        normalized = (time_us - self.center_us) / self.sigma_us
        return self.peak_amplitude_rad_per_us * math.exp(
            -0.5 * normalized * normalized
        )

    def derivative_rad_per_us2(self, local_time_us: float) -> float:
        """Return the analytic derivative inside the inclusive support.

        The truncated Gaussian and its derivative are evaluated at both
        endpoints. Both are zero strictly outside the finite support, so the
        existing hard cutoff remains explicit rather than being smoothed.
        """

        time_us = _finite(local_time_us, "local_time_us")
        if time_us < 0.0 or time_us > self.duration_us:
            return 0.0
        normalized = (time_us - self.center_us) / self.sigma_us
        return (
            -normalized
            * self.amplitude_rad_per_us(time_us)
            / self.sigma_us
        )

    @property
    def maximum_abs_derivative_rad_per_us2(self) -> float:
        normalized = min(1.0, self.truncation_sigma)
        return (
            abs(self.peak_amplitude_rad_per_us)
            * normalized
            * math.exp(-0.5 * normalized * normalized)
            / self.sigma_us
        )

    def maximum_drag_drive_magnitude_rad_per_us(
        self,
        drag_beta_us: float,
    ) -> float:
        """Return max sqrt(Omega_x^2 + (beta dOmega_x/dt)^2)."""

        beta = abs(_finite(drag_beta_us, "drag_beta_us"))
        ratio = beta / self.sigma_us
        candidates = [0.0, self.truncation_sigma]
        if ratio > 1.0:
            stationary = math.sqrt(1.0 - 1.0 / (ratio * ratio))
            if stationary <= self.truncation_sigma:
                candidates.append(stationary)
        return max(
            abs(self.peak_amplitude_rad_per_us)
            * math.exp(-0.5 * normalized * normalized)
            * math.sqrt(1.0 + (ratio * normalized) ** 2)
            for normalized in candidates
        )

    def integrated_area_rad(self, local_time_us: float) -> float:
        time_us = _finite(local_time_us, "local_time_us")
        if time_us <= 0.0:
            return 0.0
        if time_us >= self.duration_us:
            return self.pulse_area_rad

        denominator = math.sqrt(2.0) * self.sigma_us
        lower = -self.center_us / denominator
        upper = (time_us - self.center_us) / denominator
        return (
            self.peak_amplitude_rad_per_us
            * self.sigma_us
            * math.sqrt(math.pi / 2.0)
            * (math.erf(upper) - math.erf(lower))
        )


@dataclass(frozen=True)
class TwoLevelPulseHamiltonian:
    envelope: PulseEnvelope
    phase_rad: float = 0.0
    detuning_rad_per_us: float = 0.0

    def __post_init__(self) -> None:
        _finite(self.phase_rad, "phase_rad")
        _finite(self.detuning_rad_per_us, "detuning_rad_per_us")

    def evaluate(self, local_time_us: float) -> Matrix:
        amplitude = self.envelope.amplitude_rad_per_us(local_time_us)
        x_coefficient = 0.5 * amplitude * math.cos(self.phase_rad)
        y_coefficient = 0.5 * amplitude * math.sin(self.phase_rad)
        z_coefficient = 0.5 * self.detuning_rad_per_us
        return add(
            scale(x_coefficient, SIGMA_X),
            scale(y_coefficient, SIGMA_Y),
            scale(z_coefficient, SIGMA_Z),
        )


def finite_gaussian_area_factor(
    sigma_us: float,
    truncation_sigma: float,
) -> float:
    """Return the finite integral for a unit-peak truncated Gaussian."""

    sigma = _positive_finite(sigma_us, "sigma_us")
    truncation = _positive_finite(
        truncation_sigma,
        "truncation_sigma",
    )
    return (
        sigma
        * math.sqrt(2.0 * math.pi)
        * math.erf(truncation / math.sqrt(2.0))
    )


def _positive_finite(value: float, field_name: str) -> float:
    converted = _finite(value, field_name)
    if converted <= 0.0:
        raise ValueError(f"{field_name} must be greater than 0")
    return converted


def _finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted):
        raise ValueError(f"{field_name} must be finite")
    return converted
