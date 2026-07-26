"""Time-independent GKSL evolution through a dense exponential map."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from core.cptp import (
    DEFAULT_CP_TOLERANCE,
    DEFAULT_TP_TOLERANCE,
    ChoiAudit,
    audit_choi_matrix,
)
from core.gates import Matrix


LIOUVILLIAN_VECTORIZATION_ID = "column_major_vec_f_v1"
MATRIX_EXPONENTIAL_METHOD = "scaling_squaring_pade13_numpy_v1"
HAMILTONIAN_HERMITICITY_TOLERANCE = 1e-12
PADE13_THETA = 5.371920351148152
PADE13_COEFFICIENTS = (
    64764752532480000.0,
    32382376266240000.0,
    7771770303897600.0,
    1187353796428800.0,
    129060195264000.0,
    10559470521600.0,
    670442572800.0,
    33522128640.0,
    1323241920.0,
    40840800.0,
    960960.0,
    16380.0,
    182.0,
    1.0,
)


@dataclass(frozen=True)
class GKSLExponentialMap:
    """Finite-time map exp(duration * L) for a time-independent GKSL model."""

    name: str
    dimension: int
    duration_us: float
    superoperator: Matrix
    choi_matrix: Matrix
    audit: ChoiAudit
    vectorization_id: str = LIOUVILLIAN_VECTORIZATION_ID
    exponential_method: str = MATRIX_EXPONENTIAL_METHOD

    def apply(self, state: Matrix) -> Matrix:
        """Apply the finite-time linear map without cleanup."""

        return apply_superoperator(
            self.superoperator,
            state,
            self.dimension,
        )

    def to_metadata(self) -> dict[str, object]:
        return {
            "name": self.name,
            "dimension": self.dimension,
            "duration_us": self.duration_us,
            "vectorization_id": self.vectorization_id,
            "exponential_method": self.exponential_method,
            "audit": self.audit.to_dict(),
        }


def gksl_liouvillian_superoperator(
    hamiltonian: Matrix,
    collapse_operators: Sequence[Matrix],
) -> Matrix:
    """Build the GKSL generator in column-major vectorization.

    Hamiltonian units are rad/us and collapse operators carry sqrt(1/us), so
    the returned superoperator has units 1/us.
    """

    hamiltonian_array = _as_square_finite_array(
        hamiltonian,
        "hamiltonian",
    )
    dimension = hamiltonian_array.shape[0]
    hermiticity_error = float(
        np.max(
            np.abs(
                hamiltonian_array
                - hamiltonian_array.conj().T
            )
        )
    )
    if hermiticity_error > HAMILTONIAN_HERMITICITY_TOLERANCE:
        raise ValueError("hamiltonian must be Hermitian")

    identity = np.eye(dimension, dtype=np.complex128)
    generator = -1.0j * (
        np.kron(identity, hamiltonian_array)
        - np.kron(hamiltonian_array.T, identity)
    )
    for index, collapse_operator in enumerate(collapse_operators):
        collapse = _as_square_finite_array(
            collapse_operator,
            f"collapse_operators[{index}]",
        )
        if collapse.shape != hamiltonian_array.shape:
            raise ValueError(
                "collapse operator dimension must match hamiltonian"
            )
        collapse_adjoint_collapse = collapse.conj().T @ collapse
        generator += np.kron(collapse.conj(), collapse)
        generator -= 0.5 * np.kron(
            identity,
            collapse_adjoint_collapse,
        )
        generator -= 0.5 * np.kron(
            collapse_adjoint_collapse.T,
            identity,
        )
    return _to_matrix(generator)


def gksl_exponential_map(
    hamiltonian: Matrix,
    collapse_operators: Sequence[Matrix],
    duration_us: float,
    *,
    name: str = "time_independent_gksl_exponential",
    cp_tolerance: float = DEFAULT_CP_TOLERANCE,
    tp_tolerance: float = DEFAULT_TP_TOLERANCE,
) -> GKSLExponentialMap:
    """Construct and audit exp(duration * L) for one constant segment."""

    duration = _nonnegative_finite(duration_us, "duration_us")
    generator = gksl_liouvillian_superoperator(
        hamiltonian,
        collapse_operators,
    )
    dimension = len(hamiltonian)
    generator_array = np.asarray(generator, dtype=np.complex128)
    superoperator = _to_matrix(
        dense_matrix_exponential(duration * generator_array)
    )
    choi = superoperator_to_choi(superoperator, dimension)
    audit = audit_choi_matrix(
        choi,
        dimension,
        cp_tolerance=cp_tolerance,
        tp_tolerance=tp_tolerance,
    )
    if not audit.is_cptp:
        raise RuntimeError(
            "GKSL exponential failed the configured CPTP audit"
        )
    return GKSLExponentialMap(
        name=name,
        dimension=dimension,
        duration_us=duration,
        superoperator=superoperator,
        choi_matrix=choi,
        audit=audit,
    )


def apply_superoperator(
    superoperator: Matrix,
    state: Matrix,
    dimension: int,
) -> Matrix:
    """Apply a column-major dense superoperator to one matrix."""

    validated_dimension = _positive_dimension(dimension)
    superoperator_array = _validated_superoperator_array(
        superoperator,
        validated_dimension,
    )
    state_array = _as_square_finite_array(state, "state")
    if state_array.shape != (
        validated_dimension,
        validated_dimension,
    ):
        raise ValueError("state dimension must match superoperator")
    vectorized = state_array.reshape(
        validated_dimension * validated_dimension,
        order="F",
    )
    evolved = superoperator_array @ vectorized
    return _to_matrix(
        evolved.reshape(
            (validated_dimension, validated_dimension),
            order="F",
        )
    )


def superoperator_to_choi(
    superoperator: Matrix,
    dimension: int,
) -> Matrix:
    """Convert a vec_F superoperator to the frozen input-output Choi order."""

    validated_dimension = _positive_dimension(dimension)
    _validated_superoperator_array(
        superoperator,
        validated_dimension,
    )
    choi = np.zeros(
        (
            validated_dimension * validated_dimension,
            validated_dimension * validated_dimension,
        ),
        dtype=np.complex128,
    )
    for input_row in range(validated_dimension):
        for input_column in range(validated_dimension):
            basis = np.zeros(
                (validated_dimension, validated_dimension),
                dtype=np.complex128,
            )
            basis[input_row, input_column] = 1.0
            evolved = np.asarray(
                apply_superoperator(
                    superoperator,
                    _to_matrix(basis),
                    validated_dimension,
                ),
                dtype=np.complex128,
            )
            row_start = input_row * validated_dimension
            column_start = input_column * validated_dimension
            choi[
                row_start:row_start + validated_dimension,
                column_start:column_start + validated_dimension,
            ] = evolved
    return _to_matrix(choi)


def dense_matrix_exponential(matrix: Matrix | np.ndarray) -> np.ndarray:
    """Compute a small dense matrix exponential with Pade(13)."""

    array = np.asarray(matrix, dtype=np.complex128)
    if array.ndim != 2 or array.shape[0] == 0 or array.shape[0] != array.shape[1]:
        raise ValueError("matrix must be a non-empty square matrix")
    if not np.all(np.isfinite(array.real)) or not np.all(
        np.isfinite(array.imag)
    ):
        raise ValueError("matrix must contain finite values")

    one_norm = float(np.linalg.norm(array, ord=1))
    if one_norm == 0.0:
        return np.eye(array.shape[0], dtype=np.complex128)
    scaling_steps = max(
        0,
        int(math.ceil(math.log2(one_norm / PADE13_THETA))),
    )
    scaled = array / (2.0**scaling_steps)
    approximation = _pade13(scaled)
    for _ in range(scaling_steps):
        approximation = approximation @ approximation
    return approximation


def _pade13(matrix: np.ndarray) -> np.ndarray:
    identity = np.eye(matrix.shape[0], dtype=np.complex128)
    matrix_2 = matrix @ matrix
    matrix_4 = matrix_2 @ matrix_2
    matrix_6 = matrix_4 @ matrix_2
    coefficients = PADE13_COEFFICIENTS

    numerator = matrix @ (
        matrix_6
        @ (
            coefficients[13] * matrix_6
            + coefficients[11] * matrix_4
            + coefficients[9] * matrix_2
        )
        + coefficients[7] * matrix_6
        + coefficients[5] * matrix_4
        + coefficients[3] * matrix_2
        + coefficients[1] * identity
    )
    denominator = (
        matrix_6
        @ (
            coefficients[12] * matrix_6
            + coefficients[10] * matrix_4
            + coefficients[8] * matrix_2
        )
        + coefficients[6] * matrix_6
        + coefficients[4] * matrix_4
        + coefficients[2] * matrix_2
        + coefficients[0] * identity
    )
    return np.linalg.solve(
        denominator - numerator,
        denominator + numerator,
    )


def _validated_superoperator_array(
    superoperator: Matrix,
    dimension: int,
) -> np.ndarray:
    array = _as_square_finite_array(
        superoperator,
        "superoperator",
    )
    expected_dimension = dimension * dimension
    if array.shape != (expected_dimension, expected_dimension):
        raise ValueError(
            "superoperator dimension must equal dimension squared"
        )
    return array


def _as_square_finite_array(
    matrix: Matrix,
    field_name: str,
) -> np.ndarray:
    array = np.asarray(matrix, dtype=np.complex128)
    if array.ndim != 2 or array.shape[0] == 0 or array.shape[0] != array.shape[1]:
        raise ValueError(f"{field_name} must be a non-empty square matrix")
    if not np.all(np.isfinite(array.real)) or not np.all(
        np.isfinite(array.imag)
    ):
        raise ValueError(f"{field_name} must contain finite values")
    return array


def _to_matrix(array: np.ndarray) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
    )


def _positive_dimension(value: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError("dimension must be a positive integer")
    return value


def _nonnegative_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted < 0.0:
        raise ValueError(f"{field_name} must be finite and non-negative")
    return converted
