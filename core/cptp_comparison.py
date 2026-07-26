"""Accuracy and runtime comparison for RK4 and explicit CPTP evolution."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from statistics import median
from time import perf_counter
from typing import Literal

import numpy as np

from core.cptp_piecewise import (
    PiecewiseGKSLMap,
    TimeDependentHamiltonian,
    piecewise_gksl_exponential_map,
)
from core.cptp_rust import rust_piecewise_gksl_exponential_map
from core.gates import Matrix, prepare_collapse_operators
from core.pulse_evolution import evolve_time_dependent_segment


CPTPComparisonBackend = Literal["python", "rust"]


@dataclass(frozen=True)
class DensityMatrixPhysicality:
    trace_error: float
    hermiticity_error: float
    minimum_eigenvalue: float

    def to_dict(self) -> dict[str, float]:
        return {
            "trace_error": self.trace_error,
            "hermiticity_error": self.hermiticity_error,
            "minimum_eigenvalue": self.minimum_eigenvalue,
        }


@dataclass(frozen=True)
class RK4CPTPComparison:
    backend: CPTPComparisonBackend
    dimension: int
    duration_us: float
    max_step_us: float
    rk4_internal_step_count: int
    cptp_interval_count: int
    max_abs_difference: float
    frobenius_difference: float
    trace_distance: float
    rk4_runtime_median_ms: float
    cptp_runtime_median_ms: float
    rk4_to_cptp_runtime_ratio: float
    timing_repetitions: int
    rk4_physicality: DensityMatrixPhysicality
    rk4_raw_final_physicality: DensityMatrixPhysicality
    rk4_minimum_observed_raw_eigenvalue: float
    rk4_maximum_cleanup_correction_norm: float
    cptp_physicality: DensityMatrixPhysicality
    cptp_choi_minimum_eigenvalue: float
    cptp_trace_preservation_error: float

    def to_dict(self) -> dict[str, object]:
        return {
            "backend": self.backend,
            "dimension": self.dimension,
            "duration_us": self.duration_us,
            "max_step_us": self.max_step_us,
            "rk4_internal_step_count": self.rk4_internal_step_count,
            "cptp_interval_count": self.cptp_interval_count,
            "max_abs_difference": self.max_abs_difference,
            "frobenius_difference": self.frobenius_difference,
            "trace_distance": self.trace_distance,
            "rk4_runtime_median_ms": self.rk4_runtime_median_ms,
            "cptp_runtime_median_ms": self.cptp_runtime_median_ms,
            "rk4_to_cptp_runtime_ratio": (
                self.rk4_to_cptp_runtime_ratio
            ),
            "timing_repetitions": self.timing_repetitions,
            "rk4_physicality": self.rk4_physicality.to_dict(),
            "rk4_raw_final_physicality": (
                self.rk4_raw_final_physicality.to_dict()
            ),
            "rk4_minimum_observed_raw_eigenvalue": (
                self.rk4_minimum_observed_raw_eigenvalue
            ),
            "rk4_maximum_cleanup_correction_norm": (
                self.rk4_maximum_cleanup_correction_norm
            ),
            "cptp_physicality": self.cptp_physicality.to_dict(),
            "cptp_choi_minimum_eigenvalue": (
                self.cptp_choi_minimum_eigenvalue
            ),
            "cptp_trace_preservation_error": (
                self.cptp_trace_preservation_error
            ),
        }


def compare_rk4_and_cptp(
    state: Matrix,
    hamiltonian: TimeDependentHamiltonian,
    collapse_operators: Sequence[Matrix],
    duration_us: float,
    max_step_us: float,
    *,
    backend: CPTPComparisonBackend = "python",
    timing_repetitions: int = 1,
    warmup: bool = False,
) -> RK4CPTPComparison:
    """Compare matched-grid RK4 and midpoint CPTP segment evolution."""

    if backend not in ("python", "rust"):
        raise ValueError("backend must be 'python' or 'rust'")
    repetitions = _positive_integer(
        timing_repetitions,
        "timing_repetitions",
    )
    collapse_matrices = tuple(collapse_operators)
    cached_collapse_operators = prepare_collapse_operators(
        collapse_matrices
    )

    def run_rk4():
        return evolve_time_dependent_segment(
            state,
            hamiltonian,
            cached_collapse_operators,
            duration_us,
            max_step_us,
            backend=backend,
        )

    def run_cptp() -> tuple[PiecewiseGKSLMap, Matrix]:
        if backend == "rust":
            cptp_map = rust_piecewise_gksl_exponential_map(
                hamiltonian,
                collapse_matrices,
                duration_us,
                max_step_us,
            )
        else:
            cptp_map = piecewise_gksl_exponential_map(
                hamiltonian,
                collapse_matrices,
                duration_us,
                max_step_us,
            )
        return cptp_map, cptp_map.apply(state)

    if warmup:
        run_rk4()
        run_cptp()

    rk4_result, rk4_times = _timed_runs(run_rk4, repetitions)
    cptp_result, cptp_times = _timed_runs(run_cptp, repetitions)
    cptp_map, cptp_state = cptp_result
    difference = (
        np.asarray(rk4_result.state, dtype=np.complex128)
        - np.asarray(cptp_state, dtype=np.complex128)
    )
    rk4_median = median(rk4_times)
    cptp_median = median(cptp_times)

    return RK4CPTPComparison(
        backend=backend,
        dimension=len(state),
        duration_us=float(duration_us),
        max_step_us=float(max_step_us),
        rk4_internal_step_count=(
            rk4_result.diagnostics.internal_step_count
        ),
        cptp_interval_count=len(cptp_map.intervals),
        max_abs_difference=float(np.max(np.abs(difference))),
        frobenius_difference=float(
            np.linalg.norm(difference, ord="fro")
        ),
        trace_distance=_trace_distance(difference),
        rk4_runtime_median_ms=rk4_median,
        cptp_runtime_median_ms=cptp_median,
        rk4_to_cptp_runtime_ratio=(
            rk4_median / cptp_median
            if cptp_median > 0.0
            else math.inf
        ),
        timing_repetitions=repetitions,
        rk4_physicality=_physicality(rk4_result.state),
        rk4_raw_final_physicality=_physicality(
            rk4_result.raw_final_state
        ),
        rk4_minimum_observed_raw_eigenvalue=(
            rk4_result.diagnostics.raw_minimum_eigenvalue
        ),
        rk4_maximum_cleanup_correction_norm=(
            rk4_result.diagnostics.cleanup_correction_norm
        ),
        cptp_physicality=_physicality(cptp_state),
        cptp_choi_minimum_eigenvalue=(
            cptp_map.audit.choi_minimum_eigenvalue
        ),
        cptp_trace_preservation_error=(
            cptp_map.audit.trace_preservation_frobenius_error
        ),
    )


def _timed_runs(operation, repetitions: int):
    result = None
    timings = []
    for _ in range(repetitions):
        started_at = perf_counter()
        result = operation()
        timings.append((perf_counter() - started_at) * 1000.0)
    if result is None:
        raise RuntimeError("timed comparison produced no result")
    return result, timings


def _trace_distance(difference: np.ndarray) -> float:
    singular_values = np.linalg.svd(
        difference,
        compute_uv=False,
    )
    return float(0.5 * np.sum(singular_values))


def _physicality(state: Matrix) -> DensityMatrixPhysicality:
    array = np.asarray(state, dtype=np.complex128)
    hermitian = 0.5 * (array + array.conj().T)
    return DensityMatrixPhysicality(
        trace_error=float(abs(np.trace(array) - 1.0)),
        hermiticity_error=float(
            np.max(np.abs(array - array.conj().T))
        ),
        minimum_eigenvalue=float(
            np.min(np.linalg.eigvalsh(hermitian))
        ),
    )


def _positive_integer(value: int, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{field_name} must be a positive integer")
    return value
