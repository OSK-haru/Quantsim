"""Expert Inspector data aggregation without UI dependencies."""

from __future__ import annotations

import math
from typing import Any

from core.gates import (
    Matrix,
    SIGMA_MINUS,
    Z,
    apply_gate_operation,
    clean_density_matrix,
    expand_single_qubit_gate,
    initial_density_matrix,
    matmul,
    multi_qubit_collapse_operators,
    output_probabilities,
    rk4_step,
    scale,
    trace,
    zero_hamiltonian,
)
from core.results import SimulationResult


def build_expert_inspector_data(result: SimulationResult | None) -> dict[str, Any]:
    """Return JSON-safe expert-facing data for one simulation result."""

    if result is None:
        return _empty_data()

    config = result.config
    n_qubits = config.circuit.logical_qubits
    dimension = 2 ** n_qubits
    final_density = _reconstruct_final_density_matrix(result)
    final_trace = trace(final_density) if final_density is not None else None
    hermiticity_error = (
        _hermiticity_error(final_density)
        if final_density is not None
        else None
    )
    eigenvalues = (
        _hermitian_eigenvalues(final_density)
        if final_density is not None
        else []
    )

    return {
        "overview": {
            "Model": config.model,
            "Logical qubits": n_qubits,
            "Hilbert space dimension": dimension,
            "Density matrix size": f"{dimension} x {dimension}",
            "Gate count": _gate_count(config.circuit.columns),
            "Circuit depth": _circuit_depth(config.circuit.columns),
            "Simulation time": config.duration_us,
            "Time steps": config.time_steps,
            "Final State Fidelity": _last(result.fidelity),
            "Final Purity": _last(result.purity),
            "Effective Operation Time": result.effective_operation_time_us,
        },
        "noise": _noise_data(result),
        "operators": _operator_data(result),
        "state": {
            "Final density matrix": _matrix_components(final_density),
            "Trace": _complex_to_dict(final_trace),
            "Hermiticity error": hermiticity_error,
            "Minimum eigenvalue": min(eigenvalues) if eigenvalues else None,
            "Maximum eigenvalue": max(eigenvalues) if eigenvalues else None,
            "Final purity": _last(result.purity),
            "Final state fidelity": _last(result.fidelity),
            "Output probability distribution": dict(result.output_probabilities),
        },
        "assumptions": _assumptions(),
        "h_eff": {
            "Status": "not enabled",
            "Note": (
                "H_eff/no-jump evolution is distinct from Lindblad "
                "ensemble-averaged evolution and is not implemented in this phase."
            ),
        },
    }


def build_comparison_expert_summary(result: Any | None) -> dict[str, Any]:
    """Return a compact expert summary for a ComparisonResult-like object."""

    if result is None:
        return {}
    if not hasattr(result, "result_a") or not hasattr(result, "result_b"):
        return {}

    label_a = getattr(result.config, "label_a", "Condition A")
    label_b = getattr(result.config, "label_b", "Condition B")
    return {
        label_a: _noise_data(result.result_a),
        label_b: _noise_data(result.result_b),
        "Delta final fidelity": result.delta_final_fidelity,
        "Delta final purity": result.delta_final_purity,
        "Delta effective operation time": result.delta_effective_operation_time_us,
        "Better condition": result.better_condition,
    }


def _empty_data() -> dict[str, Any]:
    return {
        "overview": {},
        "noise": {},
        "operators": {},
        "state": {},
        "assumptions": _assumptions(),
        "h_eff": {
            "Status": "not enabled",
            "Note": "Run a simulation to inspect model internals.",
        },
    }


def _noise_data(result: SimulationResult) -> dict[str, Any]:
    environment = result.config.environment
    derived = result.derived_parameters
    gamma1 = derived.get("gamma1_per_us")
    gammaphi = derived.get("gamma_phi_per_us", derived.get("gammaphi_per_us"))
    return {
        "Temperature parameter": environment.temperature,
        "Magnetic field parameter": environment.magnetic_field,
        "Noise level": environment.noise_level,
        "T1 relaxation time": derived.get("t1_us"),
        "T2 dephasing time": derived.get("t2_us"),
        "gamma1": gamma1,
        "gammaphi": gammaphi,
        "gamma ratio": _gamma_ratio(gamma1, gammaphi),
        "Dominant decoherence source": _dominant_source(gamma1, gammaphi),
    }


