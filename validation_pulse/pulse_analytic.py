"""Analytic references and metrics for closed resonant two-level pulses."""

from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from core.gates import Matrix, initial_density_matrix
from core.pulse_envelopes import PulseEnvelope, TwoLevelPulseHamiltonian
from core.pulse_evolution import (
    TimeDependentEvolutionResult,
    evolve_time_dependent_segment,
)


def analytic_resonant_x_density(
    envelope: PulseEnvelope,
    local_time_us: float,
    *,
    initial_state: str = "0",
) -> Matrix:
    """Return the exact density matrix for H(t)=Omega(t) sigma_x / 2."""

    angle = envelope.integrated_area_rad(local_time_us)
    cosine = math.cos(0.5 * angle)
    sine = math.sin(0.5 * angle)
    if initial_state == "0":
        ket = (complex(cosine, 0.0), complex(0.0, -sine))
    elif initial_state == "1":
        ket = (complex(0.0, -sine), complex(cosine, 0.0))
    else:
        raise ValueError("initial_state must be '0' or '1'")
    return tuple(
        tuple(ket[row] * ket[column].conjugate() for column in range(2))
        for row in range(2)
    )


def run_resonant_closed_trajectory(
    envelope: PulseEnvelope,
    sample_times_us: Sequence[float],
    max_step_us: float,
    *,
    initial_state: str = "0",
) -> TimeDependentEvolutionResult:
    """Run the BA-1 reference path for a resonant zero-phase envelope."""

    if not sample_times_us:
        raise ValueError("sample_times_us must not be empty")
    if sample_times_us[0] != 0.0:
        raise ValueError("sample_times_us must start at 0")
    if not math.isclose(
        sample_times_us[-1],
        envelope.duration_us,
        rel_tol=0.0,
        abs_tol=1e-14,
    ):
        raise ValueError("sample_times_us must end at the pulse duration")
    return evolve_time_dependent_segment(
        initial_density_matrix([initial_state]),
        TwoLevelPulseHamiltonian(envelope),
        (),
        duration_us=envelope.duration_us,
        max_step_us=max_step_us,
        checkpoint_times_us=sample_times_us,
    )


def matrix_error_metrics(
    actual: Matrix,
    expected: Matrix,
) -> dict[str, float]:
    actual_array = np.asarray(actual, dtype=np.complex128)
    expected_array = np.asarray(expected, dtype=np.complex128)
    difference = actual_array - expected_array
    singular_values = np.linalg.svd(difference, compute_uv=False)
    actual_bloch = bloch_vector(actual)
    expected_bloch = bloch_vector(expected)
    return {
        "max_element_error": float(np.max(np.abs(difference))),
        "frobenius_error": float(np.linalg.norm(difference, ord="fro")),
        "trace_distance": float(0.5 * np.sum(singular_values)),
        "bloch_vector_error": float(np.linalg.norm(
            np.asarray(actual_bloch) - np.asarray(expected_bloch)
        )),
    }


def bloch_vector(state: Matrix) -> tuple[float, float, float]:
    array = np.asarray(state, dtype=np.complex128)
    return (
        float(2.0 * array[0, 1].real),
        float(-2.0 * array[0, 1].imag),
        float((array[0, 0] - array[1, 1]).real),
    )


def pulse_end_target_fidelity(
    state: Matrix,
    target_state: str,
) -> float:
    if target_state not in {"0", "1"}:
        raise ValueError("target_state must be '0' or '1'")
    index = int(target_state)
    return float(state[index][index].real)


def pure_target_fidelity(
    state: Matrix,
    pure_target_density: Matrix,
) -> float:
    """Return Tr(rho sigma) when sigma is a pure target-state density matrix."""

    state_array = np.asarray(state, dtype=np.complex128)
    target_array = np.asarray(pure_target_density, dtype=np.complex128)
    return float(np.trace(state_array @ target_array).real)


def observed_order(
    coarse_error: float,
    fine_error: float,
    refinement_ratio: float = 2.0,
) -> float | None:
    if coarse_error <= 0.0 or fine_error <= 0.0:
        return None
    if refinement_ratio <= 1.0:
        raise ValueError("refinement_ratio must be greater than 1")
    return math.log(coarse_error / fine_error) / math.log(refinement_ratio)
