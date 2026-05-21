"""Validation and numerical diagnostics for the normalized core API."""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from typing import Any

from core.errors import ValidationIssue
from core.results import SimulationConfig, SimulationResult


SUPPORTED_GATES = {"I", "H", "X", "Z", "CNOT", "MEASURE"}
SUPPORTED_MODEL = "weak_coupling_lindblad"
BLOCKING_LEVELS = {"error", "fatal"}
FIDELITY_RANGE_TOL = 1e-10
PURITY_RANGE_TOL = 1e-10
PROBABILITY_SUM_TOL = 1e-8
PROBABILITY_NEGATIVE_TOL = 1e-8


def validate_simulation_config(config: SimulationConfig) -> list[ValidationIssue]:
    """Return standardized issues for a simulation configuration."""

    issues: list[ValidationIssue] = []
    circuit = config.circuit
    environment = config.environment

    logical_qubits = _as_number(circuit.logical_qubits)
    if not _is_finite_number(logical_qubits) or int(logical_qubits) != logical_qubits:
        issues.append(_error(
            "INVALID_LOGICAL_QUBITS",
            "logical_qubits must be an integer.",
            f"Received logical_qubits={circuit.logical_qubits!r}",
            "Set logical_qubits to an integer from 1 to 6.",
        ))
    else:
        qubit_count = int(logical_qubits)
        if qubit_count < 1:
            issues.append(_error(
                "INVALID_LOGICAL_QUBITS",
                "logical_qubits must be at least 1.",
                f"Received logical_qubits={qubit_count}",
                "Set logical_qubits to a value in the range [1, 6].",
            ))
        if qubit_count > 6:
            issues.append(_error(
                "TOO_MANY_LOGICAL_QUBITS",
                "logical_qubits must be 6 or less.",
                f"Received logical_qubits={qubit_count}",
                "Use at most 6 logical qubits for the lightweight simulator.",
            ))

    if len(circuit.initial_states) != circuit.logical_qubits:
        issues.append(_error(
            "INITIAL_STATE_COUNT_MISMATCH",
            "initial_states must match logical_qubits.",
            (
                f"Received {len(circuit.initial_states)} initial states for "
                f"{circuit.logical_qubits} logical qubits."
            ),
            "Provide exactly one initial state per logical qubit.",
        ))

    for column in circuit.columns:
        for gate in column.gates:
            gate_type = gate.type.upper()
            if gate_type not in SUPPORTED_GATES:
                issues.append(_error(
                    "UNSUPPORTED_GATE",
                    "Gate type is not supported.",
                    f"Received gate type={gate.type!r} at step {column.step}.",
                    "Use one of I, H, X, Z, CNOT, or Measure.",
                ))

            for target in gate.targets:
                if not _is_qubit_index_in_range(target, circuit.logical_qubits):
                    issues.append(_error(
                        "GATE_TARGET_OUT_OF_RANGE",
                        "Gate target is outside the logical qubit range.",
                        (
                            f"Gate {gate.type} at step {column.step} targets "
                            f"qubit {target}; logical_qubits={circuit.logical_qubits}."
                        ),
                        "Set targets to qubit indices from 0 to logical_qubits - 1.",
                    ))

            for control in gate.controls or []:
                if not _is_qubit_index_in_range(control, circuit.logical_qubits):
                    issues.append(_error(
                        "GATE_CONTROL_OUT_OF_RANGE",
                        "Gate control is outside the logical qubit range.",
                        (
                            f"Gate {gate.type} at step {column.step} controls "
                            f"qubit {control}; logical_qubits={circuit.logical_qubits}."
                        ),
                        "Set controls to qubit indices from 0 to logical_qubits - 1.",
                    ))

            if gate_type == "CNOT":
                for control in gate.controls or []:
                    if control in gate.targets:
                        issues.append(_error(
                            "CNOT_CONTROL_EQUALS_TARGET",
                            "CNOT control and target must be different qubits.",
                            (
                                f"Gate CNOT at step {column.step} uses qubit "
                                f"{control} as both control and target."
                            ),
                            "Choose different qubit indices for CNOT control and target.",
                        ))

    issues.extend(_range_issue(
        environment.temperature,
        "temperature",
        "INVALID_TEMPERATURE",
        0.0,
        1.0,
    ))
    issues.extend(_range_issue(
        environment.magnetic_field,
        "magnetic_field",
        "INVALID_MAGNETIC_FIELD",
        0.0,
        1.0,
    ))
    issues.extend(_range_issue(
        environment.noise_level,
        "noise_level",
        "INVALID_NOISE_LEVEL",
        0.0,
        1.0,
    ))
    if environment.observation_strength is not None:
        issues.extend(_range_issue(
            environment.observation_strength,
            "observation_strength",
            "INVALID_OBSERVATION_STRENGTH",
            0.0,
            1.0,
        ))
    if environment.observation_frequency is not None:
        frequency = _as_number(environment.observation_frequency)
        if not _is_finite_number(frequency) or frequency < 0.0:
            issues.append(_error(
                "INVALID_OBSERVATION_FREQUENCY",
                "observation_frequency must be non-negative.",
                f"Received observation_frequency={environment.observation_frequency!r}",
                "Set observation_frequency to None or a value greater than or equal to 0.",
            ))

    duration = _as_number(config.duration_us)
    if not _is_finite_number(duration) or duration <= 0.0:
        issues.append(_error(
            "INVALID_DURATION_US",
            "duration_us must be greater than 0.",
            f"Received duration_us={config.duration_us!r}",
            "Set duration_us to a positive value.",
        ))

    time_steps = _as_number(config.time_steps)
    if (
        not _is_finite_number(time_steps)
        or int(time_steps) != time_steps
        or time_steps < 2
    ):
        issues.append(_error(
            "INVALID_TIME_STEPS",
            "time_steps must be an integer greater than or equal to 2.",
            f"Received time_steps={config.time_steps!r}",
            "Set time_steps to at least 2.",
        ))

    threshold = _as_number(config.fidelity_threshold)
    if not _is_finite_number(threshold) or not 0.0 <= threshold <= 1.0:
        issues.append(_error(
            "INVALID_FIDELITY_THRESHOLD",
            "fidelity_threshold must be between 0.0 and 1.0.",
            f"Received fidelity_threshold={config.fidelity_threshold!r}",
            "Set fidelity_threshold to a value in the range [0.0, 1.0].",
        ))

    if config.model != SUPPORTED_MODEL:
        issues.append(_error(
            "UNSUPPORTED_MODEL",
            "Simulation model is not supported.",
            f"Received model={config.model!r}",
            f"Set model to {SUPPORTED_MODEL!r}.",
        ))

    return issues


