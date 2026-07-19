"""Adapters from core simulation results to React UI response dictionaries."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from core.circuit_model import GateColumn, GateOperation
from core.gates import column_duration_us
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.state_snapshots import serialize_state_snapshots


def simulation_result_to_ui_response(result: SimulationResult) -> dict[str, Any]:
    """Convert a SimulationResult into the minimal JSON shape used by React."""

    if not isinstance(result, SimulationResult):
        raise TypeError("result must be a SimulationResult")

    warnings = [str(warning) for warning in result.warnings]
    timeline, timeline_warnings = _timeline(result)
    warnings.extend(timeline_warnings)

    state_snapshots, snapshot_serialization_ms = serialize_state_snapshots(
        result.state_snapshots
    )
    diagnostics = _diagnostics_response(result)
    diagnostics["state_snapshot_serialization_ms"] = _safe_float(
        round(snapshot_serialization_ms, 3)
    )

    return {
        "circuit": _circuit_response(result.config),
        "parameters": _parameters_response(result.config),
        "rates": _rates_response(result),
        "diagnostics": diagnostics,
        "summary": _summary_response(result),
        "timeline": timeline,
        "output_probabilities": _output_probabilities(result),
        "state_snapshots": state_snapshots,
        "run": _run_response(result),
        "warnings": warnings,
        "issues": [_issue_to_dict(issue) for issue in result.issues],
    }


def _rates_response(result: SimulationResult) -> dict[str, Any]:
    """Expose rate diagnostics with canonical names and one legacy read alias."""

    derived = result.derived_parameters
    gamma_down = _safe_float_or_none(derived.get("gamma_down_per_us"))
    legacy_gamma1 = _safe_float_or_none(derived.get("gamma1_per_us"))

    return {
        "gamma0_per_us": _safe_float_or_none(derived.get("gamma0_per_us")),
        "gamma_down_per_us": gamma_down,
        "gamma_up_per_us": _safe_float_or_none(derived.get("gamma_up_per_us")),
        "gamma_population_relaxation_per_us": _safe_float_or_none(
            derived.get("gamma_population_relaxation_per_us")
        ),
        "gamma_phi_per_us": _safe_float_or_none(derived.get("gamma_phi_per_us")),
        "t1_base_us": _safe_float_or_none(derived.get("t1_base_us")),
        "t1_effective_us": _safe_float_or_none(derived.get("t1_effective_us")),
        "tphi_base_us": _safe_float_or_none(derived.get("tphi_base_us")),
        "t2_effective_us": _safe_float_or_none(derived.get("t2_effective_us")),
        # Compatibility only: gamma1 historically meant the downward rate, not total T1 decay.
        "gamma1_per_us": legacy_gamma1 if legacy_gamma1 is not None else gamma_down,
        "gamma1_per_us_deprecation": (
            "Legacy alias for gamma_down_per_us; it is not the population relaxation rate."
        ),
    }


def _circuit_response(config: SimulationConfig) -> dict[str, Any]:
    circuit = config.circuit
    return {
        "qubit_count": int(circuit.logical_qubits),
        "columns": [
            _column_response(column)
            for column in sorted(circuit.columns, key=lambda column: column.step)
        ],
    }


def _column_response(column: GateColumn) -> dict[str, Any]:
    return {
        "id": f"step-{column.step}",
        "step": int(column.step),
        "duration_us": _safe_float_or_none(column_duration_us(column)),
        "gates": [
            ui_gate
            for gate in column.gates
            for ui_gate in _gate_response_entries(gate)
        ],
    }


def _gate_response_entries(gate: GateOperation) -> list[dict[str, Any]]:
    gate_type = str(gate.type)
    normalized_type = gate_type.upper()

    if normalized_type == "CNOT":
        entries: list[dict[str, Any]] = []
        for control in gate.controls or []:
            entries.append({
                "label": "CNOT",
                "type": gate_type,
                "qubits": [int(control)],
                "kind": "control",
            })
        for target in gate.targets:
            entries.append({
                "label": "CNOT",
                "type": gate_type,
                "qubits": [int(target)],
                "kind": "target",
            })
        return entries

    kind = "measure" if normalized_type == "MEASURE" else "single"
    label = "M" if normalized_type == "MEASURE" else gate_type
    return [
        {
            "label": label,
            "type": gate_type,
            "qubits": [int(target)],
            "kind": kind,
        }
        for target in gate.targets
    ]


def _parameters_response(config: SimulationConfig) -> dict[str, Any]:
    environment = config.environment
    is_physical = _is_physical_mode(environment)
    is_normalized = _is_normalized_mode(environment)

    return {
        "environment_model": str(environment.model),
        "input_mode": str(environment.input_mode),
        "temperature_k": (
            _safe_float_or_none(environment.temperature_mk / 1000.0)
            if is_physical
            else None
        ),
        "temperature_mk": (
            _safe_float_or_none(environment.temperature_mk)
            if is_physical
            else None
        ),
        "normalized_temperature": (
            _safe_float_or_none(environment.temperature)
            if is_normalized
            else None
        ),
        "qubit_frequency_ghz": (
            _safe_float_or_none(environment.qubit_frequency_ghz)
            if is_physical
            else None
        ),
        "device_quality": (
            _safe_float_or_none(environment.device_quality)
            if is_physical
            else None
        ),
        "flux_noise_phi0": (
            _safe_float_or_none(environment.flux_noise_phi0)
            if is_physical
            else None
        ),
        "duration_us": _safe_float(config.duration_us),
        "time_steps": int(config.time_steps),
        "fidelity_threshold": _safe_float(config.fidelity_threshold),
        "simulation_backend": str(config.simulation_backend),
    }


def _diagnostics_response(result: SimulationResult) -> dict[str, Any]:
    diagnostics = dict(result.diagnostics)
    config = result.config

    diagnostics["simulation_backend"] = str(
        diagnostics.get(
            "simulation_backend",
            diagnostics.get("backend_requested", config.simulation_backend),
        )
    )

    for key in (
        "simulation_model",
        "evolution_mode",
        "backend_name",
        "rust_kernel_mode",
    ):
        diagnostics[key] = str(diagnostics.get(key, ""))

    for key in ("rust_kernel_call_count", "rust_kernel_sampled_batch_count"):
        diagnostics[key] = _safe_float(diagnostics.get(key, 0.0))

    for key in ("backend_fallback_used", "rust_kernel_fallback_used"):
        diagnostics[key] = bool(diagnostics.get(key, False))

    return {str(key): _json_safe_value(value) for key, value in diagnostics.items()}


def _summary_response(result: SimulationResult) -> dict[str, Any]:
    diagnostics = result.diagnostics
    return {
        "final_fidelity": _first_number_or_none(
            diagnostics.get("final_fidelity"),
            result.fidelity[-1] if result.fidelity else None,
        ),
        "final_purity": _first_number_or_none(
            diagnostics.get("final_purity"),
            result.purity[-1] if result.purity else None,
        ),
        "completion_fidelity": _safe_float_or_none(
            diagnostics.get("completion_fidelity")
        ),
        "completion_purity": _safe_float_or_none(
            diagnostics.get("completion_purity")
        ),
        "effective_time_us": _safe_float_or_none(
            result.effective_operation_time_us
        ),
    }


def _timeline(result: SimulationResult) -> tuple[list[dict[str, float | None]], list[str]]:
    length = min(len(result.times), len(result.fidelity), len(result.purity))
    warnings: list[str] = []
    if length != len(result.times) or length != len(result.fidelity) or length != len(result.purity):
        warnings.append(
            "Timeline arrays had different lengths; the UI response used the shortest length."
        )

    return [
        {
            "time_us": _safe_float(result.times[index]),
            "fidelity": _safe_float_or_none(result.fidelity[index]),
            "purity": _safe_float_or_none(result.purity[index]),
        }
        for index in range(length)
    ], warnings


def _output_probabilities(result: SimulationResult) -> dict[str, float]:
    return {
        str(label): _safe_float(value)
        for label, value in result.output_probabilities.items()
    }


def _run_response(result: SimulationResult) -> dict[str, str]:
    selected_backend = str(
        result.diagnostics.get(
            "backend_requested",
            result.config.simulation_backend,
        )
    )
    return {
        "status": (
            "Completed with issues"
            if _has_fatal_or_error_issue(result.issues)
            else "Completed"
        ),
        "selected_backend": selected_backend,
        "last_run_label": "Latest simulation",
    }


def _is_physical_mode(environment: EnvironmentConfig) -> bool:
    return str(environment.input_mode).lower() == "physical"


def _is_normalized_mode(environment: EnvironmentConfig) -> bool:
    return str(environment.input_mode).lower() == "normalized"


def _has_fatal_or_error_issue(issues: list[Any]) -> bool:
    for issue in issues:
        level = getattr(issue, "level", None)
        if isinstance(issue, Mapping):
            level = issue.get("level")
        if str(level).lower() in {"error", "fatal"}:
            return True
    return False


def _issue_to_dict(issue: Any) -> dict[str, Any]:
    if hasattr(issue, "to_dict"):
        return {
            str(key): _json_safe_value(value)
            for key, value in issue.to_dict().items()
        }
    if isinstance(issue, Mapping):
        return {
            str(key): _json_safe_value(value)
            for key, value in issue.items()
        }
    return {
        "level": "warning",
        "code": "UNSTRUCTURED_ISSUE",
        "message": str(issue),
        "detail": None,
        "suggestion": None,
    }


def _first_number_or_none(*values: Any) -> float | None:
    for value in values:
        converted = _safe_float_or_none(value)
        if converted is not None:
            return converted
    return None


def _safe_float(value: Any) -> float:
    converted = _safe_float_or_none(value)
    if converted is None:
        raise ValueError("value must be a finite number")
    return converted


def _safe_float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    converted = float(value)
    if converted != converted or converted in {float("inf"), float("-inf")}:
        raise ValueError("value must be finite")
    return converted


def _json_safe_value(value: Any) -> Any:
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, int):
        return int(value)
    if isinstance(value, float):
        return _safe_float(value)
    return str(value)
