"""Standalone Python wrapper for optional Rust dense kernels."""

from __future__ import annotations

import importlib
import math
from collections.abc import Sequence

from core.gates import Matrix


def is_rust_kernel_available() -> bool:
    """Return whether the optional quantascope_rust module is importable."""

    try:
        importlib.import_module("quantascope_rust")
    except Exception:
        return False
    return True


def flatten_complex_matrix(matrix: Sequence[Sequence[complex]]) -> list[float]:
    """Return row-major interleaved complex values for a square matrix."""

    dimension = _validate_square_matrix(matrix, "matrix")
    flat: list[float] = []
    for row in matrix:
        for value in row:
            complex_value = complex(value)
            flat.extend([float(complex_value.real), float(complex_value.imag)])
    if len(flat) != 2 * dimension * dimension:
        raise ValueError("matrix flattening produced an unexpected length")
    return flat


def unflatten_complex_matrix(flat: Sequence[float], d: int) -> Matrix:
    """Return a tuple matrix from row-major interleaved complex values."""

    d = _validate_dimension(d)
    expected = 2 * d * d
    if len(flat) != expected:
        raise ValueError(
            f"flat length must be 2 * d * d; received len(flat)={len(flat)} for d={d}"
        )
    rows = []
    for row in range(d):
        values = []
        for column in range(d):
            index = 2 * (row * d + column)
            values.append(complex(float(flat[index]), float(flat[index + 1])))
        rows.append(tuple(values))
    return tuple(rows)


def flatten_collapse_ops(
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
) -> list[float]:
    """Return concatenated flat row-major collapse operators."""

    flat: list[float] = []
    expected_dimension: int | None = None
    for index, operator in enumerate(collapse_ops):
        dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if expected_dimension is None:
            expected_dimension = dimension
        elif dimension != expected_dimension:
            raise ValueError("all collapse operators must have the same dimension")
        flat.extend(flatten_complex_matrix(operator))
    return flat


