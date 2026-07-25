"""Independent analytic references for pulse phase and detuning validation."""

from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from core.gates import Matrix
from core.pulse_envelopes import (
    SquarePulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_evolution import (
    TimeDependentEvolutionResult,
    evolve_time_dependent_segment,
)


def constant_drive_unitary(
    amplitude_rad_per_us: float,
    phase_rad: float,
    detuning_rad_per_us: float,
    time_us: float,
) -> Matrix:
    """Return exp(-i H t) for the constant rotating-frame Hamiltonian."""

    amplitude = _finite(amplitude_rad_per_us, "amplitude_rad_per_us")
    phase = _finite(phase_rad, "phase_rad")
    detuning = _finite(detuning_rad_per_us, "detuning_rad_per_us")
    duration = _non_negative_finite(time_us, "time_us")
    effective_rate = math.hypot(amplitude, detuning)
    if effective_rate == 0.0:
        return (
            (1.0 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 1.0 + 0.0j),
        )

    sine = math.sin(0.5 * effective_rate * duration)
    cosine = math.cos(0.5 * effective_rate * duration)
    nx = amplitude * math.cos(phase) / effective_rate
    ny = amplitude * math.sin(phase) / effective_rate
    nz = detuning / effective_rate
    return (
        (
            complex(cosine, -sine * nz),
            complex(-sine * ny, -sine * nx),
        ),
        (
            complex(sine * ny, -sine * nx),
            complex(cosine, sine * nz),
        ),
    )


def target_rotation_unitary(axis: str, angle_rad: float) -> Matrix:
    """Return an independent ideal Rx or Ry target unitary."""

    normalized_axis = str(axis).strip().lower()
    angle = _finite(angle_rad, "angle_rad")
    cosine = math.cos(0.5 * angle)
    sine = math.sin(0.5 * angle)
    if normalized_axis == "x":
        return (
            (complex(cosine, 0.0), complex(0.0, -sine)),
            (complex(0.0, -sine), complex(cosine, 0.0)),
        )
    if normalized_axis == "y":
        return (
            (complex(cosine, 0.0), complex(-sine, 0.0)),
            (complex(sine, 0.0), complex(cosine, 0.0)),
        )
    raise ValueError("axis must be 'x' or 'y'")


def evolve_density_with_unitary(state: Matrix, unitary: Matrix) -> Matrix:
    """Apply a reference unitary without using the core gate helpers."""

    state_array = np.asarray(state, dtype=np.complex128)
    unitary_array = np.asarray(unitary, dtype=np.complex128)
    evolved = unitary_array @ state_array @ unitary_array.conj().T
    return tuple(
        tuple(complex(value) for value in row)
        for row in evolved
    )


def analytic_constant_drive_density(
    state: Matrix,
    amplitude_rad_per_us: float,
    phase_rad: float,
    detuning_rad_per_us: float,
    time_us: float,
) -> Matrix:
    unitary = constant_drive_unitary(
        amplitude_rad_per_us,
        phase_rad,
        detuning_rad_per_us,
        time_us,
    )
    return evolve_density_with_unitary(state, unitary)


def run_constant_closed_trajectory(
    state: Matrix,
    amplitude_rad_per_us: float,
    phase_rad: float,
    detuning_rad_per_us: float,
    duration_us: float,
    sample_times_us: Sequence[float],
    max_step_us: float,
) -> TimeDependentEvolutionResult:
    envelope = SquarePulseEnvelope(
        peak_amplitude_rad_per_us=amplitude_rad_per_us,
        duration_us=duration_us,
    )
    return evolve_time_dependent_segment(
        state,
        TwoLevelPulseHamiltonian(
            envelope=envelope,
            phase_rad=phase_rad,
            detuning_rad_per_us=detuning_rad_per_us,
        ),
        (),
        duration_us=duration_us,
        max_step_us=max_step_us,
        checkpoint_times_us=sample_times_us,
    )


def _non_negative_finite(value: float, field_name: str) -> float:
    converted = _finite(value, field_name)
    if converted < 0.0:
        raise ValueError(f"{field_name} must be non-negative")
    return converted


def _finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted):
        raise ValueError(f"{field_name} must be finite")
    return converted