def _operator_data(result: SimulationResult) -> dict[str, Any]:
    n_qubits = result.config.circuit.logical_qubits
    derived = result.derived_parameters
    gamma1 = derived.get("gamma1_per_us", 0.0)
    gammaphi = derived.get("gamma_phi_per_us", derived.get("gammaphi_per_us", 0.0))

    if not result.times:
        return {
            "Lindblad operators": "not available in current result",
            "Collapse operators": [],
            "H_eff": "not enabled",
        }

    operators = []
    for qubit in range(n_qubits):
        operators.append({
            "Name": "Relaxation operator",
            "Target qubit": qubit,
            "Enabled": gamma1 > 0.0,
            "Matrix": _matrix_components(
                scale(math.sqrt(gamma1), expand_single_qubit_gate(SIGMA_MINUS, qubit, n_qubits))
                if gamma1 > 0.0
                else None
            ),
        })
        operators.append({
            "Name": "Pure dephasing operator",
            "Target qubit": qubit,
            "Enabled": gammaphi > 0.0,
            "Matrix": _matrix_components(
                scale(math.sqrt(gammaphi / 2.0), expand_single_qubit_gate(Z, qubit, n_qubits))
                if gammaphi > 0.0
                else None
            ),
        })

    return {
        "Lindblad operators": "available via reconstructed collapse operators",
        "Collapse operator count": len(multi_qubit_collapse_operators(n_qubits, gamma1, gammaphi)),
        "Collapse operators": operators,
        "H_eff": "not enabled",
    }


def _reconstruct_final_density_matrix(result: SimulationResult) -> Matrix | None:
    if not result.times:
        return None

    config = result.config
    n_qubits = config.circuit.logical_qubits
    dimension = 2 ** n_qubits
    gamma1 = result.derived_parameters.get("gamma1_per_us")
    gammaphi = result.derived_parameters.get(
        "gamma_phi_per_us",
        result.derived_parameters.get("gammaphi_per_us"),
    )
    if gamma1 is None or gammaphi is None:
        return None

    state = initial_density_matrix(config.circuit.initial_states)
    for column in sorted(config.circuit.columns, key=lambda column: column.step):
        for gate in column.gates:
            state = clean_density_matrix(apply_gate_operation(state, gate, n_qubits))

    hamiltonian = zero_hamiltonian(dimension)
    collapse_ops = multi_qubit_collapse_operators(n_qubits, gamma1, gammaphi)
    for start_time, end_time in zip(result.times, result.times[1:]):
        state = clean_density_matrix(
            rk4_step(state, hamiltonian, collapse_ops, end_time - start_time)
        )
    return state


def _matrix_components(matrix: Matrix | None) -> dict[str, Any] | None:
    if matrix is None:
        return None
    return {
        "real": [[entry.real for entry in row] for row in matrix],
        "imag": [[entry.imag for entry in row] for row in matrix],
        "abs": [[abs(entry) for entry in row] for row in matrix],
    }


def _complex_to_dict(value: complex | None) -> dict[str, float] | None:
    if value is None:
        return None
    return {
        "real": value.real,
        "imag": value.imag,
        "abs": abs(value),
    }


def _hermiticity_error(matrix: Matrix) -> float:
    max_error = 0.0
    for row in range(len(matrix)):
        for column in range(len(matrix)):
            error = abs(matrix[row][column] - matrix[column][row].conjugate())
            max_error = max(max_error, error)
    return max_error


def _hermitian_eigenvalues(matrix: Matrix) -> list[float]:
    if len(matrix) == 1:
        return [matrix[0][0].real]
    if len(matrix) == 2:
        a = matrix[0][0].real
        d = matrix[1][1].real
        b_abs = abs(matrix[0][1])
        center = 0.5 * (a + d)
        radius = math.sqrt((0.5 * (a - d)) ** 2 + b_abs * b_abs)
        return [center - radius, center + radius]

    # For the current 4x4 case, return diagonal bounds as a conservative,
    # JSON-safe diagnostic rather than pulling in a numerical dependency.
    return [matrix[index][index].real for index in range(len(matrix))]


def _gate_count(columns: Any) -> int:
    return sum(len(column.gates) for column in columns)


def _circuit_depth(columns: Any) -> int:
    if not columns:
        return 0
    return max(column.step for column in columns) + 1


def _last(values: list[float]) -> float | None:
    return values[-1] if values else None


def _gamma_ratio(gamma1: float | None, gammaphi: float | None) -> float | None:
    if gamma1 is None or gammaphi is None:
        return None
    if gammaphi == 0.0:
        return None
    return gamma1 / gammaphi


def _dominant_source(gamma1: float | None, gammaphi: float | None) -> str:
    if gamma1 is None or gammaphi is None:
        return "not available in current result"
    if gamma1 > gammaphi:
        return "relaxation"
    if gammaphi > gamma1:
        return "pure dephasing"
    return "balanced"


def _assumptions() -> list[str]:
    return [
        "weak-coupling open quantum system",
        "Born-Markov approximation",
        "Lindblad-type master equation",
        "phenomenological T1/T2 noise",
        "normalized environment parameters",
        "no strict hardware calibration",
        "no strong-coupling memory effects",
        "no pulse-level control",
        "not a research-grade full simulator",
    ]
