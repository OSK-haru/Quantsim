"""Frozen internal-step policy for Pulse Baseline A."""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from core.pulse_envelopes import GaussianPulseEnvelope, PulseEnvelope
from core.pulse_open_system import PulseDissipationRates
from core.pulse_qutrit_contract import qutrit_rotating_frame_hamiltonian
from core.pulse_qutrit_open_system import QutritDissipationRates


PULSE_BASELINE_A_EPSILON_H = 0.05
PULSE_BASELINE_A_EPSILON_D = 0.05
PULSE_BASELINE_A_SAMPLES_PER_SIGMA = 20

PULSE_QUTRIT_EPSILON_H = 0.02
PULSE_QUTRIT_EPSILON_D = 0.02
PULSE_QUTRIT_SAMPLES_PER_SIGMA = 32
PULSE_QUTRIT_MAX_INTERNAL_STEPS = 25_000
PULSE_QUTRIT_STEP_POLICY_ID = "qutrit_fixed_rk4_v1"


@dataclass(frozen=True)
class PulseStepControls:
    max_internal_step_us: float
    hamiltonian_gap_rad_per_us: float
    dissipative_scale_per_us: float
    h_times_hamiltonian_gap: float
    h_times_dissipative_scale: float
    h_over_sigma: float | None

    def to_dict(self) -> dict[str, float | None]:
        return {
            "max_internal_step_us": self.max_internal_step_us,
            "hamiltonian_gap_rad_per_us": (
                self.hamiltonian_gap_rad_per_us
            ),
            "dissipative_scale_per_us": self.dissipative_scale_per_us,
            "h_times_hamiltonian_gap": self.h_times_hamiltonian_gap,
            "h_times_dissipative_scale": (
                self.h_times_dissipative_scale
            ),
            "h_over_sigma": self.h_over_sigma,
        }


@dataclass(frozen=True)
class QutritPulseStepPolicy:
    """Auditable fixed-step policy for the non-DRAG qutrit path."""

    policy_id: str
    hamiltonian_scale_max_rad_per_us: float
    dissipation_scale_per_us: float
    hamiltonian_step_limit_us: float | None
    dissipation_step_limit_us: float | None
    envelope_step_limit_us: float | None
    duration_step_limit_us: float
    selected_internal_step_cap_us: float
    step_limit_reason: str
    h_times_hamiltonian_scale: float
    h_times_dissipation_scale: float
    h_over_sigma: float | None
    drag_beta_us: float
    maximum_drive_magnitude_rad_per_us: float
    maximum_drag_derivative_rad_per_us2: float
    estimated_internal_step_count: int
    maximum_internal_step_count: int
    within_work_budget: bool

    def to_dict(self) -> dict[str, float | int | bool | str | None]:
        return {
            "policy_id": self.policy_id,
            "hamiltonian_scale_max_rad_per_us": (
                self.hamiltonian_scale_max_rad_per_us
            ),
            "dissipation_scale_per_us": self.dissipation_scale_per_us,
            "hamiltonian_step_limit_us": self.hamiltonian_step_limit_us,
            "dissipation_step_limit_us": self.dissipation_step_limit_us,
            "envelope_step_limit_us": self.envelope_step_limit_us,
            "duration_step_limit_us": self.duration_step_limit_us,
            "selected_internal_step_cap_us": (
                self.selected_internal_step_cap_us
            ),
            "step_limit_reason": self.step_limit_reason,
            "h_times_hamiltonian_scale": (
                self.h_times_hamiltonian_scale
            ),
            "h_times_dissipation_scale": (
                self.h_times_dissipation_scale
            ),
            "h_over_sigma": self.h_over_sigma,
            "drag_beta_us": self.drag_beta_us,
            "maximum_drive_magnitude_rad_per_us": (
                self.maximum_drive_magnitude_rad_per_us
            ),
            "maximum_drag_derivative_rad_per_us2": (
                self.maximum_drag_derivative_rad_per_us2
            ),
            "estimated_internal_step_count": (
                self.estimated_internal_step_count
            ),
            "maximum_internal_step_count": (
                self.maximum_internal_step_count
            ),
            "within_work_budget": self.within_work_budget,
        }


