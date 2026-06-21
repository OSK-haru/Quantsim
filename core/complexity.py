"""Theoretical complexity estimates for the dense Lindblad simulator."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from core.results import SimulationConfig


def estimate_simulation_complexity(
    config: SimulationConfig,
    diagnostics: Mapping[str, Any] | None = None,
    derived_parameters: Mapping[str, Any] | None = None,
) -> dict[str, float]:
    """Return JSON-safe dense density-matrix complexity estimates.

    The estimates intentionally count simple abstract work units rather than
    wall-clock time. They are meant to show scaling trends for the current
    Python dense-matrix implementation.
    """

    diagnostics = diagnostics or {}
    derived_parameters = derived_parameters or {}
    n_qubits = int(config.circuit.logical_qubits)
    hilbert_dimension = 2 ** n_qubits
    density_entries = hilbert_dimension ** 2
    dense_matmul_scale = hilbert_dimension ** 3
    collapse_operator_count = 3 * n_qubits
    circuit_column_count = len(config.circuit.columns)
    gate_count = sum(len(column.gates) for column in config.circuit.columns)
    configured_time_steps = int(config.time_steps)
    recorded_state_count = int(diagnostics.get(
        "recorded_state_count",
        configured_time_steps,
    ))
    integration_substeps = _positive_float(
        diagnostics.get("integration_substeps", 1.0),
        default=1.0,
    )
    rk4_intervals = max(0, recorded_state_count - 1)
    estimated_rk4_steps = rk4_intervals * integration_substeps
    estimated_rhs_evaluations = 4.0 * estimated_rk4_steps
    gate_duration = _positive_float(
        diagnostics.get(
            "total_gate_duration_us",
            derived_parameters.get("total_gate_duration_us", 0.0),
        ),
        default=0.0,
    )
    actual_duration = _positive_float(
        diagnostics.get(
            "actual_duration_us",
            derived_parameters.get("actual_duration_us", config.duration_us),
        ),
        default=float(config.duration_us),
    )
    gate_fraction = gate_duration / actual_duration if actual_duration > 0.0 else 0.0

    lindblad_work_units = (
        estimated_rhs_evaluations
        * max(1, collapse_operator_count)
        * dense_matmul_scale
    )
    gate_column_work_units = circuit_column_count * dense_matmul_scale
    estimated_work_units = lindblad_work_units + gate_column_work_units
    total_segment_substeps = _positive_float(
        _lookup(
            diagnostics,
            derived_parameters,
            "total_rk4_substeps",
            "complexity_total_rk4_substeps",
        ),
        default=estimated_rk4_steps,
    )
    total_segment_rhs_evaluations = _positive_float(
        _lookup(
            diagnostics,
            derived_parameters,
            "total_rhs_evaluations",
            "complexity_total_rhs_evaluations",
        ),
        default=4.0 * total_segment_substeps,
    )
    gate_segment_count = _positive_float(
        _lookup(diagnostics, derived_parameters, "gate_segment_count"),
        default=0.0,
    )
    idle_segment_count = _positive_float(
        _lookup(diagnostics, derived_parameters, "idle_segment_count"),
        default=0.0,
    )
    gate_segment_substeps = _positive_float(
        _lookup(diagnostics, derived_parameters, "gate_rk4_substeps"),
        default=0.0,
    )
    idle_segment_substeps = _positive_float(
        _lookup(diagnostics, derived_parameters, "idle_rk4_substeps"),
        default=0.0,
    )
    max_hamiltonian_scale = _positive_float(
        _lookup(diagnostics, derived_parameters, "max_hamiltonian_scale_per_us"),
        default=0.0,
    )
    max_environment_rate = _positive_float(
        _lookup(diagnostics, derived_parameters, "max_environment_rate_per_us"),
        default=0.0,
    )
    max_generator_scale = _positive_float(
        _lookup(diagnostics, derived_parameters, "max_generator_scale_per_us"),
        default=max_environment_rate + max_hamiltonian_scale,
    )
    rhs_work_units_per_eval = (1 + collapse_operator_count) * dense_matmul_scale
    segmented_work_units = total_segment_rhs_evaluations * rhs_work_units_per_eval

    return {
        "logical_qubits": float(n_qubits),
        "hilbert_dimension": float(hilbert_dimension),
        "density_matrix_entries": float(density_entries),
        "dense_matmul_scale": float(dense_matmul_scale),
        "collapse_operator_count": float(collapse_operator_count),
        "circuit_column_count": float(circuit_column_count),
        "gate_count": float(gate_count),
        "configured_time_steps": float(configured_time_steps),
        "estimated_recorded_state_count": float(recorded_state_count),
        "estimated_state_storage_entries": float(recorded_state_count * density_entries),
        "estimated_rk4_steps": float(estimated_rk4_steps),
        "estimated_rhs_evaluations": float(estimated_rhs_evaluations),
        "estimated_matmul_dominant_work_units": float(estimated_work_units),
        "estimated_work_units": float(estimated_work_units),
        "gate_duration_fraction": float(gate_fraction),
        "gate_segment_count": float(gate_segment_count),
        "idle_segment_count": float(idle_segment_count),
        "total_segment_count": float(gate_segment_count + idle_segment_count),
        "total_rk4_substeps": float(total_segment_substeps),
        "total_rhs_evaluations": float(total_segment_rhs_evaluations),
        "gate_rk4_substeps": float(gate_segment_substeps),
        "idle_rk4_substeps": float(idle_segment_substeps),
        "max_hamiltonian_scale_per_us": float(max_hamiltonian_scale),
        "max_environment_rate_per_us": float(max_environment_rate),
        "max_generator_scale_per_us": float(max_generator_scale),
        "rhs_work_units_per_eval": float(rhs_work_units_per_eval),
        "estimated_work_units_segmented": float(segmented_work_units),
    }


def complexity_diagnostics(
    config: SimulationConfig,
    diagnostics: Mapping[str, Any] | None = None,
    derived_parameters: Mapping[str, Any] | None = None,
) -> dict[str, float]:
    """Return result diagnostic keys with a stable complexity_ prefix."""

    estimates = estimate_simulation_complexity(
        config,
        diagnostics=diagnostics,
        derived_parameters=derived_parameters,
    )
    return {
        "complexity_hilbert_dimension": estimates["hilbert_dimension"],
        "complexity_density_matrix_entries": estimates["density_matrix_entries"],
        "complexity_dense_matmul_scale": estimates["dense_matmul_scale"],
        "complexity_collapse_operator_count": estimates["collapse_operator_count"],
        "complexity_estimated_rhs_evaluations": estimates["estimated_rhs_evaluations"],
        "complexity_estimated_rk4_steps": estimates["estimated_rk4_steps"],
        "complexity_estimated_work_units": estimates["estimated_work_units"],
        "complexity_estimated_state_storage_entries": (
            estimates["estimated_state_storage_entries"]
        ),
        "complexity_gate_segment_count": estimates["gate_segment_count"],
        "complexity_idle_segment_count": estimates["idle_segment_count"],
        "complexity_total_segment_count": estimates["total_segment_count"],
        "complexity_total_rk4_substeps": estimates["total_rk4_substeps"],
        "complexity_total_rhs_evaluations": estimates["total_rhs_evaluations"],
        "complexity_gate_rk4_substeps": estimates["gate_rk4_substeps"],
        "complexity_idle_rk4_substeps": estimates["idle_rk4_substeps"],
        "complexity_max_hamiltonian_scale_per_us": (
            estimates["max_hamiltonian_scale_per_us"]
        ),
        "complexity_max_environment_rate_per_us": (
            estimates["max_environment_rate_per_us"]
        ),
        "complexity_max_generator_scale_per_us": (
            estimates["max_generator_scale_per_us"]
        ),
        "complexity_estimated_work_units_segmented": (
            estimates["estimated_work_units_segmented"]
        ),
    }


def _lookup(
    diagnostics: Mapping[str, Any],
    derived_parameters: Mapping[str, Any],
    *keys: str,
) -> Any:
    for key in keys:
        if key in diagnostics:
            return diagnostics[key]
        if key in derived_parameters:
            return derived_parameters[key]
    return None


def _positive_float(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if number < 0.0:
        return default
    return number
