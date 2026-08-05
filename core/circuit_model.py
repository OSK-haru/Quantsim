"""JSON-friendly circuit configuration models for the core API."""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ClassicalCondition:
    """A single classical-register predicate attached to a gate."""

    bit: int
    value: int

    def __post_init__(self) -> None:
        self.bit = _non_negative_int(self.bit, "classical condition bit")
        self.value = _int(self.value, "classical condition value")
        if self.value not in {0, 1}:
            raise ValueError("classical condition value must be 0 or 1")

    def to_dict(self) -> dict[str, int]:
        return {"bit": self.bit, "value": self.value}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClassicalCondition":
        data = _require_mapping(data, "classical condition")
        return cls(bit=data["bit"], value=data["value"])


@dataclass
class GateOperation:
    """One logical gate operation in a circuit column."""

    type: str
    targets: list[int]
    controls: list[int] | None = None
    params: dict[str, float] | None = None
    classical_targets: list[int] | None = None
    condition: ClassicalCondition | None = None
    conditions: list[ClassicalCondition] | None = None

    def __post_init__(self) -> None:
        self.type = str(self.type)
        if not self.type:
            raise ValueError("gate type must not be empty")

        self.targets = [_int(target, "target") for target in self.targets]

        controls = [] if self.controls is None else self.controls
        self.controls = [_int(control, "control") for control in controls]

        params = {} if self.params is None else self.params
        self.params = {
            str(name): _finite_float(value, f"param {name}")
            for name, value in params.items()
        }
        classical_targets = [] if self.classical_targets is None else self.classical_targets
        self.classical_targets = [
            _non_negative_int(target, "classical target")
            for target in classical_targets
        ]
        if self.condition is not None and not isinstance(
            self.condition,
            ClassicalCondition,
        ):
            self.condition = ClassicalCondition.from_dict(self.condition)
        raw_conditions = [] if self.conditions is None else self.conditions
        self.conditions = [
            item if isinstance(item, ClassicalCondition)
            else ClassicalCondition.from_dict(item)
            for item in raw_conditions
        ]
        if self.condition is not None:
            self.conditions = [self.condition, *self.conditions]
        deduplicated: list[ClassicalCondition] = []
        seen: set[tuple[int, int]] = set()
        for item in self.conditions:
            key = (item.bit, item.value)
            if key not in seen:
                deduplicated.append(item)
                seen.add(key)
        self.conditions = deduplicated
        self.condition = self.conditions[0] if self.conditions else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "targets": list(self.targets),
            "controls": list(self.controls or []),
            "params": dict(self.params or {}),
            "classical_targets": list(self.classical_targets or []),
            "condition": (
                None if self.condition is None else self.condition.to_dict()
            ),
            "conditions": [item.to_dict() for item in self.conditions],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "GateOperation":
        data = _require_mapping(data, "gate operation")
        return cls(
            type=data["type"],
            targets=list(data["targets"]),
            controls=list(data.get("controls") or []),
            params=dict(data.get("params") or {}),
            classical_targets=list(data.get("classical_targets") or []),
            condition=(
                None
                if data.get("condition") is None
                else ClassicalCondition.from_dict(data["condition"])
            ),
            conditions=[
                ClassicalCondition.from_dict(item)
                for item in (data.get("conditions") or [])
            ],
        )


@dataclass
class CircuitAnnotation:
    """A visual-only marker on a circuit (never applied as a quantum operation)."""

    kind: str
    column_index: int
    qubits: list[int]
    id: str | None = None
    source_id: str | None = None

    def __post_init__(self) -> None:
        self.kind = str(self.kind).upper()
        if self.kind not in {"MESSAGE", "RECEIVED"}:
            raise ValueError("unsupported circuit annotation kind")
        self.column_index = _non_negative_int(self.column_index, "annotation column")
        self.qubits = [_non_negative_int(qubit, "annotation qubit") for qubit in self.qubits]

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "column_index": self.column_index,
            "qubits": list(self.qubits),
            "id": self.id,
            "source_id": self.source_id,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "CircuitAnnotation":
        data = _require_mapping(data, "circuit annotation")
        return cls(
            kind=data["kind"],
            column_index=data.get("column_index", data.get("column", 0)),
            qubits=list(data.get("qubits") or []),
            id=data.get("id"),
            source_id=data.get("source_id", data.get("sourceId")),
        )