def pulse_step_controls(
    envelope: PulseEnvelope,
    detuning_rad_per_us: float,
    rates: PulseDissipationRates,
    max_internal_step_us: float,
) -> PulseStepControls:
    """Return the dimensionless controls for one pulse segment."""

    step = _positive_finite(
        max_internal_step_us,
        "max_internal_step_us",
    )
    detuning = _finite(
        detuning_rad_per_us,
        "detuning_rad_per_us",
    )
    peak_amplitude = abs(
        float(getattr(envelope, "peak_amplitude_rad_per_us"))
    )
    hamiltonian_gap = math.hypot(peak_amplitude, detuning)
    dissipative_scale = (
        rates.gamma_down_per_us
        + rates.gamma_up_per_us
        + rates.gamma_phi_per_us
    )
    h_over_sigma = None
    if isinstance(envelope, GaussianPulseEnvelope):
        h_over_sigma = step / envelope.sigma_us
    return PulseStepControls(
        max_internal_step_us=step,
        hamiltonian_gap_rad_per_us=hamiltonian_gap,
        dissipative_scale_per_us=dissipative_scale,
        h_times_hamiltonian_gap=step * hamiltonian_gap,
        h_times_dissipative_scale=step * dissipative_scale,
        h_over_sigma=h_over_sigma,
    )


def recommended_max_step_us(
    envelope: PulseEnvelope,
    detuning_rad_per_us: float,
    rates: PulseDissipationRates,
    *,
    epsilon_h: float = PULSE_BASELINE_A_EPSILON_H,
    epsilon_d: float = PULSE_BASELINE_A_EPSILON_D,
    samples_per_sigma: int = PULSE_BASELINE_A_SAMPLES_PER_SIGMA,
) -> float:
    """Return the most restrictive Baseline A internal-step limit."""

    if samples_per_sigma <= 0:
        raise ValueError("samples_per_sigma must be positive")
    controls = pulse_step_controls(
        envelope,
        detuning_rad_per_us,
        rates,
        1.0,
    )
    limits = []
    if controls.hamiltonian_gap_rad_per_us > 0.0:
        limits.append(
            _positive_finite(epsilon_h, "epsilon_h")
            / controls.hamiltonian_gap_rad_per_us
        )
    if controls.dissipative_scale_per_us > 0.0:
        limits.append(
            _positive_finite(epsilon_d, "epsilon_d")
            / controls.dissipative_scale_per_us
        )
    if isinstance(envelope, GaussianPulseEnvelope):
        limits.append(envelope.sigma_us / samples_per_sigma)
    if not limits:
        return envelope.duration_us
    return min(envelope.duration_us, *limits)


def qutrit_hamiltonian_spectral_diameter_rad_per_us(
    envelope: PulseEnvelope,
    detuning_rad_per_us: float,
    anharmonicity_rad_per_us: float,
    *,
    drag_beta_us: float = 0.0,
) -> float:
    """Return the maximum qutrit Hamiltonian eigenvalue span.

    For the fixed-phase non-DRAG Hamiltonian, the spectrum depends on the
    drive magnitude but not its phase. Gaussian and square envelopes attain
    their extrema at zero drive or at the declared peak amplitude.
    """

    detuning = _finite(
        detuning_rad_per_us,
        "detuning_rad_per_us",
    )
    anharmonicity = _finite(
        anharmonicity_rad_per_us,
        "anharmonicity_rad_per_us",
    )
    peak = abs(_finite(
        getattr(envelope, "peak_amplitude_rad_per_us"),
        "peak_amplitude_rad_per_us",
    ))
    beta = _finite(drag_beta_us, "drag_beta_us")
    if beta != 0.0:
        if not isinstance(envelope, GaussianPulseEnvelope):
            raise ValueError(
                "nonzero drag_beta_us requires a Gaussian pulse"
            )
        peak = envelope.maximum_drag_drive_magnitude_rad_per_us(beta)
    return max(
        _qutrit_hamiltonian_spectral_diameter(
            detuning,
            anharmonicity,
            amplitude,
        )
        for amplitude in (0.0, peak)
    )


def qutrit_dissipative_scale_per_us(
    rates: QutritDissipationRates,
) -> float:
    """Return the conservative qutrit dissipative scale from B-3."""

    return (
        rates.gamma_10_down_per_us
        + rates.gamma_01_up_per_us
        + rates.gamma_21_down_per_us
        + rates.gamma_12_up_per_us
        + 4.0 * rates.gamma_phi_adjacent_per_us
    )


