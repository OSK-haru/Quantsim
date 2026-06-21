"""Small result metrics shared by simulation and comparison code."""

from __future__ import annotations

from collections.abc import Sequence


DEFAULT_FIDELITY_THRESHOLD = 0.9


def effective_time(
    times: Sequence[float],
    fidelities: Sequence[float],
    threshold: float | None = None,
) -> float:
    """Return the first time fidelity drops below the threshold."""

    _require_same_length(times, fidelities, "times", "fidelities")
    if not times:
        raise ValueError("times must not be empty")

    threshold = DEFAULT_FIDELITY_THRESHOLD if threshold is None else float(threshold)
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("threshold must be between 0 and 1")

    for time, fidelity in zip(times, fidelities):
        if fidelity < threshold:
            return float(time)

    return float(times[-1])


def _require_same_length(
    first: Sequence[object],
    second: Sequence[object],
    first_name: str,
    second_name: str,
) -> None:
    if len(first) != len(second):
        raise ValueError(f"{first_name} and {second_name} must have the same length")
