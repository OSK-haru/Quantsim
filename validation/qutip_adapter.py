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


def as_qutip_operator(matrix, n_qubits: int):
    """Wrap an existing QuantaScope operator without changing its basis order."""

    _require_qutip()
    return qutip.Qobj(np.asarray(matrix, dtype=complex), dims=[[2] * n_qubits] * 2)


def as_qutip_density_matrix(matrix, n_qubits: int):
    """Wrap an existing QuantaScope density matrix without reconstruction."""

    return as_qutip_operator(matrix, n_qubits)


def run_qutip_constant_segment(
    rho0,
    hamiltonian,
    collapse_ops: Sequence,
    n_qubits: int,
    duration_us: float,
    requested_times_us: Sequence[float] | None = None,
    *,
    max_step_us: float = 0.015625,
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
        as_qutip_operator(hamiltonian, n_qubits),
        as_qutip_density_matrix(rho0, n_qubits),
        times,
        c_ops=[as_qutip_operator(operator, n_qubits) for operator in collapse_ops],
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
    return {
        "max_element_difference": float(np.max(np.abs(difference))),
        "frobenius_difference": float(np.linalg.norm(difference)),
        "trace_distance": float(0.5 * np.sum(singular_values)),
        "population_difference": float(np.max(np.abs(np.diag(difference)))),
        "coherence_difference": float(np.max(np.abs(difference - np.diag(np.diag(difference))))),
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
        raise RuntimeError("QuTiP is required only for VALIDATION-7; install requirements-validation.txt")
