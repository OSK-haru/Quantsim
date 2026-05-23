"""A/B comparison workflow built on top of run_simulation."""

from __future__ import annotations

from dataclasses import dataclass, field

from core.capabilities import DEFAULT_SIMULATION_MODEL
from core.circuit_model import CircuitConfig
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation


@dataclass
class ComparisonConfig:
    """Configuration for comparing one circuit under two environments."""

    circuit: CircuitConfig
    environment_a: EnvironmentConfig
    environment_b: EnvironmentConfig
    duration_us: float = 20.0
    time_steps: int = 101
    fidelity_threshold: float = 0.9
    model: str = DEFAULT_SIMULATION_MODEL
    label_a: str = "Condition A"
    label_b: str = "Condition B"

    def __post_init__(self) -> None:
        if not isinstance(self.circuit, CircuitConfig):
            self.circuit = CircuitConfig.from_dict(self.circuit)
        if not isinstance(self.environment_a, EnvironmentConfig):
            self.environment_a = EnvironmentConfig.from_dict(self.environment_a)
        if not isinstance(self.environment_b, EnvironmentConfig):
            self.environment_b = EnvironmentConfig.from_dict(self.environment_b)

        self.duration_us = float(self.duration_us)
        self.time_steps = int(self.time_steps)
        self.fidelity_threshold = float(self.fidelity_threshold)
        self.model = str(self.model)
        self.label_a = str(self.label_a)
        self.label_b = str(self.label_b)


@dataclass
class ComparisonResult:
    """Result of running a circuit under condition A and condition B."""

    config: ComparisonConfig
    result_a: SimulationResult
    result_b: SimulationResult
    delta_final_fidelity: float | None
    delta_final_purity: float | None
    delta_effective_operation_time_us: float | None
    better_condition: str | None
    warnings: list[str] = field(default_factory=list)


def run_comparison(config: ComparisonConfig) -> ComparisonResult:
    """Run A/B simulations without adding comparison-specific physics."""

    if not isinstance(config, ComparisonConfig):
        raise TypeError("config must be a ComparisonConfig")

    result_a = run_simulation(_simulation_config(config, config.environment_a))
    result_b = run_simulation(_simulation_config(config, config.environment_b))
    delta_final_fidelity = _delta_last(result_b.fidelity, result_a.fidelity)
    delta_final_purity = _delta_last(result_b.purity, result_a.purity)
    delta_effective_time = _delta_optional(
        result_b.effective_operation_time_us,
        result_a.effective_operation_time_us,
    )

    return ComparisonResult(
        config=config,
        result_a=result_a,
        result_b=result_b,
        delta_final_fidelity=delta_final_fidelity,
        delta_final_purity=delta_final_purity,
        delta_effective_operation_time_us=delta_effective_time,
        better_condition=_better_condition(config, result_a, result_b),
        warnings=[*result_a.warnings, *result_b.warnings],
    )


def _simulation_config(
    config: ComparisonConfig,
    environment: EnvironmentConfig,
) -> SimulationConfig:
    return SimulationConfig(
        circuit=config.circuit,
        environment=environment,
        duration_us=config.duration_us,
        time_steps=config.time_steps,
        fidelity_threshold=config.fidelity_threshold,
        model=config.model,
    )


def _delta_last(
    values_b: list[float],
    values_a: list[float],
) -> float | None:
    if not values_a or not values_b:
        return None
    return values_b[-1] - values_a[-1]


def _delta_optional(
    value_b: float | None,
    value_a: float | None,
) -> float | None:
    if value_a is None or value_b is None:
        return None
    return value_b - value_a


def _better_condition(
    config: ComparisonConfig,
    result_a: SimulationResult,
    result_b: SimulationResult,
) -> str | None:
    score_a = _score(result_a)
    score_b = _score(result_b)
    if score_a is None or score_b is None:
        return None
    if score_a > score_b:
        return config.label_a
    if score_b > score_a:
        return config.label_b
    return "Tie"


def _score(result: SimulationResult) -> tuple[float, float] | None:
    if not result.fidelity:
        return None
    effective_time = result.effective_operation_time_us
    return (
        result.fidelity[-1],
        -1.0 if effective_time is None else effective_time,
    )