def diagnose_simulation_result(result: SimulationResult) -> list[ValidationIssue]:
    """Return numerical diagnostics for a simulation result."""

    issues: list[ValidationIssue] = []

    if not result.times:
        issues.append(_error(
            "EMPTY_TIMES",
            "times must not be empty.",
            "Received an empty times series.",
            "Return at least one simulation time sample.",
        ))
    if not result.fidelity:
        issues.append(_error(
            "EMPTY_FIDELITY",
            "fidelity must not be empty.",
            "Received an empty fidelity series.",
            "Return one fidelity value per time sample.",
        ))
    if not result.purity:
        issues.append(_error(
            "EMPTY_PURITY",
            "purity must not be empty.",
            "Received an empty purity series.",
            "Return one purity value per time sample.",
        ))

    if not (len(result.times) == len(result.fidelity) == len(result.purity)):
        issues.append(_error(
            "SERIES_LENGTH_MISMATCH",
            "times, fidelity, and purity must have the same length.",
            (
                f"Received lengths: times={len(result.times)}, "
                f"fidelity={len(result.fidelity)}, purity={len(result.purity)}."
            ),
            "Return one fidelity and purity value for each time sample.",
        ))

    issues.extend(_finite_series_issues(result.times, "times", "TIME_VALUE_NOT_FINITE"))
    issues.extend(_finite_series_issues(
        result.fidelity,
        "fidelity",
        "FIDELITY_VALUE_NOT_FINITE",
    ))
    issues.extend(_finite_series_issues(
        result.purity,
        "purity",
        "PURITY_VALUE_NOT_FINITE",
    ))
    issues.extend(_probability_series_issues(
        result.fidelity,
        "fidelity",
        "FIDELITY_OUT_OF_RANGE",
        FIDELITY_RANGE_TOL,
    ))
    issues.extend(_probability_series_issues(
        result.purity,
        "purity",
        "PURITY_OUT_OF_RANGE",
        PURITY_RANGE_TOL,
    ))

    effective_time = result.effective_operation_time_us
    if effective_time is not None:
        value = _as_number(effective_time)
        if not _is_finite_number(value) or value < 0.0:
            issues.append(_error(
                "INVALID_EFFECTIVE_OPERATION_TIME",
                "effective_operation_time_us must be None or non-negative.",
                f"Received effective_operation_time_us={effective_time!r}",
                "Use None or a value greater than or equal to 0.",
            ))

    if result.output_probabilities:
        probability_sum = 0.0
        for state, probability in result.output_probabilities.items():
            value = _as_number(probability)
            if not _is_finite_number(value):
                issues.append(_fatal(
                    "OUTPUT_PROBABILITY_NOT_FINITE",
                    "Output probability contains NaN or infinity.",
                    f"Received output_probabilities[{state!r}]={probability!r}",
                    "Return only finite probability values.",
                ))
                continue
            probability_sum += value
            if value < -PROBABILITY_NEGATIVE_TOL:
                issues.append(_error(
                    "NEGATIVE_OUTPUT_PROBABILITY",
                    "Output probability is negative beyond tolerance.",
                    f"Received output_probabilities[{state!r}]={probability!r}",
                    "Return output probabilities greater than or equal to 0.",
                ))

        if abs(probability_sum - 1.0) > PROBABILITY_SUM_TOL:
            issues.append(_warning(
                "OUTPUT_PROBABILITY_SUM_MISMATCH",
                "Output probabilities should sum to 1.",
                f"Received probability sum={probability_sum!r}",
                "Normalize output probabilities before exposing them.",
            ))

    return issues


