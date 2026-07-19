"""Opt-in internal profiling for dense Lindblad diagnostics."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from time import perf_counter
from typing import Iterator


@dataclass
class InternalProfilingStats:
    rk4_step_count: int = 0
    rk4_total_ms: float = 0.0
    rhs_call_count: int = 0
    rhs_total_ms: float = 0.0
    hamiltonian_term_ms: float = 0.0
    dissipator_total_ms: float = 0.0
    matrix_accumulation_ms: float = 0.0
    dissipator_operator_iterations: int = 0
    matmul_call_count: int = 0
    matmul_total_ms: float = 0.0
    python_matmul_call_count: int = 0
    python_matmul_total_ms: float = 0.0
    numpy_matmul_call_count: int = 0
    numpy_matmul_total_ms: float = 0.0
    adjoint_call_count: int = 0
    adjoint_total_ms: float = 0.0
    matrix_add_scale_call_count: int = 0
    matrix_add_scale_total_ms: float = 0.0
    conversion_count: int = 0
    conversion_total_ms: float = 0.0
    zero_hamiltonian_skip_count: int = 0
    collapse_adjoint_build_count: int = 0
    collapse_adjoint_build_ms: float = 0.0
    ldagger_l_build_count: int = 0
    ldagger_l_build_ms: float = 0.0

    def to_diagnostics(self) -> dict[str, object]:
        return {
            "core_internal_profiling_enabled": True,
            "core_profile_rk4_step_count": int(self.rk4_step_count),
            "core_profile_rk4_total_ms": float(self.rk4_total_ms),
            "core_profile_rk4_average_ms": _average(
                self.rk4_total_ms,
                self.rk4_step_count,
            ),
            "core_profile_rhs_call_count": int(self.rhs_call_count),
            "core_profile_rhs_total_ms": float(self.rhs_total_ms),
            "core_profile_rhs_average_ms": _average(
                self.rhs_total_ms,
                self.rhs_call_count,
            ),
            "core_profile_hamiltonian_term_ms": float(self.hamiltonian_term_ms),
            "core_profile_dissipator_total_ms": float(self.dissipator_total_ms),
            "core_profile_matrix_accumulation_ms": float(
                self.matrix_accumulation_ms
            ),
            "core_profile_dissipator_operator_iterations": int(
                self.dissipator_operator_iterations
            ),
            "core_profile_dissipator_average_per_operator_ms": _average(
                self.dissipator_total_ms,
                self.dissipator_operator_iterations,
            ),
            "core_profile_matmul_call_count": int(self.matmul_call_count),
            "core_profile_matmul_total_ms": float(self.matmul_total_ms),
            "core_profile_matmul_average_ms": _average(
                self.matmul_total_ms,
                self.matmul_call_count,
            ),
            "core_profile_python_matmul_call_count": int(
                self.python_matmul_call_count
            ),
            "core_profile_python_matmul_total_ms": float(
                self.python_matmul_total_ms
            ),
            "core_profile_numpy_matmul_call_count": int(
                self.numpy_matmul_call_count
            ),
            "core_profile_numpy_matmul_total_ms": float(
                self.numpy_matmul_total_ms
            ),
            "core_profile_adjoint_call_count": int(self.adjoint_call_count),
            "core_profile_adjoint_total_ms": float(self.adjoint_total_ms),
            "core_profile_matrix_add_scale_call_count": int(
                self.matrix_add_scale_call_count
            ),
            "core_profile_matrix_add_scale_total_ms": float(
                self.matrix_add_scale_total_ms
            ),
            "core_profile_conversion_count": int(self.conversion_count),
            "core_profile_conversion_total_ms": float(self.conversion_total_ms),
            "core_profile_zero_hamiltonian_skip_count": int(
                self.zero_hamiltonian_skip_count
            ),
            "core_profile_collapse_adjoint_build_count": int(
                self.collapse_adjoint_build_count
            ),
            "core_profile_collapse_adjoint_build_ms": float(
                self.collapse_adjoint_build_ms
            ),
            "core_profile_ldagger_l_build_count": int(self.ldagger_l_build_count),
            "core_profile_ldagger_l_build_ms": float(self.ldagger_l_build_ms),
        }


_ACTIVE_INTERNAL_PROFILE: ContextVar[InternalProfilingStats | None] = ContextVar(
    "core_internal_profile",
    default=None,
)


def active_internal_profile() -> InternalProfilingStats | None:
    return _ACTIVE_INTERNAL_PROFILE.get()


@contextmanager
def enable_internal_profiling() -> Iterator[InternalProfilingStats]:
    profile = InternalProfilingStats()
    token = _ACTIVE_INTERNAL_PROFILE.set(profile)
    try:
        yield profile
    finally:
        _ACTIVE_INTERNAL_PROFILE.reset(token)


def elapsed_ms(started_at: float) -> float:
    return (perf_counter() - started_at) * 1000.0


def timer_start() -> float:
    return perf_counter()


def _average(total_ms: float, count: int) -> float:
    if count <= 0:
        return 0.0
    return float(total_ms) / float(count)