@dataclass
class GateColumn:
    """Gate operations that occur in the same logical time step."""

    step: int
    gates: list[GateOperation] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.step = _non_negative_int(self.step, "step")
        self.gates = [
            gate if isinstance(gate, GateOperation) else GateOperation.from_dict(gate)
            for gate in self.gates
        ]

    def to_dict(self) -> dict[str, Any]:
        return {
            "step": self.step,
            "gates": [gate.to_dict() for gate in self.gates],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "GateColumn":
        data = _require_mapping(data, "gate column")
        return cls(
            step=data["step"],
            gates=[
                gate if isinstance(gate, GateOperation) else GateOperation.from_dict(gate)
                for gate in data.get("gates", [])
            ],
        )


@dataclass
class CircuitConfig:
    """Circuit-level configuration shared by UI, save/load, and simulation."""

    logical_qubits: int = 1
    initial_states: list[str] = field(default_factory=lambda: ["0"])
    columns: list[GateColumn] = field(default_factory=list)
    classical_bits: int = 0
    annotations: list[CircuitAnnotation] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.logical_qubits = _int(self.logical_qubits, "logical_qubits")
        self.initial_states = [str(state) for state in self.initial_states]
        self.classical_bits = _non_negative_int(
            self.classical_bits,
            "classical_bits",
        )

        self.columns = [
            column if isinstance(column, GateColumn) else GateColumn.from_dict(column)
            for column in self.columns
        ]
        self.annotations = [
            item if isinstance(item, CircuitAnnotation) else CircuitAnnotation.from_dict(item)
            for item in self.annotations
        ]

    def to_dict(self) -> dict[str, Any]:
        return {
            "logical_qubits": self.logical_qubits,
            "initial_states": list(self.initial_states),
            "classical_bits": self.classical_bits,
            "columns": [column.to_dict() for column in self.columns],
            "annotations": [annotation.to_dict() for annotation in self.annotations],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "CircuitConfig":
        data = _require_mapping(data, "circuit config")
        return cls(
            logical_qubits=data["logical_qubits"],
            initial_states=list(data["initial_states"]),
            columns=[
                column if isinstance(column, GateColumn) else GateColumn.from_dict(column)
                for column in data.get("columns", [])
            ],
            classical_bits=data.get("classical_bits", 0),
            annotations=[
                item if isinstance(item, CircuitAnnotation) else CircuitAnnotation.from_dict(item)
                for item in (data.get("annotations") or [])
            ],
        )

    @classmethod
    def one_qubit_h(cls) -> "CircuitConfig":
        return cls(
            logical_qubits=1,
            initial_states=["0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(
                            type="H",
                            targets=[0],
                            controls=[],
                            params={},
                        )
                    ],
                )
            ],
        )


def _require_mapping(data: Mapping[str, Any], name: str) -> Mapping[str, Any]:
    if not isinstance(data, Mapping):
        raise TypeError(f"{name} must be a mapping")
    return data


def _non_negative_int(value: Any, name: str) -> int:
    value = _int(value, name)
    if value < 0:
        raise ValueError(f"{name} must be non-negative")
    return value


def _int(value: Any, name: str) -> int:
    if isinstance(value, bool):
        raise TypeError(f"{name} must be an integer")
    if isinstance(value, float) and not value.is_integer():
        raise ValueError(f"{name} must be an integer")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"{name} must be an integer") from exc


def _finite_float(value: Any, name: str) -> float:
    try:
        value = float(value)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"{name} must be a number") from exc
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
    return value
