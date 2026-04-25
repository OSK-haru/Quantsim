"""Metrics for the 1-qubit noisy H-gate MVP."""

from __future__ import annotations

from collections.abc import Sequence

from core.circuit import Matrix2, h_gate_hamiltonian, initial_zero_density_matrix
from core.environment import load_reference_profile
from core.evolution import _clean_density_matrix, _rk4_step


def ideal_state_series(times: Sequence[float]) -> list[Matrix2]:
    """Generate the ideal H-gate trajectory using the same evolution step."""

    if not times:
        return []

    hamiltonian = h_gate_hamiltonian()
    states = [initial_zero_density_matrix()]

    for start_time, end_time in zip(times, times[1:]):
        if end_time <= start_time:
            raise ValueError("times must be strictly increasing")

        dt = end_time - start_time
        next_state = _rk4_step(states[-1], hamiltonian, [], dt)
        states.append(_clean_density_matrix(next_state))

    return states


def fidelity_series(states: Sequence[Matrix2], ideal_states: Sequence[Matrix2]) -> list[float]:
    """Return fidelity against pure ideal reference states over time."""

    _require_same_length(states, ideal_states, "states", "ideal_states")

    return [
        _as_probability(_trace(_matmul(state, ideal_state)).real)
        for state, ideal_state in zip(states, ideal_states)
    ]


def purity_series(states: Sequence[Matrix2]) -> list[float]:
    """Return Tr(rho^2) for each density matrix."""

    return [
        _as_probability(_trace(_matmul(state, state)).real)
        for state in states
    ]


def effective_time(
    times: Sequence[float],
    fidelities: Sequence[float],
    threshold: float | None = None,
) -> float:
    """Return the first time fidelity drops below the threshold."""

    _require_same_length(times, fidelities, "times", "fidelities")
    if not times:
        raise ValueError("times must not be empty")

    threshold = _default_threshold() if threshold is None else float(threshold)
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must be between 0 and 1")

    for time, fidelity in zip(times, fidelities):
        if fidelity < threshold:
            return time

    return times[-1]


def _default_threshold() -> float:
    return float(load_reference_profile()["fidelity_threshold"])


def _matmul(left: Matrix2, right: Matrix2) -> Matrix2:
    return (
        (
            left[0][0] * right[0][0] + left[0][1] * right[1][0],
            left[0][0] * right[0][1] + left[0][1] * right[1][1],
        ),
        (
            left[1][0] * right[0][0] + left[1][1] * right[1][0],
            left[1][0] * right[0][1] + left[1][1] * right[1][1],
        ),
    )


def _trace(matrix: Matrix2) -> complex:
    return matrix[0][0] + matrix[1][1]


def _as_probability(value: float) -> float:
    if value < 0.0 and value > -1e-9:
        return 0.0
    if value > 1.0 and value < 1.0 + 1e-9:
        return 1.0
    return value


def _require_same_length(
    first: Sequence[object],
    second: Sequence[object],
    first_name: str,
    second_name: str,
) -> None:
    if len(first) != len(second):
        raise ValueError(f"{first_name} and {second_name} must have the same length")
