"""Reference evolution path for time-dependent two-level Hamiltonians."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal, Protocol

import numpy as np

from core.gates import (
    CachedCollapseOperator,
    Matrix,
    add,
    clean_density_matrix,
    lindblad_rhs_cached,
    scale,
    trace,
)
from core.rust_dense_kernel import (
    is_rust_kernel_available,
    rust_rk4_time_dependent_step,
)


TIME_TOLERANCE_US = 1e-15
TimeDependentEvolutionBackend = Literal["python", "rust", "auto"]
ResolvedTimeDependentEvolutionBackend = Literal["python", "rust"]


class TimeDependentHamiltonian(Protocol):
    """Provide a Hamiltonian at local time within one continuous segment."""

    def evaluate(self, local_time_us: float) -> Matrix:
        """Return the Hamiltonian in rad/us at the requested local time."""


class DenseTimeDependentHamiltonian(Protocol):
    """Provide a NumPy Hamiltonian for the dense array integration path."""

    def for_segment(
        self,
        start_time_us: float,
        end_time_us: float,
    ) -> "DenseTimeDependentHamiltonian":
        """Return the provider restricted to one integration segment.

        A finite pulse that switches on or off inside a step would otherwise be
        sampled by only part of the RK4 stages, which leaves an O(step) error at
        every pulse edge. Restricting the provider to a segment whose interior
        contains no switching time removes that error instead of shrinking it.
        """

    def evaluate_array(self, local_time_us: float) -> np.ndarray:
        """Return the Hamiltonian in rad/us as a complex NumPy array."""


class DenseDissipator(Protocol):
    """Supply the two Lindblad dissipator halves for the dense path."""

    def relaxation_array(self, dimension: int) -> np.ndarray:
        """Return the time-independent sum of L-dagger L."""

    def apply_jumps(self, rho: np.ndarray) -> np.ndarray:
        """Return the sum of L rho L-dagger over every jump operator."""


@dataclass(frozen=True)
class DenseCollapseDissipator:
    """Reference dissipator that keeps every jump operator dense."""

    collapse_operators: tuple[Matrix, ...]
    _jump_arrays: tuple[np.ndarray, ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        prepared: list[np.ndarray] = []
        for index, collapse_op in enumerate(self.collapse_operators):
            _validate_square_finite_matrix(
                collapse_op,
                f"collapse_operators[{index}]",
            )
            prepared.append(np.asarray(collapse_op, dtype=np.complex128))
        object.__setattr__(self, "_jump_arrays", tuple(prepared))

    def relaxation_array(self, dimension: int) -> np.ndarray:
        relaxation = np.zeros((dimension, dimension), dtype=np.complex128)
        for jump_operator in self._jump_arrays:
            if jump_operator.shape != (dimension, dimension):
                raise ValueError(
                    "collapse operator dimension must match state dimension"
                )
            relaxation += jump_operator.conj().T @ jump_operator
        return relaxation

    def apply_jumps(self, rho: np.ndarray) -> np.ndarray:
        result = np.zeros_like(rho)
        for jump_operator in self._jump_arrays:
            result += jump_operator @ rho @ jump_operator.conj().T
        return result


@dataclass(frozen=True)
class ConstantHamiltonian:
    """Small adapter used for reference and equivalence validation."""

    matrix: Matrix

    def evaluate(self, local_time_us: float) -> Matrix:
        del local_time_us
        return self.matrix


@dataclass(frozen=True)
class PhysicalityMetrics:
    trace_error: float
    hermiticity_error: float
    minimum_eigenvalue: float


@dataclass(frozen=True)
class TimeDependentCheckpoint:
    time_us: float
    raw_state: Matrix
    cleaned_state: Matrix
    raw_physicality: PhysicalityMetrics
    cleanup_correction_norm: float


@dataclass(frozen=True)
class TimeDependentEvolutionDiagnostics:
    internal_step_count: int
    rhs_evaluation_count: int
    hamiltonian_evaluation_count: int
    minimum_internal_step_us: float
    maximum_internal_step_us: float
    raw_trace_error: float
    raw_hermiticity_error: float
    raw_minimum_eigenvalue: float
    cleanup_correction_norm: float
    actual_duration_us: float

    def to_dict(self) -> dict[str, float | int]:
        return {
            "internal_step_count": self.internal_step_count,
            "rhs_evaluation_count": self.rhs_evaluation_count,
            "hamiltonian_evaluation_count": self.hamiltonian_evaluation_count,
            "minimum_internal_step_us": self.minimum_internal_step_us,
            "maximum_internal_step_us": self.maximum_internal_step_us,
            "raw_trace_error": self.raw_trace_error,
            "raw_hermiticity_error": self.raw_hermiticity_error,
            "raw_minimum_eigenvalue": self.raw_minimum_eigenvalue,
            "cleanup_correction_norm": self.cleanup_correction_norm,
            "actual_duration_us": self.actual_duration_us,
        }


@dataclass(frozen=True)
class TimeDependentEvolutionResult:
    state: Matrix
    raw_final_state: Matrix
    checkpoints: tuple[TimeDependentCheckpoint, ...]
    diagnostics: TimeDependentEvolutionDiagnostics


def evolve_time_dependent_segment(
    state: Matrix,
    hamiltonian: TimeDependentHamiltonian,
    collapse_ops: Sequence[CachedCollapseOperator],
    duration_us: float,
    max_step_us: float,
    *,
    checkpoint_times_us: Sequence[float] = (),
    backend: TimeDependentEvolutionBackend = "python",
) -> TimeDependentEvolutionResult:
    """Evolve one segment with RK4 stage-time Hamiltonian evaluation.

    Cleanup is applied once after every complete RK4 step, never inside a
    stage. Raw metrics are measured before each cleanup. Requested checkpoints
    and the final segment time retain both raw and cleaned states.
    """

    duration = _positive_finite(duration_us, "duration_us")
    max_step = _positive_finite(max_step_us, "max_step_us")
    dimension = _validate_square_finite_matrix(state, "state")
    _validate_collapse_operators(collapse_ops, dimension)
    resolved_backend = resolve_time_dependent_backend(backend)
    checkpoints = _normalize_checkpoint_times(
        checkpoint_times_us,
        duration,
    )
    integration_boundaries = sorted(set((*checkpoints, duration)))

    evolved = state
    raw_final_state = state
    current_time = 0.0
    internal_steps: list[float] = []
    recorded: list[TimeDependentCheckpoint] = []
    max_raw_trace_error = 0.0
    max_raw_hermiticity_error = 0.0
    min_raw_eigenvalue = math.inf
    max_cleanup_correction = 0.0

    checkpoint_index = 0
    if checkpoints and checkpoints[0] == 0.0:
        initial_metrics = physicality_metrics(state)
        recorded.append(TimeDependentCheckpoint(
            time_us=0.0,
            raw_state=state,
            cleaned_state=state,
            raw_physicality=initial_metrics,
            cleanup_correction_norm=0.0,
        ))
        checkpoint_index = 1

    for boundary in integration_boundaries:
        if boundary <= current_time + TIME_TOLERANCE_US:
            continue

        last_raw_at_boundary: Matrix | None = None
        last_metrics_at_boundary: PhysicalityMetrics | None = None
        last_correction_at_boundary = 0.0

        while current_time < boundary - TIME_TOLERANCE_US:
            step = min(max_step, boundary - current_time)
            if step <= 0.0:
                raise RuntimeError("time-dependent integration did not advance")

            raw_state = _rk4_time_dependent_step(
                evolved,
                hamiltonian,
                collapse_ops,
                current_time,
                step,
                dimension,
                resolved_backend,
            )
            metrics = physicality_metrics(raw_state)
            cleaned_state = clean_density_matrix(raw_state)
            correction_norm = _frobenius_difference(
                raw_state,
                cleaned_state,
            )

            max_raw_trace_error = max(
                max_raw_trace_error,
                metrics.trace_error,
            )
            max_raw_hermiticity_error = max(
                max_raw_hermiticity_error,
                metrics.hermiticity_error,
            )
            min_raw_eigenvalue = min(
                min_raw_eigenvalue,
                metrics.minimum_eigenvalue,
            )
            max_cleanup_correction = max(
                max_cleanup_correction,
                correction_norm,
            )

            internal_steps.append(step)
            current_time += step
            if math.isclose(
                current_time,
                boundary,
                rel_tol=0.0,
                abs_tol=TIME_TOLERANCE_US,
            ):
                current_time = boundary

            evolved = cleaned_state
            raw_final_state = raw_state
            last_raw_at_boundary = raw_state
            last_metrics_at_boundary = metrics
            last_correction_at_boundary = correction_norm

        while (
            checkpoint_index < len(checkpoints)
            and math.isclose(
                checkpoints[checkpoint_index],
                boundary,
                rel_tol=0.0,
                abs_tol=TIME_TOLERANCE_US,
            )
        ):
            if last_raw_at_boundary is None or last_metrics_at_boundary is None:
                last_raw_at_boundary = evolved
                last_metrics_at_boundary = physicality_metrics(evolved)
            recorded.append(TimeDependentCheckpoint(
                time_us=boundary,
                raw_state=last_raw_at_boundary,
                cleaned_state=evolved,
                raw_physicality=last_metrics_at_boundary,
                cleanup_correction_norm=last_correction_at_boundary,
            ))
            checkpoint_index += 1

    if not internal_steps:
        raise RuntimeError("time-dependent integration produced no steps")

    diagnostics = TimeDependentEvolutionDiagnostics(
        internal_step_count=len(internal_steps),
        rhs_evaluation_count=4 * len(internal_steps),
        hamiltonian_evaluation_count=4 * len(internal_steps),
        minimum_internal_step_us=min(internal_steps),
        maximum_internal_step_us=max(internal_steps),
        raw_trace_error=max_raw_trace_error,
        raw_hermiticity_error=max_raw_hermiticity_error,
        raw_minimum_eigenvalue=min_raw_eigenvalue,
        cleanup_correction_norm=max_cleanup_correction,
        actual_duration_us=current_time,
    )
    return TimeDependentEvolutionResult(
        state=evolved,
        raw_final_state=raw_final_state,
        checkpoints=tuple(recorded),
        diagnostics=diagnostics,
    )


def evolve_dense_time_dependent_segment(
    state: Matrix,
    hamiltonian: DenseTimeDependentHamiltonian,
    dissipator: DenseDissipator,
    duration_us: float,
    max_step_us: float,
    *,
    checkpoint_times_us: Sequence[float] = (),
) -> TimeDependentEvolutionResult:
    """Evolve one segment with NumPy arrays instead of nested tuples.

    The integration contract matches ``evolve_time_dependent_segment``: fixed
    RK4 with stage-time Hamiltonian evaluation, raw metrics measured before a
    cleanup that is applied once after every complete step. Only the arithmetic
    container differs, which keeps larger Hilbert dimensions such as the
    four-transmon network within a usable runtime.
    """

    duration = _positive_finite(duration_us, "duration_us")
    max_step = _positive_finite(max_step_us, "max_step_us")
    dimension = _validate_square_finite_matrix(state, "state")
    relaxation = dissipator.relaxation_array(dimension)
    checkpoints = _normalize_checkpoint_times(checkpoint_times_us, duration)
    integration_boundaries = sorted(set((*checkpoints, duration)))

    evolved = np.asarray(state, dtype=np.complex128)
    raw_final_state = evolved
    current_time = 0.0
    internal_steps: list[float] = []
    recorded: list[TimeDependentCheckpoint] = []
    max_raw_trace_error = 0.0
    max_raw_hermiticity_error = 0.0
    min_raw_eigenvalue = math.inf
    max_cleanup_correction = 0.0

    checkpoint_index = 0
    if checkpoints and checkpoints[0] == 0.0:
        initial_matrix = _matrix_from_array(evolved)
        recorded.append(TimeDependentCheckpoint(
            time_us=0.0,
            raw_state=initial_matrix,
            cleaned_state=initial_matrix,
            raw_physicality=_dense_physicality_metrics(evolved),
            cleanup_correction_norm=0.0,
        ))
        checkpoint_index = 1

    for boundary in integration_boundaries:
        if boundary <= current_time + TIME_TOLERANCE_US:
            continue

        last_raw_at_boundary: np.ndarray | None = None
        last_metrics_at_boundary: PhysicalityMetrics | None = None
        last_correction_at_boundary = 0.0
        segment_hamiltonian = hamiltonian.for_segment(current_time, boundary)

        while current_time < boundary - TIME_TOLERANCE_US:
            step = min(max_step, boundary - current_time)
            if step <= 0.0:
                raise RuntimeError("time-dependent integration did not advance")

            raw_state = _dense_rk4_time_dependent_step(
                evolved,
                segment_hamiltonian,
                dissipator,
                relaxation,
                current_time,
                step,
                dimension,
            )
            metrics = _dense_physicality_metrics(raw_state)
            cleaned_state = _dense_clean_density_matrix(raw_state)
            correction_norm = float(
                np.linalg.norm(raw_state - cleaned_state, ord="fro")
            )

            max_raw_trace_error = max(max_raw_trace_error, metrics.trace_error)
            max_raw_hermiticity_error = max(
                max_raw_hermiticity_error,
                metrics.hermiticity_error,
            )
            min_raw_eigenvalue = min(
                min_raw_eigenvalue,
                metrics.minimum_eigenvalue,
            )
            max_cleanup_correction = max(
                max_cleanup_correction,
                correction_norm,
            )

            internal_steps.append(step)
            current_time += step
            if math.isclose(
                current_time,
                boundary,
                rel_tol=0.0,
                abs_tol=TIME_TOLERANCE_US,
            ):
                current_time = boundary

            evolved = cleaned_state
            raw_final_state = raw_state
            last_raw_at_boundary = raw_state
            last_metrics_at_boundary = metrics
            last_correction_at_boundary = correction_norm

        while (
            checkpoint_index < len(checkpoints)
            and math.isclose(
                checkpoints[checkpoint_index],
                boundary,
                rel_tol=0.0,
                abs_tol=TIME_TOLERANCE_US,
            )
        ):
            if last_raw_at_boundary is None or last_metrics_at_boundary is None:
                last_raw_at_boundary = evolved
                last_metrics_at_boundary = _dense_physicality_metrics(evolved)
            recorded.append(TimeDependentCheckpoint(
                time_us=boundary,
                raw_state=_matrix_from_array(last_raw_at_boundary),
                cleaned_state=_matrix_from_array(evolved),
                raw_physicality=last_metrics_at_boundary,
                cleanup_correction_norm=last_correction_at_boundary,
            ))
            checkpoint_index += 1

    if not internal_steps:
        raise RuntimeError("time-dependent integration produced no steps")

    diagnostics = TimeDependentEvolutionDiagnostics(
        internal_step_count=len(internal_steps),
        rhs_evaluation_count=4 * len(internal_steps),
        hamiltonian_evaluation_count=4 * len(internal_steps),
        minimum_internal_step_us=min(internal_steps),
        maximum_internal_step_us=max(internal_steps),
        raw_trace_error=max_raw_trace_error,
        raw_hermiticity_error=max_raw_hermiticity_error,
        raw_minimum_eigenvalue=min_raw_eigenvalue,
        cleanup_correction_norm=max_cleanup_correction,
        actual_duration_us=current_time,
    )
    return TimeDependentEvolutionResult(
        state=_matrix_from_array(evolved),
        raw_final_state=_matrix_from_array(raw_final_state),
        checkpoints=tuple(recorded),
        diagnostics=diagnostics,
    )


def physicality_metrics(state: Matrix) -> PhysicalityMetrics:
    """Measure raw trace, Hermiticity, and Hermitian-part eigenvalues."""

    _validate_square_finite_matrix(state, "state")
    array = np.asarray(state, dtype=np.complex128)
    hermitian = 0.5 * (array + array.conj().T)
    eigenvalues = np.linalg.eigvalsh(hermitian)
    return PhysicalityMetrics(
        trace_error=float(abs(trace(state) - 1.0)),
        hermiticity_error=float(np.max(np.abs(array - array.conj().T))),
        minimum_eigenvalue=float(np.min(eigenvalues)),
    )


def _rk4_time_dependent_step(
    state: Matrix,
    hamiltonian: TimeDependentHamiltonian,
    collapse_ops: Sequence[CachedCollapseOperator],
    local_time_us: float,
    step_us: float,
    dimension: int,
    backend: ResolvedTimeDependentEvolutionBackend,
) -> Matrix:
    half_time = local_time_us + 0.5 * step_us
    end_time = local_time_us + step_us

    h1 = _evaluate_hamiltonian(hamiltonian, local_time_us, dimension)
    h2 = _evaluate_hamiltonian(hamiltonian, half_time, dimension)
    h3 = _evaluate_hamiltonian(hamiltonian, half_time, dimension)
    h4 = _evaluate_hamiltonian(hamiltonian, end_time, dimension)

    if backend == "rust":
        return rust_rk4_time_dependent_step(
            state,
            (h1, h2, h3, h4),
            tuple(collapse_op.operator for collapse_op in collapse_ops),
            step_us,
        )

    k1 = lindblad_rhs_cached(state, h1, collapse_ops)

    k2 = lindblad_rhs_cached(
        add(state, scale(0.5 * step_us, k1)),
        h2,
        collapse_ops,
    )

    k3 = lindblad_rhs_cached(
        add(state, scale(0.5 * step_us, k2)),
        h3,
        collapse_ops,
    )

    k4 = lindblad_rhs_cached(
        add(state, scale(step_us, k3)),
        h4,
        collapse_ops,
    )
    return add(
        state,
        scale(
            step_us / 6.0,
            add(k1, scale(2.0, k2), scale(2.0, k3), k4),
        ),
    )


def _dense_rk4_time_dependent_step(
    state: np.ndarray,
    hamiltonian: DenseTimeDependentHamiltonian,
    dissipator: DenseDissipator,
    relaxation: np.ndarray,
    local_time_us: float,
    step_us: float,
    dimension: int,
) -> np.ndarray:
    half_time = local_time_us + 0.5 * step_us
    end_time = local_time_us + step_us

    h1 = _dense_evaluate_hamiltonian(hamiltonian, local_time_us, dimension)
    h2 = _dense_evaluate_hamiltonian(hamiltonian, half_time, dimension)
    h3 = _dense_evaluate_hamiltonian(hamiltonian, half_time, dimension)
    h4 = _dense_evaluate_hamiltonian(hamiltonian, end_time, dimension)

    k1 = _dense_lindblad_rhs(state, h1, dissipator, relaxation)
    k2 = _dense_lindblad_rhs(
        state + (0.5 * step_us) * k1,
        h2,
        dissipator,
        relaxation,
    )
    k3 = _dense_lindblad_rhs(
        state + (0.5 * step_us) * k2,
        h3,
        dissipator,
        relaxation,
    )
    k4 = _dense_lindblad_rhs(
        state + step_us * k3,
        h4,
        dissipator,
        relaxation,
    )
    return state + (step_us / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def _dense_lindblad_rhs(
    rho: np.ndarray,
    hamiltonian: np.ndarray,
    dissipator: DenseDissipator,
    relaxation: np.ndarray,
) -> np.ndarray:
    """Return the Lindblad derivative in non-Hermitian effective-drift form.

    Folding the precomputed sum of L-dagger L into an effective Hamiltonian
    turns the coherent and anticommutator terms into a single pair of dense
    products. That is algebraically identical to evaluating each dissipator
    separately and is what keeps the four-transmon register affordable.
    """

    effective = hamiltonian - 0.5j * relaxation
    derivative = -1j * (effective @ rho - rho @ effective.conj().T)
    derivative += dissipator.apply_jumps(rho)
    return derivative


def _dense_clean_density_matrix(rho: np.ndarray) -> np.ndarray:
    hermitian = 0.5 * (rho + rho.conj().T)
    trace_value = np.trace(hermitian)
    if abs(trace_value) == 0.0:
        raise ValueError("density matrix trace vanished during evolution")
    return hermitian / trace_value


def _dense_physicality_metrics(state: np.ndarray) -> PhysicalityMetrics:
    hermitian = 0.5 * (state + state.conj().T)
    eigenvalues = np.linalg.eigvalsh(hermitian)
    return PhysicalityMetrics(
        trace_error=float(abs(np.trace(state) - 1.0)),
        hermiticity_error=float(np.max(np.abs(state - state.conj().T))),
        minimum_eigenvalue=float(np.min(eigenvalues)),
    )


def _dense_evaluate_hamiltonian(
    provider: DenseTimeDependentHamiltonian,
    local_time_us: float,
    dimension: int,
) -> np.ndarray:
    matrix = provider.evaluate_array(local_time_us)
    if matrix.shape != (dimension, dimension):
        raise ValueError("hamiltonian dimension must match state dimension")
    if not np.all(np.isfinite(matrix)):
        raise ValueError("hamiltonian must contain finite values")
    return matrix


def _matrix_from_array(array: np.ndarray) -> Matrix:
    return tuple(tuple(complex(value) for value in row) for row in array)


def resolve_time_dependent_backend(
    backend: TimeDependentEvolutionBackend,
) -> ResolvedTimeDependentEvolutionBackend:
    if backend not in ("python", "rust", "auto"):
        raise ValueError("backend must be 'python', 'rust', or 'auto'")
    if backend == "auto":
        return "rust" if is_rust_kernel_available() else "python"
    if backend == "rust" and not is_rust_kernel_available():
        raise RuntimeError("Rust time-dependent kernel is unavailable")
    return backend


def _evaluate_hamiltonian(
    provider: TimeDependentHamiltonian,
    local_time_us: float,
    dimension: int,
) -> Matrix:
    matrix = provider.evaluate(local_time_us)
    actual_dimension = _validate_square_finite_matrix(
        matrix,
        "hamiltonian",
    )
    if actual_dimension != dimension:
        raise ValueError("hamiltonian dimension must match state dimension")
    return matrix


def _normalize_checkpoint_times(
    checkpoint_times_us: Sequence[float],
    duration_us: float,
) -> tuple[float, ...]:
    normalized: list[float] = []
    previous = -math.inf
    for index, value in enumerate(checkpoint_times_us):
        time_us = float(value)
        if not math.isfinite(time_us):
            raise ValueError(
                f"checkpoint_times_us[{index}] must be finite"
            )
        if time_us < 0.0 or time_us > duration_us:
            raise ValueError(
                "checkpoint times must be within the segment duration"
            )
        if time_us <= previous:
            raise ValueError(
                "checkpoint_times_us must be strictly increasing"
            )
        normalized.append(time_us)
        previous = time_us

    if not normalized or normalized[-1] != duration_us:
        normalized.append(duration_us)
    return tuple(normalized)


def _validate_collapse_operators(
    collapse_ops: Sequence[CachedCollapseOperator],
    dimension: int,
) -> None:
    for index, collapse_op in enumerate(collapse_ops):
        for name, matrix in (
            ("operator", collapse_op.operator),
            ("operator_adjoint", collapse_op.operator_adjoint),
            (
                "operator_adjoint_operator",
                collapse_op.operator_adjoint_operator,
            ),
        ):
            actual_dimension = _validate_square_finite_matrix(
                matrix,
                f"collapse_ops[{index}].{name}",
            )
            if actual_dimension != dimension:
                raise ValueError(
                    "collapse operator dimension must match state dimension"
                )


def _positive_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted <= 0.0:
        raise ValueError(f"{field_name} must be finite and greater than 0")
    return converted


def _validate_square_finite_matrix(matrix: Matrix, field_name: str) -> int:
    dimension = len(matrix)
    if dimension == 0:
        raise ValueError(f"{field_name} must not be empty")
    for row in matrix:
        if len(row) != dimension:
            raise ValueError(f"{field_name} must be square")
        for entry in row:
            if not math.isfinite(entry.real) or not math.isfinite(entry.imag):
                raise ValueError(f"{field_name} must contain finite values")
    return dimension


def _frobenius_difference(left: Matrix, right: Matrix) -> float:
    left_array = np.asarray(left, dtype=np.complex128)
    right_array = np.asarray(right, dtype=np.complex128)
    return float(np.linalg.norm(left_array - right_array, ord="fro"))
