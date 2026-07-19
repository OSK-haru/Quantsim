"""Small-matrix gate expansion and density-matrix operations."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from math import pi, sqrt

from core.capabilities import normalize_gate_type
from core.circuit_model import GateOperation
from core.internal_profiling import active_internal_profile, elapsed_ms, timer_start


Matrix = tuple[tuple[complex, ...], ...]
Ket = tuple[complex, ...]


@dataclass(frozen=True)
class CachedCollapseOperator:
    """Collapse operator with reusable adjoint products for Lindblad RHS."""

    operator: Matrix
    operator_adjoint: Matrix
    operator_adjoint_operator: Matrix


I: Matrix = (
    (1.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 1.0 + 0.0j),
)
H: Matrix = (
    (1.0 / sqrt(2.0), 1.0 / sqrt(2.0)),
    (1.0 / sqrt(2.0), -1.0 / sqrt(2.0)),
)
X: Matrix = (
    (0.0 + 0.0j, 1.0 + 0.0j),
    (1.0 + 0.0j, 0.0 + 0.0j),
)
Z: Matrix = (
    (1.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, -1.0 + 0.0j),
)
SIGMA_MINUS: Matrix = (
    (0.0 + 0.0j, 1.0 + 0.0j),
    (0.0 + 0.0j, 0.0 + 0.0j),
)
SIGMA_PLUS: Matrix = (
    (0.0 + 0.0j, 0.0 + 0.0j),
    (1.0 + 0.0j, 0.0 + 0.0j),
)

DEFAULT_GATE_DURATIONS_US = {
    "I": 0.0,
    "H": 0.02,
    "X": 0.02,
    "Z": 0.0,
    "CNOT": 0.20,
    "MEASURE": 0.0,
}
INVOLUTION_TOLERANCE = 1e-9


def expand_single_qubit_gate(gate: Matrix, target: int, n_qubits: int) -> Matrix:
    """Expand a one-qubit gate with q0 as the most significant bit."""

    _require_qubit_index(target, n_qubits)
    expanded: Matrix = ((1.0 + 0.0j,),)
    for qubit in range(n_qubits):
        expanded = tensor(expanded, gate if qubit == target else I)
    return expanded


def expand_cnot(control: int, target: int, n_qubits: int) -> Matrix:
    """Return a CNOT matrix with q0 as the most significant bit."""

    _require_qubit_index(control, n_qubits)
    _require_qubit_index(target, n_qubits)
    if control == target:
        raise ValueError("CNOT control and target must be different")

    dimension = 2 ** n_qubits
    rows = [[0.0 + 0.0j for _ in range(dimension)] for _ in range(dimension)]
    for input_index in range(dimension):
        bits = _index_to_bits(input_index, n_qubits)
        output_bits = list(bits)
        if bits[control] == "1":
            output_bits[target] = "0" if output_bits[target] == "1" else "1"
        output_index = _bits_to_index(output_bits)
        rows[output_index][input_index] = 1.0 + 0.0j
    return _freeze(rows)


def initial_density_matrix(initial_states: list[str]) -> Matrix:
    """Build a tensor-product density matrix for 0, 1, +, and - states."""

    ket: Ket = (1.0 + 0.0j,)
    for state in initial_states:
        ket = tensor_ket(ket, _single_qubit_ket(state))
    return density_from_ket(ket)


def apply_unitary_to_density(rho: Matrix, u: Matrix) -> Matrix:
    """Return U rho U dagger."""

    return matmul(matmul(u, rho), adjoint(u))


def apply_gate_operation(rho: Matrix, gate: GateOperation, n_qubits: int) -> Matrix:
    """Apply one supported circuit operation to a density matrix."""

    return apply_unitary_to_density(rho, gate_unitary(gate, n_qubits))


def gate_duration_us(gate: GateOperation) -> float:
    """Return the assigned gate duration in microseconds."""

    gate_type = normalize_gate_type(gate.type)
    duration = (gate.params or {}).get(
        "duration_us",
        DEFAULT_GATE_DURATIONS_US.get(gate_type),
    )
    if duration is None:
        raise ValueError(f"unsupported gate type: {gate.type}")
    duration = float(duration)
    if duration < 0.0:
        raise ValueError("gate duration_us must be non-negative")
    return duration


def column_duration_us(column) -> float:
    """Return the maximum duration of all gates in a circuit column."""

    if not column.gates:
        return 0.0
    return max(gate_duration_us(gate) for gate in column.gates)


def gate_unitary(gate: GateOperation, n_qubits: int) -> Matrix:
    """Return the expanded unitary matrix for one supported gate."""

    gate_type = normalize_gate_type(gate.type)
    dimension = 2 ** n_qubits
    if gate_type == "MEASURE":
        return identity_matrix(dimension)
    if gate_type == "CNOT":
        if len(gate.controls or []) != 1 or len(gate.targets) != 1:
            raise ValueError("CNOT requires exactly one control and one target")
        return expand_cnot(gate.controls[0], gate.targets[0], n_qubits)

    one_qubit_gate = {
        "I": I,
        "H": H,
        "X": X,
        "Z": Z,
    }.get(gate_type)
    if one_qubit_gate is None:
        raise ValueError(f"unsupported gate type: {gate.type}")
    if len(gate.targets) != 1:
        raise ValueError(f"{gate.type} requires exactly one target")
    return expand_single_qubit_gate(one_qubit_gate, gate.targets[0], n_qubits)


def column_unitary(column, n_qubits: int) -> Matrix:
    """Return the unitary for all gates in a column, applied in listed order."""

    unitary = identity_matrix(2 ** n_qubits)
    for gate in column.gates:
        unitary = matmul(gate_unitary(gate, n_qubits), unitary)
    return unitary


def effective_hamiltonian_from_involution(
    unitary: Matrix,
    duration_us: float,
) -> Matrix:
    """Return H = pi / (2 tau) * (I - U) for Hermitian involutory U."""

    duration_us = float(duration_us)
    if duration_us <= 0.0:
        raise ValueError("duration_us must be positive to build a Hamiltonian")
    dimension = len(unitary)
    identity = identity_matrix(dimension)
    if _max_abs_difference(adjoint(unitary), unitary) > INVOLUTION_TOLERANCE:
        raise ValueError("column unitary must be Hermitian for effective Hamiltonian mode")
    if _max_abs_difference(matmul(unitary, unitary), identity) > INVOLUTION_TOLERANCE:
        raise ValueError("column unitary must satisfy U^2 = I for effective Hamiltonian mode")
    return scale(pi / (2.0 * duration_us), subtract(identity, unitary))


def output_probabilities(rho: Matrix, n_qubits: int) -> dict[str, float]:
    """Return computational-basis probabilities from the density diagonal."""

    probabilities: dict[str, float] = {}
    for index, row in enumerate(rho):
        probabilities[_basis_label(index, n_qubits)] = _as_probability(row[index].real)
    return probabilities


def multi_qubit_collapse_operators(
    n_qubits: int,
    downward_rate_per_us: float,
    dephasing_rate_per_us: float,
) -> list[Matrix]:
    """Create legacy downward-relaxation and dephasing operators for each qubit."""

    collapse_ops: list[Matrix] = []
    if downward_rate_per_us > 0.0:
        relaxation = sqrt(downward_rate_per_us)
        for qubit in range(n_qubits):
            collapse_ops.append(
                scale(relaxation, expand_single_qubit_gate(SIGMA_MINUS, qubit, n_qubits))
            )
    if dephasing_rate_per_us > 0.0:
        dephasing = sqrt(dephasing_rate_per_us / 2.0)
        for qubit in range(n_qubits):
            collapse_ops.append(
                scale(dephasing, expand_single_qubit_gate(Z, qubit, n_qubits))
            )
    return collapse_ops


def multi_qubit_physical_collapse_operators(
    n_qubits: int,
    gamma_down_per_us: float,
    gamma_up_per_us: float,
    gamma_phi_per_us: float,
) -> list[Matrix]:
    """Create finite-temperature relaxation, excitation, and dephasing operators."""

    collapse_ops: list[Matrix] = []
    if gamma_down_per_us > 0.0:
        relaxation = sqrt(gamma_down_per_us)
        for qubit in range(n_qubits):
            collapse_ops.append(
                scale(relaxation, expand_single_qubit_gate(SIGMA_MINUS, qubit, n_qubits))
            )
    if gamma_up_per_us > 0.0:
        excitation = sqrt(gamma_up_per_us)
        for qubit in range(n_qubits):
            collapse_ops.append(
                scale(excitation, expand_single_qubit_gate(SIGMA_PLUS, qubit, n_qubits))
            )
    if gamma_phi_per_us > 0.0:
        dephasing = sqrt(gamma_phi_per_us / 2.0)
        for qubit in range(n_qubits):
            collapse_ops.append(
                scale(dephasing, expand_single_qubit_gate(Z, qubit, n_qubits))
            )
    return collapse_ops


def multi_qubit_environment_collapse_operators(
    n_qubits: int,
    rates,
) -> list[Matrix]:
    """Create unified environment collapse operators from EnvironmentRates."""

    return multi_qubit_physical_collapse_operators(
        n_qubits,
        float(getattr(rates, "gamma_down_per_us")),
        float(getattr(rates, "gamma_up_per_us")),
        float(getattr(rates, "gamma_phi_per_us")),
    )


def prepare_collapse_operators(
    collapse_ops: Sequence[Matrix],
) -> tuple[CachedCollapseOperator, ...]:
    """Precompute adjoint products for repeated Lindblad RHS evaluations."""

    profile = active_internal_profile()
    cached = []
    for collapse_op in collapse_ops:
        if profile is None:
            operator_adjoint = adjoint(collapse_op)
            operator_adjoint_operator = matmul(operator_adjoint, collapse_op)
        else:
            started_at = timer_start()
            operator_adjoint = adjoint(collapse_op)
            profile.collapse_adjoint_build_count += 1
            profile.collapse_adjoint_build_ms += elapsed_ms(started_at)

            started_at = timer_start()
            operator_adjoint_operator = matmul(operator_adjoint, collapse_op)
            profile.ldagger_l_build_count += 1
            profile.ldagger_l_build_ms += elapsed_ms(started_at)

        cached.append(CachedCollapseOperator(
            operator=collapse_op,
            operator_adjoint=operator_adjoint,
            operator_adjoint_operator=operator_adjoint_operator,
        ))
    return tuple(cached)


def clean_density_matrix(rho: Matrix) -> Matrix:
    rho = scale(0.5, add(rho, adjoint(rho)))
    trace_value = trace(rho)
    if abs(trace_value) == 0.0:
        raise ValueError("density matrix trace vanished during evolution")
    return scale(1.0 / trace_value, rho)


def lindblad_rhs(rho: Matrix, hamiltonian: Matrix, collapse_ops: list[Matrix]) -> Matrix:
    return lindblad_rhs_cached(
        rho,
        hamiltonian,
        prepare_collapse_operators(collapse_ops),
    )


def lindblad_rhs_cached(
    rho: Matrix,
    hamiltonian: Matrix,
    collapse_ops: Sequence[CachedCollapseOperator],
) -> Matrix:
    profile = active_internal_profile()
    if profile is None:
        if _is_zero_matrix(hamiltonian):
            derivative = zero_hamiltonian(len(rho))
        else:
            commutator = subtract(matmul(hamiltonian, rho), matmul(rho, hamiltonian))
            derivative = scale(-1j, commutator)

        for collapse_op in collapse_ops:
            dissipator = subtract(
                matmul(matmul(collapse_op.operator, rho), collapse_op.operator_adjoint),
                scale(
                    0.5,
                    add(
                        matmul(collapse_op.operator_adjoint_operator, rho),
                        matmul(rho, collapse_op.operator_adjoint_operator),
                    ),
                ),
            )
            derivative = add(derivative, dissipator)
        return derivative

    rhs_started_at = timer_start()
    profile.rhs_call_count += 1
    try:
        started_at = timer_start()
        if _is_zero_matrix(hamiltonian):
            derivative = zero_hamiltonian(len(rho))
            profile.zero_hamiltonian_skip_count += 1
        else:
            commutator = subtract(matmul(hamiltonian, rho), matmul(rho, hamiltonian))
            derivative = scale(-1j, commutator)
        profile.hamiltonian_term_ms += elapsed_ms(started_at)

        for collapse_op in collapse_ops:
            profile.dissipator_operator_iterations += 1
            started_at = timer_start()
            dissipator = subtract(
                matmul(matmul(collapse_op.operator, rho), collapse_op.operator_adjoint),
                scale(
                    0.5,
                    add(
                        matmul(collapse_op.operator_adjoint_operator, rho),
                        matmul(rho, collapse_op.operator_adjoint_operator),
                    ),
                ),
            )
            profile.dissipator_total_ms += elapsed_ms(started_at)

            started_at = timer_start()
            derivative = add(derivative, dissipator)
            profile.matrix_accumulation_ms += elapsed_ms(started_at)
        return derivative
    finally:
        profile.rhs_total_ms += elapsed_ms(rhs_started_at)


def rk4_step(
    rho: Matrix,
    hamiltonian: Matrix,
    collapse_ops: list[Matrix],
    dt: float,
) -> Matrix:
    return rk4_step_cached(
        rho,
        hamiltonian,
        prepare_collapse_operators(collapse_ops),
        dt,
    )


def rk4_step_cached(
    rho: Matrix,
    hamiltonian: Matrix,
    collapse_ops: Sequence[CachedCollapseOperator],
    dt: float,
) -> Matrix:
    profile = active_internal_profile()
    if profile is None:
        k1 = lindblad_rhs_cached(rho, hamiltonian, collapse_ops)
        k2 = lindblad_rhs_cached(add(rho, scale(0.5 * dt, k1)), hamiltonian, collapse_ops)
        k3 = lindblad_rhs_cached(add(rho, scale(0.5 * dt, k2)), hamiltonian, collapse_ops)
        k4 = lindblad_rhs_cached(add(rho, scale(dt, k3)), hamiltonian, collapse_ops)
        return add(
            rho,
            scale(
                dt / 6.0,
                add(k1, scale(2.0, k2), scale(2.0, k3), k4),
            ),
        )

    started_at = timer_start()
    profile.rk4_step_count += 1
    try:
        k1 = lindblad_rhs_cached(rho, hamiltonian, collapse_ops)
        k2 = lindblad_rhs_cached(add(rho, scale(0.5 * dt, k1)), hamiltonian, collapse_ops)
        k3 = lindblad_rhs_cached(add(rho, scale(0.5 * dt, k2)), hamiltonian, collapse_ops)
        k4 = lindblad_rhs_cached(add(rho, scale(dt, k3)), hamiltonian, collapse_ops)
        return add(
            rho,
            scale(
                dt / 6.0,
                add(k1, scale(2.0, k2), scale(2.0, k3), k4),
            ),
        )
    finally:
        profile.rk4_total_ms += elapsed_ms(started_at)


def zero_hamiltonian(dimension: int) -> Matrix:
    return tuple(
        tuple(0.0 + 0.0j for _ in range(dimension))
        for _ in range(dimension)
    )


def identity_matrix(dimension: int) -> Matrix:
    return tuple(
        tuple(
            1.0 + 0.0j if row == column else 0.0 + 0.0j
            for column in range(dimension)
        )
        for row in range(dimension)
    )


def matmul(left: Matrix, right: Matrix) -> Matrix:
    profile = active_internal_profile()
    if profile is not None:
        started_at = timer_start()
        try:
            return _matmul(left, right)
        finally:
            elapsed = elapsed_ms(started_at)
            profile.matmul_call_count += 1
            profile.matmul_total_ms += elapsed
            profile.python_matmul_call_count += 1
            profile.python_matmul_total_ms += elapsed
    return _matmul(left, right)


def _matmul(left: Matrix, right: Matrix) -> Matrix:
    if len(left[0]) != len(right):
        raise ValueError("matrix dimensions do not align")
    return tuple(
        tuple(
            sum(left[row][inner] * right[inner][column] for inner in range(len(right)))
            for column in range(len(right[0]))
        )
        for row in range(len(left))
    )


def add(*matrices: Matrix) -> Matrix:
    profile = active_internal_profile()
    if profile is not None:
        started_at = timer_start()
        try:
            return _add(*matrices)
        finally:
            profile.matrix_add_scale_call_count += 1
            profile.matrix_add_scale_total_ms += elapsed_ms(started_at)
    return _add(*matrices)


def _add(*matrices: Matrix) -> Matrix:
    if not matrices:
        raise ValueError("at least one matrix is required")
    return tuple(
        tuple(
            sum(matrix[row][column] for matrix in matrices)
            for column in range(len(matrices[0][0]))
        )
        for row in range(len(matrices[0]))
    )


def subtract(left: Matrix, right: Matrix) -> Matrix:
    return add(left, scale(-1.0, right))


def scale(value: complex, matrix: Matrix) -> Matrix:
    profile = active_internal_profile()
    if profile is not None:
        started_at = timer_start()
        try:
            return _scale(value, matrix)
        finally:
            profile.matrix_add_scale_call_count += 1
            profile.matrix_add_scale_total_ms += elapsed_ms(started_at)
    return _scale(value, matrix)


def _scale(value: complex, matrix: Matrix) -> Matrix:
    return tuple(
        tuple(value * entry for entry in row)
        for row in matrix
    )


def adjoint(matrix: Matrix) -> Matrix:
    profile = active_internal_profile()
    if profile is not None:
        started_at = timer_start()
        try:
            return _adjoint(matrix)
        finally:
            profile.adjoint_call_count += 1
            profile.adjoint_total_ms += elapsed_ms(started_at)
    return _adjoint(matrix)


def _adjoint(matrix: Matrix) -> Matrix:
    return tuple(
        tuple(matrix[row][column].conjugate() for row in range(len(matrix)))
        for column in range(len(matrix[0]))
    )


def _is_zero_matrix(matrix: Matrix) -> bool:
    return all(entry == 0.0 for row in matrix for entry in row)


def trace(matrix: Matrix) -> complex:
    return sum(matrix[index][index] for index in range(len(matrix)))


def tensor(left: Matrix, right: Matrix) -> Matrix:
    return tuple(
        tuple(left_value * right_value for left_value in left_row for right_value in right_row)
        for left_row in left
        for right_row in right
    )


def tensor_ket(left: Ket, right: Ket) -> Ket:
    return tuple(left_value * right_value for left_value in left for right_value in right)


def density_from_ket(ket: Ket) -> Matrix:
    return tuple(
        tuple(row_value * column_value.conjugate() for column_value in ket)
        for row_value in ket
    )


def _single_qubit_ket(state: str) -> Ket:
    normalized = str(state).strip()
    if normalized == "0":
        return (1.0 + 0.0j, 0.0 + 0.0j)
    if normalized == "1":
        return (0.0 + 0.0j, 1.0 + 0.0j)
    if normalized == "+":
        return (1.0 / sqrt(2.0), 1.0 / sqrt(2.0))
    if normalized == "-":
        return (1.0 / sqrt(2.0), -1.0 / sqrt(2.0))
    raise ValueError(f"unsupported initial state: {state}")


def _index_to_bits(index: int, n_qubits: int) -> str:
    return format(index, f"0{n_qubits}b")


def _bits_to_index(bits: list[str]) -> int:
    return int("".join(bits), 2)


def _basis_label(index: int, n_qubits: int) -> str:
    return _index_to_bits(index, n_qubits)


def _require_qubit_index(index: int, n_qubits: int) -> None:
    if not 0 <= int(index) < n_qubits:
        raise ValueError(f"qubit index {index} is outside range for {n_qubits} qubits")


def _freeze(rows: list[list[complex]]) -> Matrix:
    return tuple(tuple(row) for row in rows)


def _max_abs_difference(left: Matrix, right: Matrix) -> float:
    return max(
        abs(left[row][column] - right[row][column])
        for row in range(len(left))
        for column in range(len(left[0]))
    )


def _as_probability(value: float) -> float:
    if value < 0.0 and value > -1e-9:
        return 0.0
    if value > 1.0 and value < 1.0 + 1e-9:
        return 1.0
    return value
