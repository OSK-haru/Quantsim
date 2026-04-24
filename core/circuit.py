"""Circuit structures for the Quantum-Sim MVP."""

from dataclasses import dataclass, field


@dataclass
class QuantumCircuitModel:
    """Minimal representation of a small circuit."""

    qubit_count: int = 1
    gates: list[str] = field(default_factory=list)
