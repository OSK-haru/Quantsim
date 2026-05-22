"""Circuit-editor validation helpers."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from core.capabilities import SUPPORTED_GATES, normalize_gate_type
from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.errors import ValidationIssue


def validate_circuit_config(config: CircuitConfig) -> list[ValidationIssue]:
    """Validate a circuit config for editor-safe placement."""

    return _validate_circuit(
        logical_qubits=config.logical_qubits,
        columns=config.columns,
    )


def validate_circuit_state(state: Any) -> list[ValidationIssue]:
    """Validate a CircuitState-like object without importing CircuitState."""

    return _validate_circuit(
        logical_qubits=state.logical_qubits,
        columns=state.columns,
    )


def validate_gate_for_circuit(
    logical_qubits: int,
    gate: GateOperation,
) -> list[ValidationIssue]:
    """Validate one gate without considering other gates in the same column."""

    issues: list[ValidationIssue] = []
    gate_type = normalize_gate_type(gate.type)

    if gate_type not in SUPPORTED_GATES:
        issues.append(_error(
            "INVALID_GATE_TYPE",
            "Gate type is not supported by the circuit editor.",
            f"Received gate type={gate.type!r}.",
            "Use one of I, H, X, Z, CNOT, or Measure.",
        ))

    if not gate.targets:
        issues.append(_error(
            "GATE_REQUIRES_TARGET",
            "Gate must have at least one target.",
            f"Received targets={gate.targets!r}.",
            "Choose a target qubit for the gate.",
        ))

    for target in gate.targets:
        if not _is_qubit_in_range(target, logical_qubits):
            issues.append(_error(
                "GATE_TARGET_OUT_OF_RANGE",
                "Gate target is outside the logical qubit range.",
                f"Received target={target}; logical_qubits={logical_qubits}.",
                "Use target indices from 0 to logical_qubits - 1.",
            ))

    for control in gate.controls or []:
        if not _is_qubit_in_range(control, logical_qubits):
            issues.append(_error(
                "GATE_CONTROL_OUT_OF_RANGE",
                "Gate control is outside the logical qubit range.",
                f"Received control={control}; logical_qubits={logical_qubits}.",
                "Use control indices from 0 to logical_qubits - 1.",
            ))

    if gate_type == "CNOT":
        if len(gate.controls or []) != 1:
            issues.append(_error(
                "CNOT_REQUIRES_CONTROL",
                "CNOT requires exactly one control qubit.",
                f"Received controls={gate.controls!r}.",
                "Set exactly one control qubit for CNOT.",
            ))
        if len(gate.targets) != 1:
            issues.append(_error(
                "CNOT_REQUIRES_TARGET",
                "CNOT requires exactly one target qubit.",
                f"Received targets={gate.targets!r}.",
                "Set exactly one target qubit for CNOT.",
            ))
        for control in gate.controls or []:
            if control in gate.targets:
                issues.append(_error(
                    "CNOT_CONTROL_EQUALS_TARGET",
                    "CNOT control and target must be different qubits.",
                    f"Received control={control}, targets={gate.targets!r}.",
                    "Choose different qubits for CNOT control and target.",
                ))

    return issues


def validate_gate_placement(
    logical_qubits: int,
    columns: Sequence[GateColumn],
    step: int,
    gate: GateOperation,
) -> list[ValidationIssue]:
    """Validate a gate placement against existing gates in one step."""

    issues = validate_gate_for_circuit(logical_qubits, gate)
    candidate_qubits = _gate_qubits(gate)

    for column in columns:
        if column.step != step:
            continue
        for existing_gate in column.gates:
            overlap = candidate_qubits.intersection(_gate_qubits(existing_gate))
            if overlap:
                issues.append(_error(
                    "CELL_ALREADY_OCCUPIED",
                    "A qubit already has an operation in this step.",
                    (
                        f"Step {step} already uses qubit(s) "
                        f"{sorted(overlap)}."
                    ),
                    "Choose another step or remove the existing gate first.",
                ))

    return issues


def _validate_circuit(
    logical_qubits: int,
    columns: Iterable[GateColumn],
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    for column in columns:
        occupied: dict[int, GateOperation] = {}
        for gate in column.gates:
            issues.extend(validate_gate_for_circuit(logical_qubits, gate))
            for qubit in _gate_qubits(gate):
                if qubit in occupied:
                    issues.append(_error(
                        "CELL_ALREADY_OCCUPIED",
                        "A qubit has multiple operations in the same step.",
                        (
                            f"Step {column.step} has multiple operations "
                            f"touching qubit {qubit}."
                        ),
                        "Move one of the gates to a different step.",
                    ))
                occupied[qubit] = gate

    return issues


def _gate_qubits(gate: GateOperation) -> set[int]:
    return set(gate.targets).union(gate.controls or [])


def _is_qubit_in_range(index: int, logical_qubits: int) -> bool:
    return 0 <= index < logical_qubits


def _error(
    code: str,
    message: str,
    detail: str | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue(
        level="error",
        code=code,
        message=message,
        detail=detail,
        suggestion=suggestion,
    )
