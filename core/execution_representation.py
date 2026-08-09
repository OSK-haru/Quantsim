"""Adaptive execution-representation policy.

The policy is intentionally conservative: density matrices remain the source
of truth for noisy Gate-aware simulations, while ideal circuits may use the
O(2**n) statevector implementation.  A future trajectory runner can be added
without changing the circuit or UI contracts.
"""

from __future__ import annotations

from typing import Literal

from core.capabilities import (
    MAX_DENSITY_MATRIX_QUBITS,
    STATEVECTOR_AUTO_SWITCH_QUBITS,
)
ExecutionRepresentation = Literal["statevector", "density_matrix", "trajectory"]


def select_execution_representation(
    *,
    logical_qubits: int,
    environment_is_ideal: bool,
    has_classical_conditions: bool,
    has_measurements: bool,
    evolution_method: str,
) -> ExecutionRepresentation:
    """Select the cheapest representation with currently audited semantics."""

    if (
        environment_is_ideal
        and not has_measurements
        and logical_qubits > STATEVECTOR_AUTO_SWITCH_QUBITS
    ):
        return "statevector"
    # The trajectory slot is reserved for the stochastic noisy engine. Until
    # its jump statistics are audited, retain the density-matrix authority.
    return "density_matrix"


def representation_diagnostics(
    representation: ExecutionRepresentation,
    logical_qubits: int,
) -> dict[str, object]:
    dimension = 2 ** int(logical_qubits)
    return {
        "execution_representation": representation,
        "state_dimension": dimension,
        "density_matrix_dimension": dimension * dimension,
        "representation_policy": "adaptive_representation_v1",
        "trajectory_available": False,
        "density_matrix_qubit_limit": MAX_DENSITY_MATRIX_QUBITS,
    }
