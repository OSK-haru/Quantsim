"""Shared core capability declarations.

Keep these values small and JSON-friendly so UI, save/load, and future backend
adapters can discover the same basic contract without importing implementation
details from environment/evolution/metrics.
"""

from __future__ import annotations


DEFAULT_SIMULATION_MODEL = "weak_coupling_lindblad"
POST_CIRCUIT_DEGRADATION_MODEL = "post_circuit_degradation_v1"
GATE_AWARE_SPLIT_STEP_MODEL = "gate_aware_split_step_v1"
GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL = "gate_aware_hamiltonian_lindblad_v1"
SUPPORTED_SIMULATION_MODELS = frozenset({
    DEFAULT_SIMULATION_MODEL,
    POST_CIRCUIT_DEGRADATION_MODEL,
    GATE_AWARE_SPLIT_STEP_MODEL,
    GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL,
})
SUPPORTED_GATES = frozenset({"I", "H", "X", "Z", "CNOT", "MEASURE"})
MAX_LOGICAL_QUBITS = 4


def normalize_gate_type(gate_type: str) -> str:
    """Normalize gate labels while preserving JSON-level string inputs."""

    return str(gate_type).upper()


def core_capabilities() -> dict[str, object]:
    """Return a backend/UI neutral summary of the current core contract."""

    return {
        "default_simulation_model": DEFAULT_SIMULATION_MODEL,
        "default_simulation_mode": GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL,
        "supported_simulation_models": sorted(SUPPORTED_SIMULATION_MODELS),
        "supported_gates": sorted(SUPPORTED_GATES),
        "max_logical_qubits": MAX_LOGICAL_QUBITS,
    }