def recommended_qutrit_step_policy(
    envelope: PulseEnvelope,
    detuning_rad_per_us: float,
    anharmonicity_rad_per_us: float,
    rates: QutritDissipationRates,
    total_simulation_time_us: float,
    *,
    epsilon_h: float = PULSE_QUTRIT_EPSILON_H,
    epsilon_d: float = PULSE_QUTRIT_EPSILON_D,
    samples_per_sigma: int = PULSE_QUTRIT_SAMPLES_PER_SIGMA,
    maximum_internal_step_count: int = (
        PULSE_QUTRIT_MAX_INTERNAL_STEPS
    ),
    drag_beta_us: float = 0.0,
) -> QutritPulseStepPolicy:
    """Return the non-DRAG qutrit fixed-step limit and cost estimate."""

    total_duration = _positive_finite(
        total_simulation_time_us,
        "total_simulation_time_us",
    )
    if envelope.duration_us > total_duration:
        raise ValueError(
            "pulse duration must not exceed total_simulation_time_us"
        )
    if samples_per_sigma <= 0:
        raise ValueError("samples_per_sigma must be positive")
    if maximum_internal_step_count <= 0:
        raise ValueError(
            "maximum_internal_step_count must be positive"
        )

    hamiltonian_scale = (
        qutrit_hamiltonian_spectral_diameter_rad_per_us(
            envelope,
            detuning_rad_per_us,
            anharmonicity_rad_per_us,
            drag_beta_us=drag_beta_us,
        )
    )
    dissipation_scale = qutrit_dissipative_scale_per_us(rates)
    limits: list[tuple[str, float]] = [
        ("segment_duration", envelope.duration_us),
    ]
    hamiltonian_limit = None
    if hamiltonian_scale > 0.0:
        hamiltonian_limit = (
            _positive_finite(epsilon_h, "epsilon_h")
            / hamiltonian_scale
        )
        limits.append(("hamiltonian_spectral_diameter", hamiltonian_limit))
    dissipation_limit = None
    if dissipation_scale > 0.0:
        dissipation_limit = (
            _positive_finite(epsilon_d, "epsilon_d")
            / dissipation_scale
        )
        limits.append(("qutrit_dissipation", dissipation_limit))
    envelope_limit = None
    h_over_sigma = None
    beta = _finite(drag_beta_us, "drag_beta_us")
    maximum_drive_magnitude = abs(float(
        getattr(envelope, "peak_amplitude_rad_per_us")
    ))
    maximum_drag_derivative = 0.0
    if beta != 0.0:
        if not isinstance(envelope, GaussianPulseEnvelope):
            raise ValueError(
                "nonzero drag_beta_us requires a Gaussian pulse"
            )
        maximum_drive_magnitude = (
            envelope.maximum_drag_drive_magnitude_rad_per_us(beta)
        )
        maximum_drag_derivative = (
            envelope.maximum_abs_derivative_rad_per_us2
        )
    if isinstance(envelope, GaussianPulseEnvelope):
        envelope_limit = envelope.sigma_us / samples_per_sigma
        limits.append(("gaussian_envelope", envelope_limit))

    reason, selected_step = min(limits, key=lambda item: item[1])
    if isinstance(envelope, GaussianPulseEnvelope):
        h_over_sigma = selected_step / envelope.sigma_us
    estimated_steps = math.ceil(
        envelope.duration_us / selected_step
    )
    idle_duration = total_duration - envelope.duration_us
    if idle_duration > 0.0:
        estimated_steps += math.ceil(idle_duration / selected_step)

    return QutritPulseStepPolicy(
        policy_id=PULSE_QUTRIT_STEP_POLICY_ID,
        hamiltonian_scale_max_rad_per_us=hamiltonian_scale,
        dissipation_scale_per_us=dissipation_scale,
        hamiltonian_step_limit_us=hamiltonian_limit,
        dissipation_step_limit_us=dissipation_limit,
        envelope_step_limit_us=envelope_limit,
        duration_step_limit_us=envelope.duration_us,
        selected_internal_step_cap_us=selected_step,
        step_limit_reason=reason,
        h_times_hamiltonian_scale=selected_step * hamiltonian_scale,
        h_times_dissipation_scale=selected_step * dissipation_scale,
        h_over_sigma=h_over_sigma,
        drag_beta_us=beta,
        maximum_drive_magnitude_rad_per_us=maximum_drive_magnitude,
        maximum_drag_derivative_rad_per_us2=maximum_drag_derivative,
        estimated_internal_step_count=estimated_steps,
        maximum_internal_step_count=maximum_internal_step_count,
        within_work_budget=(
            estimated_steps <= maximum_internal_step_count
        ),
    )


def _qutrit_hamiltonian_spectral_diameter(
    detuning_rad_per_us: float,
    anharmonicity_rad_per_us: float,
    amplitude_rad_per_us: float,
) -> float:
    hamiltonian = qutrit_rotating_frame_hamiltonian(
        detuning_rad_per_us,
        anharmonicity_rad_per_us,
        amplitude_rad_per_us,
        0.0,
    )
    eigenvalues = np.linalg.eigvalsh(
        np.asarray(hamiltonian, dtype=np.complex128)
    )
    return float(eigenvalues[-1] - eigenvalues[0])


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
