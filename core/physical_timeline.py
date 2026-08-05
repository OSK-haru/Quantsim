"""Read-only physical timeline metadata derived from executed circuit columns."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from core.circuit_model import CircuitConfig, GateOperation
from core.gates import column_duration_us, gate_duration_us


def build_physical_timeline(
    circuit: CircuitConfig,
    *,
    sampled_times_us: Sequence[float],
    requested_duration_us: float,
    source_map: Sequence[Mapping[str, Any]] = (),
) -> dict[str, Any]:
    """Describe the solver's current sequential-column timing model.

    Each non-empty column is one effective-Hamiltonian segment whose duration is
    the maximum declared duration of its parallel operations.  Operation-level
    durations are metadata only; the entire column remains active for the
    column segment because that is what the current solver executes.
    """

    compiled_to_source = _compiled_to_source_columns(source_map)
    events: list[dict[str, Any]] = []
    simulation_time_us = 0.0

    for execution_column_index, column in enumerate(
        sorted(circuit.columns, key=lambda item: item.step)
    ):
        duration_us = float(column_duration_us(column))
        end_us = simulation_time_us + duration_us
        source_columns = sorted(
            compiled_to_source.get(execution_column_index, {execution_column_index})
        )
        events.append({
            "id": f"execution-column-{execution_column_index}",
            "kind": "circuit_column" if duration_us > 0.0 else "instantaneous_column",
            "execution_column_index": execution_column_index,
            "circuit_step": int(column.step),
            "source_circuit_columns": source_columns,
            "start_us": simulation_time_us,
            "duration_us": duration_us,
            "end_us": end_us,
            "operations": [
                _operation_metadata(gate, duration_us)
                for gate in column.gates
            ],
        })
        simulation_time_us = end_us

    sampled = [float(value) for value in sampled_times_us]
    sampled_end_us = max(sampled, default=0.0)
    total_duration_us = max(
        float(requested_duration_us),
        sampled_end_us,
        simulation_time_us,
    )
    if total_duration_us > simulation_time_us:
        events.append({
            "id": "post-circuit-idle",
            "kind": "idle",
            "execution_column_index": None,
            "circuit_step": None,
            "source_circuit_columns": [],
            "start_us": simulation_time_us,
            "duration_us": total_duration_us - simulation_time_us,
            "end_us": total_duration_us,
            "operations": [],
        })

    return {
        "schema_version": "physical_timeline_v1",
        "time_unit": "us",
        "column_timing_model": "sequential_columns_max_parallel_gate_duration_v1",
        "total_duration_us": total_duration_us,
        "circuit_completion_time_us": simulation_time_us,
        "sampled_times_us": sampled,
        "events": events,
    }


def _operation_metadata(
    gate: GateOperation,
    effective_column_duration_us: float,
) -> dict[str, Any]:
    controls = [int(value) for value in (gate.controls or [])]
    targets = [int(value) for value in gate.targets]
    return {
        "gate": str(gate.type).upper(),
        "qubits": sorted({*controls, *targets}),
        "targets": targets,
        "controls": controls,
        "declared_duration_us": float(gate_duration_us(gate)),
        "effective_column_duration_us": effective_column_duration_us,
    }


def _compiled_to_source_columns(
    source_map: Sequence[Mapping[str, Any]],
) -> dict[int, set[int]]:
    mapping: dict[int, set[int]] = {}
    for source in source_map:
        logical_column = int(source.get("logical_column", 0))
        for operation in source.get("compiled_operations", []):
            if not isinstance(operation, Mapping):
                continue
            compiled_column = int(operation.get("compiled_column", logical_column))
            mapping.setdefault(compiled_column, set()).add(logical_column)
    return mapping
