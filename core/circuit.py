"""Circuit structures and one-qubit primitives for the Quantum-Sim MVP."""

from __future__ import annotations

from dataclasses import dataclass, field
from math import pi, sqrt


H_GATE_DURATION_US = 20.0
Matrix2 = tuple[tuple[complex, complex], tuple[complex, complex]]


@dataclass
class QuantumCircuitModel:
    """Minimal representation of a small circuit."""

    qubit_count: int = 1
    gates: list[str] = field(default_factory=list)


def h_gate_hamiltonian(gate_duration_us: float = H_GATE_DURATION_US) -> Matrix2:
    """Return an effective Hamiltonian that applies an H gate in one qubit."""

    if gate_duration_us <= 0.0:
        raise ValueError("gate_duration_us must be positive")

    coefficient = pi / (2.0 * gate_duration_us * sqrt(2.0))
    return (
        (complex(coefficient), complex(coefficient)),
        (complex(coefficient), complex(-coefficient)),
    )


def initial_zero_density_matrix() -> Matrix2:
    """Return the initial one-qubit |0><0| density matrix."""

    return (
        (1.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j),
    )