def rust_lindblad_rhs(
    rho: Sequence[Sequence[complex]],
    hamiltonian: Sequence[Sequence[complex]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
) -> Matrix:
    """Evaluate the raw Lindblad RHS through the optional Rust kernel."""

    dimension = _validate_evolution_inputs(rho, hamiltonian, collapse_ops)
    rust_module = _load_rust_module()
    result = rust_module.lindblad_rhs_flat(
        flatten_complex_matrix(rho),
        flatten_complex_matrix(hamiltonian),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
    )
    return unflatten_complex_matrix(result, dimension)


def rust_rk4_time_dependent_stages(
    rho: Sequence[Sequence[complex]],
    hamiltonian_stages: Sequence[Sequence[Sequence[complex]]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
) -> tuple[Matrix, Matrix, Matrix, Matrix]:
    """Return raw RK4 derivatives for four explicitly supplied Hamiltonians."""

    dimension = _validate_time_dependent_inputs(
        rho,
        hamiltonian_stages,
        collapse_ops,
        dt,
    )
    rust_module = _load_rust_module()
    flat_stages = rust_module.rk4_time_dependent_stages_flat(
        flatten_complex_matrix(rho),
        *(flatten_complex_matrix(stage) for stage in hamiltonian_stages),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
        float(dt),
    )
    matrix_size = 2 * dimension * dimension
    if len(flat_stages) != 4 * matrix_size:
        raise RuntimeError(
            "quantascope_rust returned an unexpected RK4 stage length"
        )
    return (
        unflatten_complex_matrix(flat_stages[0:matrix_size], dimension),
        unflatten_complex_matrix(
            flat_stages[matrix_size:2 * matrix_size],
            dimension,
        ),
        unflatten_complex_matrix(
            flat_stages[2 * matrix_size:3 * matrix_size],
            dimension,
        ),
        unflatten_complex_matrix(
            flat_stages[3 * matrix_size:4 * matrix_size],
            dimension,
        ),
    )


def rust_rk4_time_dependent_step(
    rho: Sequence[Sequence[complex]],
    hamiltonian_stages: Sequence[Sequence[Sequence[complex]]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
) -> Matrix:
    """Advance one raw RK4 step from four explicitly supplied Hamiltonians."""

    dimension = _validate_time_dependent_inputs(
        rho,
        hamiltonian_stages,
        collapse_ops,
        dt,
    )
    rust_module = _load_rust_module()
    result = rust_module.rk4_time_dependent_step_flat(
        flatten_complex_matrix(rho),
        *(flatten_complex_matrix(stage) for stage in hamiltonian_stages),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
        float(dt),
    )
    return unflatten_complex_matrix(result, dimension)


def rust_rk4_evolve_segment(
    rho: Sequence[Sequence[complex]],
    hamiltonian: Sequence[Sequence[complex]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
    substeps: int,
) -> Matrix:
    """Evolve one raw RK4 segment with the optional Rust dense kernel."""

    if int(substeps) != substeps or int(substeps) <= 0:
        raise ValueError("substeps must be a positive integer")
    dt = float(dt)
    if not math.isfinite(dt):
        raise ValueError("dt must be finite")

    dimension = _validate_square_matrix(rho, "rho")
    h_dimension = _validate_square_matrix(hamiltonian, "hamiltonian")
    if h_dimension != dimension:
        raise ValueError("rho and hamiltonian must have the same dimension")

    for index, operator in enumerate(collapse_ops):
        op_dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if op_dimension != dimension:
            raise ValueError("collapse operators must match rho dimension")

    rust_module = _load_rust_module()
    result = rust_module.rk4_evolve_flat(
        flatten_complex_matrix(rho),
        flatten_complex_matrix(hamiltonian),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
        dt,
        int(substeps),
    )
    return unflatten_complex_matrix(result, dimension)


def rust_rk4_evolve_segment_cleaned(
    rho: Sequence[Sequence[complex]],
    hamiltonian: Sequence[Sequence[complex]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
    substeps: int,
) -> Matrix:
    """Evolve one RK4 segment with Rust cleanup after every substep."""

    if int(substeps) != substeps or int(substeps) <= 0:
        raise ValueError("substeps must be a positive integer")
    dt = float(dt)
    if not math.isfinite(dt):
        raise ValueError("dt must be finite")

    dimension = _validate_square_matrix(rho, "rho")
    h_dimension = _validate_square_matrix(hamiltonian, "hamiltonian")
    if h_dimension != dimension:
        raise ValueError("rho and hamiltonian must have the same dimension")

    for index, operator in enumerate(collapse_ops):
        op_dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if op_dimension != dimension:
            raise ValueError("collapse operators must match rho dimension")

    rust_module = _load_rust_module()
    result = rust_module.rk4_evolve_cleaned_flat(
        flatten_complex_matrix(rho),
        flatten_complex_matrix(hamiltonian),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
        dt,
        int(substeps),
    )
    return unflatten_complex_matrix(result, dimension)


def rust_rk4_evolve_segment_samples(
    rho: Sequence[Sequence[complex]],
    hamiltonian: Sequence[Sequence[complex]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
    sample_substeps: Sequence[int],
) -> tuple[Matrix, ...]:
    """Evolve one segment and return cleaned states at requested samples."""

    sample_substeps = _validate_sample_substeps(sample_substeps)
    dt = float(dt)
    if not math.isfinite(dt):
        raise ValueError("dt must be finite")

    dimension = _validate_square_matrix(rho, "rho")
    h_dimension = _validate_square_matrix(hamiltonian, "hamiltonian")
    if h_dimension != dimension:
        raise ValueError("rho and hamiltonian must have the same dimension")

    for index, operator in enumerate(collapse_ops):
        op_dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if op_dimension != dimension:
            raise ValueError("collapse operators must match rho dimension")

    rust_module = _load_rust_module()
    result = rust_module.rk4_evolve_cleaned_samples_flat(
        flatten_complex_matrix(rho),
        flatten_complex_matrix(hamiltonian),
        flatten_collapse_ops(collapse_ops),
        len(collapse_ops),
        dimension,
        dt,
        list(sample_substeps),
    )
    matrix_size = 2 * dimension * dimension
    expected = len(sample_substeps) * matrix_size
    if len(result) != expected:
        raise RuntimeError(
            "quantascope_rust returned an unexpected sampled output length"
        )
    return tuple(
        unflatten_complex_matrix(result[start:start + matrix_size], dimension)
        for start in range(0, expected, matrix_size)
    )


def _load_rust_module():
    try:
        return importlib.import_module("quantascope_rust")
    except Exception as exc:
        raise RuntimeError("quantascope_rust is not available") from exc


def _validate_evolution_inputs(
    rho: Sequence[Sequence[complex]],
    hamiltonian: Sequence[Sequence[complex]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
) -> int:
    dimension = _validate_square_matrix(rho, "rho")
    h_dimension = _validate_square_matrix(hamiltonian, "hamiltonian")
    if h_dimension != dimension:
        raise ValueError("rho and hamiltonian must have the same dimension")
    for index, operator in enumerate(collapse_ops):
        op_dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if op_dimension != dimension:
            raise ValueError("collapse operators must match rho dimension")
    return dimension


def _validate_time_dependent_inputs(
    rho: Sequence[Sequence[complex]],
    hamiltonian_stages: Sequence[Sequence[Sequence[complex]]],
    collapse_ops: Sequence[Sequence[Sequence[complex]]],
    dt: float,
) -> int:
    if len(hamiltonian_stages) != 4:
        raise ValueError("hamiltonian_stages must contain exactly four matrices")
    dt = float(dt)
    if not math.isfinite(dt):
        raise ValueError("dt must be finite")
    dimension = _validate_square_matrix(rho, "rho")
    for index, hamiltonian in enumerate(hamiltonian_stages):
        h_dimension = _validate_square_matrix(
            hamiltonian,
            f"hamiltonian_stages[{index}]",
        )
        if h_dimension != dimension:
            raise ValueError("Hamiltonian stages must match rho dimension")
    for index, operator in enumerate(collapse_ops):
        op_dimension = _validate_square_matrix(operator, f"collapse_ops[{index}]")
        if op_dimension != dimension:
            raise ValueError("collapse operators must match rho dimension")
    return dimension


def _validate_dimension(d: int) -> int:
    if isinstance(d, bool):
        raise ValueError("d must be a positive integer")
    try:
        d = int(d)
    except (TypeError, ValueError) as exc:
        raise ValueError("d must be a positive integer") from exc
    if d <= 0:
        raise ValueError("d must be greater than 0")
    return d


def _validate_square_matrix(matrix: Sequence[Sequence[complex]], name: str) -> int:
    if not isinstance(matrix, Sequence) or isinstance(matrix, (str, bytes)):
        raise ValueError(f"{name} must be a square matrix")
    dimension = len(matrix)
    if dimension <= 0:
        raise ValueError(f"{name} must be non-empty")
    for row_index, row in enumerate(matrix):
        if not isinstance(row, Sequence) or isinstance(row, (str, bytes)):
            raise ValueError(f"{name}[{row_index}] must be a row sequence")
        if len(row) != dimension:
            raise ValueError(f"{name} must be square and non-ragged")
        for value in row:
            try:
                complex(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{name} entries must be complex-compatible") from exc
    return dimension


def _validate_sample_substeps(sample_substeps: Sequence[int]) -> tuple[int, ...]:
    if not isinstance(sample_substeps, Sequence) or isinstance(sample_substeps, (str, bytes)):
        raise ValueError("sample_substeps must be a sequence of positive integers")
    if len(sample_substeps) == 0:
        raise ValueError("sample_substeps must be non-empty")
    values: list[int] = []
    for index, value in enumerate(sample_substeps):
        if isinstance(value, bool):
            raise ValueError("sample_substeps entries must be positive integers")
        try:
            integer = int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("sample_substeps entries must be positive integers") from exc
        if integer != value or integer <= 0:
            raise ValueError("sample_substeps entries must be positive integers")
        values.append(integer)
    return tuple(values)