def has_blocking_issues(issues: Iterable[ValidationIssue]) -> bool:
    """Return True when issues should prevent physics execution."""

    return any(issue.level in BLOCKING_LEVELS for issue in issues)


def _range_issue(
    value: Any,
    field_name: str,
    code: str,
    minimum: float,
    maximum: float,
) -> list[ValidationIssue]:
    number = _as_number(value)
    if _is_finite_number(number) and minimum <= number <= maximum:
        return []
    return [_error(
        code,
        f"{field_name} must be between {minimum} and {maximum}.",
        f"Received {field_name}={value!r}",
        f"Set {field_name} to a value in the range [{minimum}, {maximum}].",
    )]


def _finite_series_issues(
    values: Sequence[Any],
    name: str,
    code: str,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for index, value in enumerate(values):
        number = _as_number(value)
        if not _is_finite_number(number):
            issues.append(_fatal(
                code,
                f"{name} contains NaN or infinity.",
                f"Received {name}[{index}]={value!r}",
                f"Ensure all {name} values are finite numbers.",
            ))
    return issues


def _probability_series_issues(
    values: Sequence[Any],
    name: str,
    code: str,
    tolerance: float,
) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for index, value in enumerate(values):
        number = _as_number(value)
        if not _is_finite_number(number):
            continue
        if number < -tolerance or number > 1.0 + tolerance:
            issues.append(_error(
                code,
                f"{name} values must stay within [0.0, 1.0].",
                f"Received {name}[{index}]={value!r}",
                f"Check the simulation path that produced {name}.",
            ))
    return issues


def _is_qubit_index_in_range(index: Any, logical_qubits: int) -> bool:
    number = _as_number(index)
    return (
        _is_finite_number(number)
        and int(number) == number
        and 0 <= int(number) < logical_qubits
    )


def _as_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return math.nan


def _is_finite_number(value: float) -> bool:
    return math.isfinite(value)


def _error(
    code: str,
    message: str,
    detail: str | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue("error", code, message, detail, suggestion)


def _fatal(
    code: str,
    message: str,
    detail: str | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue("fatal", code, message, detail, suggestion)


def _warning(
    code: str,
    message: str,
    detail: str | None = None,
    suggestion: str | None = None,
) -> ValidationIssue:
    return ValidationIssue("warning", code, message, detail, suggestion)
