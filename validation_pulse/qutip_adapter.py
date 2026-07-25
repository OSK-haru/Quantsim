"""Validation-only bridge from QuantaScope matrices to QuTiP ``mesolve``."""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np

try:
    import qutip
except ImportError:  # pragma: no cover - exercised on validation-only installs
    qutip = None


QUTIP_AVAILABLE = qutip is not None
DEFAULT_OPTIONS = {
    "store_states": True,
    "normalize_output": False,
    "progress_bar": False,
    "method": "dop853",
    "atol": 1e-12,
    "rtol": 1e-12,
    "nsteps": 100000,
}


def as_qutip_operator(
    matrix,
    n_qubits: int | None = None,
    *,
    subsystem_dimensions: Sequence[int] | None = None,
):
    """Wrap an existing QuantaScope operator without changing its basis order."""

    _require_qutip()
    dimensions = _subsystem_dimensions(n_qubits, subsystem_dimensions)
    array = np.asarray(matrix, dtype=complex)
    expected_dimension = math.prod(dimensions)
    if array.shape != (expected_dimension, expected_dimension):
        raise ValueError(
            "matrix shape does not match subsystem_dimensions: "
            f"expected {(expected_dimension, expected_dimension)}, "
            f"received {array.shape}"
        )
    return qutip.Qobj(array, dims=[list(dimensions), list(dimensions)])


def as_qutip_density_matrix(
    matrix,
    n_qubits: int | None = None,
    *,
    subsystem_dimensions: Sequence[int] | None = None,
):
    """Wrap an existing QuantaScope density matrix without reconstruction."""

    return as_qutip_operator(
        matrix,
        n_qubits,
        subsystem_dimensions=subsystem_dimensions,
    )


def run_qutip_constant_segment(
    rho0,
    hamiltonian,
    collapse_ops: Sequence,
    n_qubits: int | None,
    duration_us: float,
    requested_times_us: Sequence[float] | None = None,
    *,
    max_step_us: float = 0.015625,
    subsystem_dimensions: Sequence[int] | None = None,
):
    """Solve one constant segment with QuTiP using QuantaScope's exact matrices."""

    _require_qutip()
    if requested_times_us is None:
        requested_times_us = (0.0, float(duration_us))
    times = [float(value) for value in requested_times_us]
    if not times or times[0] != 0.0 or times[-1] > duration_us + 1e-14:
        raise ValueError("segment times must start at zero and remain within its duration")
    options = {**DEFAULT_OPTIONS, "max_step": min(max_step_us, duration_us / 50.0) if duration_us else max_step_us}
    result = qutip.mesolve(
        as_qutip_operator(
            hamiltonian,
            n_qubits,
            subsystem_dimensions=subsystem_dimensions,
        ),
        as_qutip_density_matrix(
            rho0,
            n_qubits,
            subsystem_dimensions=subsystem_dimensions,
        ),
        times,
        c_ops=[
            as_qutip_operator(
                operator,
                n_qubits,
                subsystem_dimensions=subsystem_dimensions,
            )
            for operator in collapse_ops
        ],
        options=options,
    )
    return [_as_matrix(state.full()) for state in result.states]


def run_qutip_time_dependent_segment(
    rho0,
    hamiltonian_provider,
    collapse_ops: Sequence,
    n_qubits: int | None,
    duration_us: float,
    requested_times_us: Sequence[float] | None = None,
    *,
    max_step_us: float = 0.005,
    subsystem_dimensions: Sequence[int] | None = None,
):
    """Solve one time-dependent segment using the exact provider matrices."""

    _require_qutip()
    if requested_times_us is None:
        requested_times_us = (0.0, float(duration_us))
    times = [float(value) for value in requested_times_us]
    if not times or times[0] != 0.0 or times[-1] > duration_us + 1e-14:
        raise ValueError(
            "segment times must start at zero and remain within its duration"
        )

    def hamiltonian_at_time(time_us, args=None):
        del args
        return as_qutip_operator(
            hamiltonian_provider.evaluate(float(time_us)),
            n_qubits,
            subsystem_dimensions=subsystem_dimensions,
        )

    options = {
        **DEFAULT_OPTIONS,
        "max_step": min(max_step_us, duration_us / 100.0),
    }
    result = qutip.mesolve(
        hamiltonian_at_time,
        as_qutip_density_matrix(
            rho0,
            n_qubits,
            subsystem_dimensions=subsystem_dimensions,
        ),
        times,
        c_ops=[
            as_qutip_operator(
                operator,
                n_qubits,
                subsystem_dimensions=subsystem_dimensions,
            )
            for operator in collapse_ops
        ],
        options=options,
    )
    return [_as_matrix(state.full()) for state in result.states]


