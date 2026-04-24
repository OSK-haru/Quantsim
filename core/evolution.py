"""State evolution helpers for the Quantum-Sim MVP."""

from core.circuit import QuantumCircuitModel
from core.environment import EnvironmentProfile


def estimate_decay(circuit: QuantumCircuitModel, environment: EnvironmentProfile) -> float:
    """Return a simple placeholder degradation estimate."""

    complexity = max(len(circuit.gates), 1)
    return complexity * (environment.noise_level + environment.temperature_kelvin)
