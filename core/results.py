"""JSON-friendly simulation input and output models."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from core.capabilities import DEFAULT_SIMULATION_MODEL
from core.circuit_model import CircuitConfig
from core.errors import ValidationIssue
from core.physical_environment import (
    INPUT_MODE_NORMALIZED,
    INPUT_MODE_PHYSICAL,
    NORMALIZED_ENVIRONMENT_MODEL,
    PHYSICAL_ENVIRONMENT_MODEL,
    UNIFIED_ENVIRONMENT_MODEL,
    input_mode_from_legacy_model,
    normalize_environment_model,
)


@dataclass(init=False)
class EnvironmentConfig:
    """Environmental inputs for the MVP simulation model."""

    mode: str = "normalized"
    model: str = UNIFIED_ENVIRONMENT_MODEL
    input_mode: str = INPUT_MODE_NORMALIZED
    temperature: float = 0.02
    magnetic_field: float = 0.0
    noise_level: float = 0.01
    observation_strength: float | None = None
    observation_frequency: float | None = None
    device_quality: float = 0.5
    temperature_mk: float = 15.0
    flux_noise_phi0: float = 1e-6
    qubit_frequency_ghz: float = 5.0
    t1_max_us: float = 100.0
    tphi_max_us: float = 100.0
    ideal_reference: bool = False

    def __init__(
        self,
        mode: str = "normalized",
        model: str | None = None,
        input_mode: str | None = None,
        environment_model: str | None = None,
        temperature: float | None = None,
        magnetic_field: float | None = None,
        noise_level: float = 0.01,
        observation_strength: float | None = None,
        observation_frequency: float | None = None,
        temperature_kelvin: float | None = None,
        magnetic_field_tesla: float | None = None,
        device_quality: float = 0.5,
        temperature_mk: float = 15.0,
        flux_noise_phi0: float = 1e-6,
        qubit_frequency_ghz: float = 5.0,
        t1_max_us: float = 100.0,
        tphi_max_us: float = 100.0,
        ideal_reference: bool = False,
    ) -> None:
        legacy_model = environment_model if environment_model is not None else model
        if input_mode is None:
            input_mode = input_mode_from_legacy_model(legacy_model)
        if temperature is None:
            temperature = 0.02 if temperature_kelvin is None else temperature_kelvin
        if magnetic_field is None:
            magnetic_field = (
                0.0
                if magnetic_field_tesla is None
                else magnetic_field_tesla
            )

        self.mode = mode
        self.model = normalize_environment_model(legacy_model)
        self.input_mode = input_mode
        self.temperature = temperature
        self.magnetic_field = magnetic_field
        self.noise_level = noise_level
        self.observation_strength = observation_strength
        self.observation_frequency = observation_frequency
        self.device_quality = device_quality
        self.temperature_mk = temperature_mk
        self.flux_noise_phi0 = flux_noise_phi0
        self.qubit_frequency_ghz = qubit_frequency_ghz
        self.t1_max_us = t1_max_us
        self.tphi_max_us = tphi_max_us
        self.ideal_reference = ideal_reference
        self.__post_init__()

    def __post_init__(self) -> None:
        self.mode = str(self.mode)
        if not self.mode:
            raise ValueError("mode must not be empty")
        self.model = normalize_environment_model(self.model)
        if not self.model:
            raise ValueError("model must not be empty")
        self.input_mode = str(self.input_mode)
        if not self.input_mode:
            raise ValueError("input_mode must not be empty")

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
        self.device_quality = _float(self.device_quality, "device_quality")
        self.temperature_mk = _float(self.temperature_mk, "temperature_mk")
        self.flux_noise_phi0 = _float(self.flux_noise_phi0, "flux_noise_phi0")
        self.qubit_frequency_ghz = _float(
            self.qubit_frequency_ghz,
            "qubit_frequency_ghz",
        )
        self.t1_max_us = _float(self.t1_max_us, "t1_max_us")
        self.tphi_max_us = _float(self.tphi_max_us, "tphi_max_us")
        self.ideal_reference = bool(self.ideal_reference)

    @property
    def temperature_kelvin(self) -> float:
        return self.temperature

    @property
    def magnetic_field_tesla(self) -> float:
        return self.magnetic_field

    @property
    def environment_model(self) -> str:
        return self.model

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "model": self.model,
            "input_mode": self.input_mode,
            "normalized": {
                "temperature_parameter": self.temperature,
                "magnetic_field_parameter": self.magnetic_field,
                "noise_level": self.noise_level,
            },
            "physical": {
                "device_quality": self.device_quality,
                "temperature_mk": self.temperature_mk,
                "flux_noise_phi0": self.flux_noise_phi0,
                "qubit_frequency_ghz": self.qubit_frequency_ghz,
                "t1_max_us": self.t1_max_us,
                "tphi_max_us": self.tphi_max_us,
                "ideal_reference": self.ideal_reference,
            },
            "observation_strength": self.observation_strength,
            "observation_frequency": self.observation_frequency,
            "temperature": self.temperature,
            "magnetic_field": self.magnetic_field,
            "noise_level": self.noise_level,
            "device_quality": self.device_quality,
            "temperature_mk": self.temperature_mk,
            "flux_noise_phi0": self.flux_noise_phi0,
            "qubit_frequency_ghz": self.qubit_frequency_ghz,
            "t1_max_us": self.t1_max_us,
            "tphi_max_us": self.tphi_max_us,
            "ideal_reference": self.ideal_reference,
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "EnvironmentConfig":
        data = _require_mapping(data, "environment config")
        normalized = data.get("normalized") or {}
        physical = data.get("physical") or {}
        if not isinstance(normalized, Mapping):
            raise TypeError("environment.normalized must be a mapping")
        if not isinstance(physical, Mapping):
            raise TypeError("environment.physical must be a mapping")
        legacy_model = data.get("environment_model", data.get("model"))
        input_mode = data.get("input_mode")
        if input_mode is None and legacy_model in {
            NORMALIZED_ENVIRONMENT_MODEL,
            PHYSICAL_ENVIRONMENT_MODEL,
        }:
            input_mode = input_mode_from_legacy_model(legacy_model)
        return cls(
            mode=data.get("mode", "normalized"),
            model=data.get("model"),
            input_mode=input_mode,
            environment_model=data.get("environment_model"),
            temperature=data.get(
                "temperature",
                data.get(
                    "temperature_kelvin",
                    normalized.get("temperature_parameter", 0.02),
                ),
            ),
            magnetic_field=data.get(
                "magnetic_field",
                data.get(
                    "magnetic_field_tesla",
                    normalized.get("magnetic_field_parameter", 0.0),
                ),
            ),
            noise_level=data.get(
                "noise_level",
                normalized.get("noise_level", 0.01),
            ),
            observation_strength=data.get("observation_strength"),
            observation_frequency=data.get("observation_frequency"),
            device_quality=data.get(
                "device_quality",
                physical.get("device_quality", 0.5),
            ),
            temperature_mk=data.get(
                "temperature_mk",
                physical.get("temperature_mk", 15.0),
            ),
            flux_noise_phi0=data.get(
                "flux_noise_phi0",
                physical.get("flux_noise_phi0", 1e-6),
            ),
            qubit_frequency_ghz=data.get(
                "qubit_frequency_ghz",
                physical.get("qubit_frequency_ghz", 5.0),
            ),
            t1_max_us=data.get(
                "t1_max_us",
                physical.get("t1_max_us", 100.0),
            ),
            tphi_max_us=data.get(
                "tphi_max_us",
                physical.get("tphi_max_us", 100.0),
            ),
            ideal_reference=data.get(
                "ideal_reference",
                physical.get("ideal_reference", False),
            ),
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
    derived_parameters: dict[str, Any] = field(default_factory=dict)
    diagnostics: dict[str, Any] = field(default_factory=dict)
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
            str(name): _json_value(value, f"derived parameter {name}")
            for name, value in self.derived_parameters.items()
        }
        self.diagnostics = {
            str(name): _json_value(value, f"diagnostic {name}")
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


def _json_value(value: Any, name: str) -> Any:
    if isinstance(value, bool) or value is None:
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return float(value)
    raise TypeError(f"{name} must be JSON-serializable scalar")