def run_qutip_piecewise_segments(rho0, segments: Sequence[dict], collapse_ops: Sequence, n_qubits: int, *, max_step_us: float = 0.015625):
    """Run finite-duration columns sequentially, preserving exact boundaries."""

    current = rho0
    snapshots = [current]
    global_time_us = 0.0
    for index, segment in enumerate(segments):
        duration_us = float(segment["duration_us"])
        states = run_qutip_constant_segment(
            current,
            segment["hamiltonian"],
            collapse_ops,
            n_qubits,
            duration_us,
            max_step_us=max_step_us,
        )
        current = states[-1]
        global_time_us += duration_us
        snapshots.append(current)
        if not math.isfinite(global_time_us):
            raise ValueError(f"non-finite global time after segment {index}")
    return snapshots


def compare_density_matrices(quanta_state, qutip_state) -> dict[str, float]:
    """Return comparison and physicality metrics using the common matrix basis."""

    quanta = np.asarray(quanta_state, dtype=complex)
    reference = np.asarray(qutip_state, dtype=complex)
    difference = quanta - reference
    singular_values = np.linalg.svd(difference, compute_uv=False)
    quanta_purity = float(np.trace(quanta @ quanta).real)
    reference_purity = float(np.trace(reference @ reference).real)
    return {
        "max_element_difference": float(np.max(np.abs(difference))),
        "frobenius_difference": float(np.linalg.norm(difference)),
        "trace_distance": float(0.5 * np.sum(singular_values)),
        "population_difference": float(np.max(np.abs(np.diag(difference)))),
        "coherence_difference": float(np.max(np.abs(difference - np.diag(np.diag(difference))))),
        "purity_difference": abs(quanta_purity - reference_purity),
        **_physicality("quanta", quanta),
        **_physicality("qutip", reference),
    }


def _physicality(prefix: str, state: np.ndarray) -> dict[str, float]:
    eigenvalues = np.linalg.eigvalsh(state)
    return {
        f"{prefix}_trace_error": float(abs(np.trace(state) - 1.0)),
        f"{prefix}_hermiticity_error": float(np.max(np.abs(state - state.conj().T))),
        f"{prefix}_minimum_eigenvalue": float(np.min(eigenvalues)),
    }


def _as_matrix(array: np.ndarray):
    return [[complex(value) for value in row] for row in array]


def _require_qutip() -> None:
    if not QUTIP_AVAILABLE:
        raise RuntimeError(
            "QuTiP is required only for validation; "
            "install requirements-validation.txt"
        )


def _subsystem_dimensions(
    n_qubits: int | None,
    subsystem_dimensions: Sequence[int] | None,
) -> tuple[int, ...]:
    if subsystem_dimensions is None:
        if n_qubits is None or n_qubits <= 0:
            raise ValueError(
                "n_qubits must be positive when subsystem_dimensions "
                "is omitted"
            )
        return (2,) * n_qubits
    dimensions = tuple(int(value) for value in subsystem_dimensions)
    if not dimensions or any(value <= 0 for value in dimensions):
        raise ValueError("subsystem_dimensions must contain positive integers")
    if n_qubits is not None and dimensions != (2,) * n_qubits:
        raise ValueError(
            "provide either matching qubit dimensions or "
            "n_qubits=None for non-qubit systems"
        )
    return dimensions
