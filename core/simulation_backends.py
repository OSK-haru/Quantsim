"""Internal backend registry for simulation entry points."""

from __future__ import annotations

from collections.abc import Callable

from core.results import SimulationConfig, SimulationResult


SimulationRunner = Callable[[SimulationConfig], SimulationResult]

_RUNNERS: dict[str, SimulationRunner] = {}


def register_simulation_backend(
    model: str,
    runner: SimulationRunner,
) -> None:
    """Register a model runner for run_simulation.

    This keeps the public SimulationConfig -> SimulationResult contract stable
    while allowing later Python, QuTiP, or process-backed adapters to be added
    without changing callers.
    """

    model = str(model)
    if not model:
        raise ValueError("model must not be empty")
    _RUNNERS[model] = runner


def get_simulation_backend(model: str) -> SimulationRunner | None:
    return _RUNNERS.get(str(model))


def registered_simulation_models() -> list[str]:
    return sorted(_RUNNERS)
