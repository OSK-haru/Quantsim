"""JSON-friendly simulation input and output models."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from core.capabilities import DEFAULT_SIMULATION_MODEL
from core.circuit_model import CircuitConfig
from core.errors import ValidationIssue


@dataclass(init=False)
class EnvironmentConfig:
    """Environmental inputs for the MVP simulation model."""

    mode: str = "normalized"
    temperature: float = 0.02
    magnetic_field: float = 0.0
    noise_level: float = 0.01
    observation_strength: float | None = None
    observation_frequency: float | None = None

    def __init__(
        self,
        mode: str = "normalized",
        temperature: float | None = None,
        magnetic_field: float | None = None,
        noise_level: float = 0.01,
        observation_strength: float | None = None,
        observation_frequency: float | None = None,
        temperature_kelvin: float | None = None,
        magnetic_field_tesla: float | None = None,
    ) -> None:
        if temperature is None:
            temperature = 0.02 if temperature_kelvin is None else temperature_kelvin
        if magnetic_field is None:
            magnetic_field = (
                0.0
                if magnetic_field_tesla is None
                else magnetic_field_tesla
            )

        self.mode = mode
        self.temperature = temperature
        self.magnetic_field = magnetic_field
        self.noise_level = noise_level
        self.observation_strength = observation_strength
        self.observation_frequency = observation_frequency
        self.__post_init__()

    def __post_init__(self) -> None:
        self.mode = str(self.mode)
        if not self.mode:
            raise ValueError("mode must not be empty")

        self.temperature = _float(self.temperature, "temperature")
        self.magnetic_field = _float(self.magnetic_field, "magnetic_field")
        self.noise_level = _float(self.noise_level, "noise_level")
        self.observation_strength = _optional_float(
            self.observation_strength,
            "observation_strength",
        )
        self.observation_frequency = _optional_float(
            self.observation_frequency,
            "observation_frequency",
        )

    @property
    def temperature_kelvin(self) -> float:
        return self.temperature

    @property
    def magnetic_field_tesla(self) -> float:
        return self.magnetic_field

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "temperature": self.temperature,
            "magnetic_field": self.magnetic_field,
            "noise_level": self.noise_level,
            "observation_strength": self.observation_strength,
            "observation_frequency": self.observation_frequency,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "EnvironmentConfig":
        data = _require_mapping(data, "environment config")
        return cls(
            mode=data.get("mode", "normalized"),
            temperature=data.get("temperature", data.get("temperature_kelvin", 0.02)),
            magnetic_field=data.get(
                "magnetic_field",
                data.get("magnetic_field_tesla", 0.0),
            ),
            noise_level=data.get("noise_level", 0.01),
            observation_strength=data.get("observation_strength"),
            observation_frequency=data.get("observation_frequency"),
        )


@dataclass
class SimulationConfig:
    """Complete configuration for a single simulation run."""

    circuit: CircuitConfig = field(default_factory=CircuitConfig.one_qubit_h)
    environment: EnvironmentConfig = field(default_factory=EnvironmentConfig)
    duration_us: float = 20.0
    time_steps: int = 101
    fidelity_threshold: float = 0.9
    model: str = DEFAULT_SIMULATION_MODEL

    def __post_init__(self) -> None:
        if not isinstance(self.circuit, CircuitConfig):
            self.circuit = CircuitConfig.from_dict(self.circuit)
        if not isinstance(self.environment, EnvironmentConfig):
            self.environment = EnvironmentConfig.from_dict(self.environment)

        self.duration_us = _float(self.duration_us, "duration_us")
        self.time_steps = _int(self.time_steps, "time_steps")
        self.fidelity_threshold = _float(
            self.fidelity_threshold,
            "fidelity_threshold",
        )
        self.model = str(self.model)
        if not self.model:
            raise ValueError("model must not be empty")

    def to_dict(self) -> dict[str, Any]:
        return {
            "circuit": self.circuit.to_dict(),
            "environment": self.environment.to_dict(),
            "duration_us": self.duration_us,
            "time_steps": self.time_steps,
            "fidelity_threshold": self.fidelity_threshold,
            "model": self.model,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "SimulationConfig":
        data = _require_mapping(data, "simulation config")
        return cls(
            circuit=CircuitConfig.from_dict(data["circuit"]),
            environment=EnvironmentConfig.from_dict(data["environment"]),
            duration_us=data.get("duration_us", 20.0),
            time_steps=data.get("time_steps", 101),
            fidelity_threshold=data.get("fidelity_threshold", 0.9),
            model=data.get("model", DEFAULT_SIMULATION_MODEL),
        )


@dataclass
class SimulationResult:
    """Simulation output suitable for save/load, export, and inspection."""

    config: SimulationConfig
    times: list[float]
    fidelity: list[float]
    purity: list[float]
    effective_operation_time_us: float | None
    output_probabilities: dict[str, float] = field(default_factory=dict)
    derived_parameters: dict[str, float] = field(default_factory=dict)
    diagnostics: dict[str, float] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    issues: list[ValidationIssue] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not isinstance(self.config, SimulationConfig):
            self.config = SimulationConfig.from_dict(self.config)

        self.times = [_float(time, "time") for time in self.times]
        self.fidelity = [_float(value, "fidelity") for value in self.fidelity]
        self.purity = [_float(value, "purity") for value in self.purity]

        if self.effective_operation_time_us is not None:
            self.effective_operation_time_us = _float(
                self.effective_operation_time_us,
                "effective_operation_time_us",
            )

        self.output_probabilities = {
            str(name): _float(value, f"output probability {name}")
            for name, value in self.output_probabilities.items()
        }
        self.derived_parameters = {
            str(name): _float(value, f"derived parameter {name}")
            for name, value in self.derived_parameters.items()
        }
        self.diagnostics = {
            str(name): _float(value, f"diagnostic {name}")
            for name, value in self.diagnostics.items()
        }
        self.warnings = [str(warning) for warning in self.warnings]
        self.issues = [
            issue
            if isinstance(issue, ValidationIssue)
            else ValidationIssue.from_dict(issue)
            for issue in self.issues
        ]

    def to_dict(self) -> dict[str, Any]:
        return {
            "config": self.config.to_dict(),
            "times": list(self.times),
            "fidelity": list(self.fidelity),
            "purity": list(self.purity),
            "effective_operation_time_us": self.effective_operation_time_us,
            "output_probabilities": dict(self.output_probabilities),
            "derived_parameters": dict(self.derived_parameters),
            "diagnostics": dict(self.diagnostics),
            "warnings": list(self.warnings),
            "issues": [issue.to_dict() for issue in self.issues],
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "SimulationResult":
        data = _require_mapping(data, "simulation result")
        return cls(
            config=SimulationConfig.from_dict(data["config"]),
            times=list(data["times"]),
            fidelity=list(data["fidelity"]),
            purity=list(data["purity"]),
            effective_operation_time_us=data.get("effective_operation_time_us"),
            output_probabilities=dict(data.get("output_probabilities") or {}),
            derived_parameters=dict(data.get("derived_parameters") or {}),
            diagnostics=dict(data.get("diagnostics") or {}),
            warnings=list(data.get("warnings") or []),
            issues=[
                issue
                if isinstance(issue, ValidationIssue)
                else ValidationIssue.from_dict(issue)
                for issue in data.get("issues", [])
            ],
        )


def _require_mapping(data: Mapping[str, Any], name: str) -> Mapping[str, Any]:
    if not isinstance(data, Mapping):
        raise TypeError(f"{name} must be a mapping")
    return data


def _int(value: Any, name: str) -> int:
    if isinstance(value, bool):
        raise TypeError(f"{name} must be an integer")
    if isinstance(value, float) and not value.is_integer():
        raise ValueError(f"{name} must be an integer")
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"{name} must be an integer") from exc
    return value


def _optional_float(value: Any, name: str) -> float | None:
    if value is None:
        return None
    return _float(value, name)


def _float(value: Any, name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"{name} must be a number") from exc
