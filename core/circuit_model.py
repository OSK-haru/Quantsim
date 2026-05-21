"""JSON-friendly circuit configuration models for the core API."""

from __future__ import annotations

import math
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GateOperation:
    """One logical gate operation in a circuit column."""

    type: str
    targets: list[int]
    controls: list[int] | None = None
    params: dict[str, float] | None = None

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

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "targets": list(self.targets),
            "controls": list(self.controls or []),
            "params": dict(self.params or {}),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "GateOperation":
        data = _require_mapping(data, "gate operation")
        return cls(
            type=data["type"],
            targets=list(data["targets"]),
            controls=list(data.get("controls") or []),
            params=dict(data.get("params") or {}),
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

    def __post_init__(self) -> None:
        self.logical_qubits = _int(self.logical_qubits, "logical_qubits")
        self.initial_states = [str(state) for state in self.initial_states]

        self.columns = [
            column if isinstance(column, GateColumn) else GateColumn.from_dict(column)
            for column in self.columns
        ]

    def to_dict(self) -> dict[str, Any]:
        return {
            "logical_qubits": self.logical_qubits,
            "initial_states": list(self.initial_states),
            "columns": [column.to_dict() for column in self.columns],
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
