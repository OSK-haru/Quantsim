"""Explicit Kraus-map contract and qubit CPTP channels.

The Choi convention is unnormalized:

    J(E) = sum_ij |i><j| tensor E(|i><j|)

The basis order is input tensor output. Composite indices use ``i * d + a``,
where ``i`` is the input index and ``a`` is the output index. A
trace-preserving map therefore has ``trace(J) == d``.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

import numpy as np

from core.gates import Matrix


CHOI_CONVENTION_ID = "unnormalized_input_output_row_major_v1"
DEFAULT_CP_TOLERANCE = 1e-12
DEFAULT_TP_TOLERANCE = 1e-12


@dataclass(frozen=True)
class ChoiAudit:
    """Standalone audit for a Choi matrix under the frozen convention."""

    dimension: int
    choi_convention_id: str
    choi_trace: float
    choi_hermiticity_error: float
    choi_minimum_eigenvalue: float
    choi_numerical_rank: int
    trace_preservation_frobenius_error: float
    trace_preservation_max_abs_error: float
    cp_tolerance: float
    tp_tolerance: float

    @property
    def is_completely_positive(self) -> bool:
        return (
            self.choi_hermiticity_error <= self.cp_tolerance
            and self.choi_minimum_eigenvalue >= -self.cp_tolerance
        )

    @property
    def is_trace_preserving(self) -> bool:
        return self.trace_preservation_frobenius_error <= self.tp_tolerance

    @property
    def is_cptp(self) -> bool:
        return self.is_completely_positive and self.is_trace_preserving

    def to_dict(self) -> dict[str, bool | float | int | str]:
        return {
            "dimension": self.dimension,
            "choi_convention_id": self.choi_convention_id,
            "choi_trace": self.choi_trace,
            "choi_hermiticity_error": self.choi_hermiticity_error,
            "choi_minimum_eigenvalue": self.choi_minimum_eigenvalue,
            "choi_numerical_rank": self.choi_numerical_rank,
            "trace_preservation_frobenius_error": (
                self.trace_preservation_frobenius_error
            ),
            "trace_preservation_max_abs_error": (
                self.trace_preservation_max_abs_error
            ),
            "cp_tolerance": self.cp_tolerance,
            "tp_tolerance": self.tp_tolerance,
            "is_completely_positive": self.is_completely_positive,
            "is_trace_preserving": self.is_trace_preserving,
            "is_cptp": self.is_cptp,
        }


@dataclass(frozen=True)
class CPTPAudit:
    """Numerical audit of one Kraus map under the frozen Choi convention."""

    dimension: int
    kraus_operator_count: int
    choi_convention_id: str
    choi_trace: float
    choi_hermiticity_error: float
    choi_minimum_eigenvalue: float
    choi_numerical_rank: int
    choi_trace_preservation_frobenius_error: float
    choi_trace_preservation_max_abs_error: float
    trace_preservation_frobenius_error: float
    trace_preservation_max_abs_error: float
    trace_nonincrease_minimum_eigenvalue: float
    cp_tolerance: float
    tp_tolerance: float

    @property
    def is_completely_positive(self) -> bool:
        return (
            self.choi_hermiticity_error <= self.cp_tolerance
            and self.choi_minimum_eigenvalue >= -self.cp_tolerance
        )

    @property
    def is_trace_preserving(self) -> bool:
        return (
            self.trace_preservation_frobenius_error <= self.tp_tolerance
            and self.choi_trace_preservation_frobenius_error
            <= self.tp_tolerance
        )

    @property
    def is_trace_nonincreasing(self) -> bool:
        return (
            self.trace_nonincrease_minimum_eigenvalue
            >= -self.tp_tolerance
        )

    @property
    def is_cptp(self) -> bool:
        return self.is_completely_positive and self.is_trace_preserving

    def to_dict(self) -> dict[str, bool | float | int | str]:
        return {
            "dimension": self.dimension,
            "kraus_operator_count": self.kraus_operator_count,
            "choi_convention_id": self.choi_convention_id,
            "choi_trace": self.choi_trace,
            "choi_hermiticity_error": self.choi_hermiticity_error,
            "choi_minimum_eigenvalue": self.choi_minimum_eigenvalue,
            "choi_numerical_rank": self.choi_numerical_rank,
            "choi_trace_preservation_frobenius_error": (
                self.choi_trace_preservation_frobenius_error
            ),
            "choi_trace_preservation_max_abs_error": (
                self.choi_trace_preservation_max_abs_error
            ),
            "trace_preservation_frobenius_error": (
                self.trace_preservation_frobenius_error
            ),
            "trace_preservation_max_abs_error": (
                self.trace_preservation_max_abs_error
            ),
            "trace_nonincrease_minimum_eigenvalue": (
                self.trace_nonincrease_minimum_eigenvalue
            ),
            "cp_tolerance": self.cp_tolerance,
            "tp_tolerance": self.tp_tolerance,
            "is_completely_positive": self.is_completely_positive,
            "is_trace_preserving": self.is_trace_preserving,
            "is_trace_nonincreasing": self.is_trace_nonincreasing,
            "is_cptp": self.is_cptp,
        }


def audit_choi_matrix(
    choi_matrix: Matrix,
    dimension: int,
    *,
    cp_tolerance: float = DEFAULT_CP_TOLERANCE,
    tp_tolerance: float = DEFAULT_TP_TOLERANCE,
) -> ChoiAudit:
    """Audit an arbitrary Choi matrix without requiring Kraus operators."""

    validated_dimension = _positive_dimension(dimension)
    cp_tol = _nonnegative_finite(cp_tolerance, "cp_tolerance")
    tp_tol = _nonnegative_finite(tp_tolerance, "tp_tolerance")
    choi = _validated_choi_array(choi_matrix, validated_dimension)
    hermiticity_error = float(
        np.max(np.abs(choi - choi.conj().T))
    )
    hermitian_part = 0.5 * (choi + choi.conj().T)
    eigenvalues = np.linalg.eigvalsh(hermitian_part)
    output_trace = np.asarray(
        choi_partial_trace_output(choi_matrix, validated_dimension),
        dtype=np.complex128,
    )
    tp_residual = (
        output_trace
        - np.eye(validated_dimension, dtype=np.complex128)
    )
    return ChoiAudit(
        dimension=validated_dimension,
        choi_convention_id=CHOI_CONVENTION_ID,
        choi_trace=float(np.trace(choi).real),
        choi_hermiticity_error=hermiticity_error,
        choi_minimum_eigenvalue=float(np.min(eigenvalues)),
        choi_numerical_rank=int(np.count_nonzero(eigenvalues > cp_tol)),
        trace_preservation_frobenius_error=float(
            np.linalg.norm(tp_residual, ord="fro")
        ),
        trace_preservation_max_abs_error=float(
            np.max(np.abs(tp_residual))
        ),
        cp_tolerance=cp_tol,
        tp_tolerance=tp_tol,
    )


def choi_partial_trace_output(
    choi_matrix: Matrix,
    dimension: int,
) -> Matrix:
    """Trace out the output subsystem of an input-output ordered Choi matrix."""

    validated_dimension = _positive_dimension(dimension)
    choi = _validated_choi_array(choi_matrix, validated_dimension)
    tensor = choi.reshape(
        validated_dimension,
        validated_dimension,
        validated_dimension,
        validated_dimension,
    )
    return _to_matrix(np.einsum("iaja->ij", tensor))


def choi_partial_trace_input(
    choi_matrix: Matrix,
    dimension: int,
) -> Matrix:
    """Trace out the input subsystem, yielding E(I) for this convention."""

    validated_dimension = _positive_dimension(dimension)
    choi = _validated_choi_array(choi_matrix, validated_dimension)
    tensor = choi.reshape(
        validated_dimension,
        validated_dimension,
        validated_dimension,
        validated_dimension,
    )
    return _to_matrix(np.einsum("iaib->ab", tensor))


def identity_channel_choi_fixture(dimension: int) -> Matrix:
    """Return the exact unnormalized identity-channel Choi fixture."""

    validated_dimension = _positive_dimension(dimension)
    maximally_entangled = np.zeros(
        validated_dimension * validated_dimension,
        dtype=np.complex128,
    )
    for index in range(validated_dimension):
        maximally_entangled[
            index * validated_dimension + index
        ] = 1.0
    return _to_matrix(
        np.outer(maximally_entangled, maximally_entangled.conj())
    )


def compose_kraus_maps(
    maps: Sequence[KrausMap],
    *,
    name: str | None = None,
) -> KrausMap:
    """Compose CP maps in listed execution order.

    ``compose_kraus_maps((first, second))`` returns ``second(first(rho))``.
    """

    validated_maps = _validate_composition_maps(maps)
    return KrausMap(
        name=name or _composition_name(validated_maps),
        operators=_compose_operator_sequence(validated_maps),
    )


def compose_kraus_channels(
    channels: Sequence[KrausChannel],
    *,
    name: str | None = None,
) -> KrausChannel:
    """Compose CPTP channels in listed execution order."""

    validated_channels = _validate_composition_maps(channels)
    if not all(
        isinstance(channel, KrausChannel)
        for channel in validated_channels
    ):
        raise ValueError(
            "compose_kraus_channels requires KrausChannel inputs"
        )
    return KrausChannel(
        name=name or _composition_name(validated_channels),
        operators=_compose_operator_sequence(validated_channels),
    )


@dataclass(frozen=True)
class KrausMap:
    """A completely positive map represented by one or more Kraus operators."""

    name: str
    operators: tuple[Matrix, ...]

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("Kraus map name must not be empty")
        if not self.operators:
            raise ValueError("Kraus map must contain at least one operator")
        dimension = _validate_square_finite_matrix(
            self.operators[0],
            "operators[0]",
        )
        for index, operator in enumerate(self.operators[1:], start=1):
            actual_dimension = _validate_square_finite_matrix(
                operator,
                f"operators[{index}]",
            )
            if actual_dimension != dimension:
                raise ValueError(
                    "all Kraus operators must have the same dimension"
                )

    @property
    def dimension(self) -> int:
        return len(self.operators[0])

    def apply(self, state: Matrix) -> Matrix:
        """Apply the linear Kraus map without density-matrix cleanup."""

        state_array = _as_square_finite_array(state, "state")
        if state_array.shape[0] != self.dimension:
            raise ValueError(
                "state dimension must match Kraus operator dimension"
            )
        evolved = np.zeros_like(state_array)
        for operator in self.operators:
            operator_array = np.asarray(operator, dtype=np.complex128)
            evolved += (
                operator_array
                @ state_array
                @ operator_array.conj().T
            )
        return _to_matrix(evolved)

    def completeness_matrix(self) -> Matrix:
        """Return sum_k K_k^dagger K_k."""

        completeness = np.zeros(
            (self.dimension, self.dimension),
            dtype=np.complex128,
        )
        for operator in self.operators:
            operator_array = np.asarray(operator, dtype=np.complex128)
            completeness += operator_array.conj().T @ operator_array
        return _to_matrix(completeness)

    def choi_matrix(self) -> Matrix:
        """Return the unnormalized Choi matrix in input-output basis order."""

        dimension = self.dimension
        choi = np.zeros(
            (dimension * dimension, dimension * dimension),
            dtype=np.complex128,
        )
        for input_row in range(dimension):
            for input_column in range(dimension):
                basis = np.zeros(
                    (dimension, dimension),
                    dtype=np.complex128,
                )
                basis[input_row, input_column] = 1.0
                evolved = np.asarray(
                    self.apply(_to_matrix(basis)),
                    dtype=np.complex128,
                )
                row_start = input_row * dimension
                column_start = input_column * dimension
                choi[
                    row_start:row_start + dimension,
                    column_start:column_start + dimension,
                ] = evolved
        return _to_matrix(choi)

    def audit(
        self,
        *,
        cp_tolerance: float = DEFAULT_CP_TOLERANCE,
        tp_tolerance: float = DEFAULT_TP_TOLERANCE,
    ) -> CPTPAudit:
        """Audit CP, TP, and trace-nonincreasing conditions numerically."""

        cp_tol = _nonnegative_finite(cp_tolerance, "cp_tolerance")
        tp_tol = _nonnegative_finite(tp_tolerance, "tp_tolerance")
        identity = np.eye(self.dimension, dtype=np.complex128)
        completeness = np.asarray(
            self.completeness_matrix(),
            dtype=np.complex128,
        )
        tp_residual = completeness - identity
        trace_nonincrease_residual = identity - completeness
        trace_nonincrease_hermitian = 0.5 * (
            trace_nonincrease_residual
            + trace_nonincrease_residual.conj().T
        )
        choi_audit = audit_choi_matrix(
            self.choi_matrix(),
            self.dimension,
            cp_tolerance=cp_tol,
            tp_tolerance=tp_tol,
        )
        return CPTPAudit(
            dimension=self.dimension,
            kraus_operator_count=len(self.operators),
            choi_convention_id=CHOI_CONVENTION_ID,
            choi_trace=choi_audit.choi_trace,
            choi_hermiticity_error=(
                choi_audit.choi_hermiticity_error
            ),
            choi_minimum_eigenvalue=(
                choi_audit.choi_minimum_eigenvalue
            ),
            choi_numerical_rank=choi_audit.choi_numerical_rank,
            choi_trace_preservation_frobenius_error=(
                choi_audit.trace_preservation_frobenius_error
            ),
            choi_trace_preservation_max_abs_error=(
                choi_audit.trace_preservation_max_abs_error
            ),
            trace_preservation_frobenius_error=float(
                np.linalg.norm(tp_residual, ord="fro")
            ),
            trace_preservation_max_abs_error=float(
                np.max(np.abs(tp_residual))
            ),
            trace_nonincrease_minimum_eigenvalue=float(
                np.min(
                    np.linalg.eigvalsh(trace_nonincrease_hermitian)
                )
            ),
            cp_tolerance=cp_tol,
            tp_tolerance=tp_tol,
        )


@dataclass(frozen=True)
class KrausChannel(KrausMap):
    """A Kraus map whose trace-preservation condition is enforced."""

    def __post_init__(self) -> None:
        super().__post_init__()
        if (
            self.audit().trace_preservation_frobenius_error
            > DEFAULT_TP_TOLERANCE
        ):
            raise ValueError(
                "KrausChannel operators must satisfy trace preservation"
            )


def amplitude_damping_channel(
    damping_probability: float,
) -> KrausChannel:
    """Return the qubit |1> to |0> amplitude-damping channel."""

    probability = _probability(
        damping_probability,
        "damping_probability",
    )
    return KrausChannel(
        name="qubit_amplitude_damping",
        operators=(
            _matrix((
                (1.0, 0.0),
                (0.0, math.sqrt(1.0 - probability)),
            )),
            _matrix((
                (0.0, math.sqrt(probability)),
                (0.0, 0.0),
            )),
        ),
    )


def generalized_amplitude_damping_channel(
    damping_probability: float,
    equilibrium_ground_population: float,
) -> KrausChannel:
    """Return a qubit generalized amplitude-damping channel.

    At full damping, the fixed state is
    ``diag(equilibrium_ground_population, 1 - equilibrium_ground_population)``.
    """

    probability = _probability(
        damping_probability,
        "damping_probability",
    )
    ground_population = _probability(
        equilibrium_ground_population,
        "equilibrium_ground_population",
    )
    excited_population = 1.0 - ground_population
    sqrt_survival = math.sqrt(1.0 - probability)
    sqrt_damping = math.sqrt(probability)
    return KrausChannel(
        name="qubit_generalized_amplitude_damping",
        operators=(
            _scale_matrix(math.sqrt(ground_population), (
                (1.0, 0.0),
                (0.0, sqrt_survival),
            )),
            _scale_matrix(math.sqrt(ground_population), (
                (0.0, sqrt_damping),
                (0.0, 0.0),
            )),
            _scale_matrix(math.sqrt(excited_population), (
                (sqrt_survival, 0.0),
                (0.0, 1.0),
            )),
            _scale_matrix(math.sqrt(excited_population), (
                (0.0, 0.0),
                (sqrt_damping, 0.0),
            )),
        ),
    )


def phase_damping_channel(
    dephasing_probability: float,
) -> KrausChannel:
    """Return a channel that multiplies qubit coherence by ``1 - p``."""

    probability = _probability(
        dephasing_probability,
        "dephasing_probability",
    )
    return KrausChannel(
        name="qubit_phase_damping",
        operators=(
            _scale_matrix(math.sqrt(1.0 - probability), (
                (1.0, 0.0),
                (0.0, 1.0),
            )),
            _scale_matrix(math.sqrt(probability), (
                (1.0, 0.0),
                (0.0, 0.0),
            )),
            _scale_matrix(math.sqrt(probability), (
                (0.0, 0.0),
                (0.0, 1.0),
            )),
        ),
    )


def depolarizing_channel(
    depolarizing_probability: float,
) -> KrausChannel:
    """Return E(rho) = (1 - p) rho + p I/2 for normalized qubit states."""

    probability = _probability(
        depolarizing_probability,
        "depolarizing_probability",
    )
    identity_weight = math.sqrt(1.0 - 0.75 * probability)
    pauli_weight = math.sqrt(0.25 * probability)
    return KrausChannel(
        name="qubit_depolarizing",
        operators=(
            _scale_matrix(identity_weight, (
                (1.0, 0.0),
                (0.0, 1.0),
            )),
            _scale_matrix(pauli_weight, (
                (0.0, 1.0),
                (1.0, 0.0),
            )),
            _scale_matrix(pauli_weight, (
                (0.0, -1.0j),
                (1.0j, 0.0),
            )),
            _scale_matrix(pauli_weight, (
                (1.0, 0.0),
                (0.0, -1.0),
            )),
        ),
    )


def reset_to_zero_channel() -> KrausChannel:
    """Return the deterministic qubit reset-to-|0> channel."""

    return KrausChannel(
        name="qubit_reset_to_zero",
        operators=(
            _matrix((
                (1.0, 0.0),
                (0.0, 0.0),
            )),
            _matrix((
                (0.0, 1.0),
                (0.0, 0.0),
            )),
        ),
    )


def computational_measurement_channel() -> KrausChannel:
    """Return computational-basis measurement with outcomes discarded."""

    outcome_maps = computational_measurement_instrument()
    return KrausChannel(
        name="qubit_computational_measurement_discarded",
        operators=tuple(
            outcome_map.operators[0] for outcome_map in outcome_maps
        ),
    )


def computational_measurement_instrument() -> tuple[KrausMap, KrausMap]:
    """Return outcome-0 and outcome-1 CP trace-nonincreasing maps."""

    return (
        KrausMap(
            name="qubit_computational_measurement_outcome_0",
            operators=(_matrix((
                (1.0, 0.0),
                (0.0, 0.0),
            )),),
        ),
        KrausMap(
            name="qubit_computational_measurement_outcome_1",
            operators=(_matrix((
                (0.0, 0.0),
                (0.0, 1.0),
            )),),
        ),
    )


def _matrix(rows: Sequence[Sequence[complex]]) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in rows
    )


def _scale_matrix(
    scalar: float,
    rows: Sequence[Sequence[complex]],
) -> Matrix:
    return tuple(
        tuple(scalar * complex(value) for value in row)
        for row in rows
    )


def _to_matrix(array: np.ndarray) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
    )


def _as_square_finite_array(
    matrix: Matrix,
    field_name: str,
) -> np.ndarray:
    _validate_square_finite_matrix(matrix, field_name)
    return np.asarray(matrix, dtype=np.complex128)


def _validated_choi_array(
    choi_matrix: Matrix,
    dimension: int,
) -> np.ndarray:
    choi = _as_square_finite_array(choi_matrix, "choi_matrix")
    expected_size = dimension * dimension
    if choi.shape != (expected_size, expected_size):
        raise ValueError(
            "choi_matrix dimension must equal dimension squared"
        )
    return choi


def _validate_composition_maps(
    maps: Sequence[KrausMap],
) -> tuple[KrausMap, ...]:
    validated = tuple(maps)
    if not validated:
        raise ValueError("at least one Kraus map is required for composition")
    if not all(isinstance(kraus_map, KrausMap) for kraus_map in validated):
        raise ValueError("composition inputs must be KrausMap instances")
    dimension = validated[0].dimension
    if any(kraus_map.dimension != dimension for kraus_map in validated[1:]):
        raise ValueError("all composed Kraus maps must have the same dimension")
    return validated


def _compose_operator_sequence(
    maps: Sequence[KrausMap],
) -> tuple[Matrix, ...]:
    composed = tuple(
        np.asarray(operator, dtype=np.complex128)
        for operator in maps[0].operators
    )
    for next_map in maps[1:]:
        composed = tuple(
            np.asarray(next_operator, dtype=np.complex128)
            @ prior_operator
            for next_operator in next_map.operators
            for prior_operator in composed
        )
    return tuple(_to_matrix(operator) for operator in composed)


def _composition_name(maps: Sequence[KrausMap]) -> str:
    return "compose[" + " -> ".join(kraus_map.name for kraus_map in maps) + "]"


def _validate_square_finite_matrix(
    matrix: Matrix,
    field_name: str,
) -> int:
    dimension = len(matrix)
    if dimension == 0:
        raise ValueError(f"{field_name} must not be empty")
    for row in matrix:
        if len(row) != dimension:
            raise ValueError(f"{field_name} must be square")
        for value in row:
            converted = complex(value)
            if (
                not math.isfinite(converted.real)
                or not math.isfinite(converted.imag)
            ):
                raise ValueError(f"{field_name} must contain finite values")
    return dimension


def _positive_dimension(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("dimension must be a positive integer")
    return value


def _probability(value: float, field_name: str) -> float:
    converted = float(value)
    if (
        not math.isfinite(converted)
        or converted < 0.0
        or converted > 1.0
    ):
        raise ValueError(f"{field_name} must be finite and within [0, 1]")
    return converted


def _nonnegative_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted < 0.0:
        raise ValueError(f"{field_name} must be finite and non-negative")
    return converted
