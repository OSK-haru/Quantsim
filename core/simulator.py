"""Stable core simulation entry point for Phase 1."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from core.capabilities import DEFAULT_SIMULATION_MODEL, normalize_gate_type
from core.circuit import Matrix2, h_gate_hamiltonian, initial_zero_density_matrix
from core.environment import map_environment_to_t1_t2, t1_t2_to_gammas
from core.evolution import _clean_density_matrix, _collapse_operators, _rk4_step, _time_grid
from core.errors import ValidationIssue
from core.metrics import effective_time, fidelity_series, purity_series
from core.results import SimulationConfig, SimulationResult
from core.simulation_backends import (
    get_simulation_backend,
    register_simulation_backend,
    registered_simulation_models,
)
from core.validation import (
    diagnose_simulation_result,
    has_blocking_issues,
    validate_simulation_config,
)


def run_simulation(config: SimulationConfig) -> SimulationResult:
    """Run a simulation through the stable Config -> Result core contract."""

    if isinstance(config, Mapping):
        config = SimulationConfig.from_dict(config)
    if not isinstance(config, SimulationConfig):
        raise TypeError("config must be a SimulationConfig")

    config_issues = validate_simulation_config(config)
    runtime_issues = (
        _mvp_runtime_issues(config)
        if not has_blocking_issues(config_issues)
        else []
    )
    blocking_issues = [*config_issues, *runtime_issues]
    if has_blocking_issues(blocking_issues):
        return _empty_result(config, blocking_issues)

    runner = get_simulation_backend(config.model)
    if runner is None:
        return _empty_result(config, [
            _runtime_error(
                "BACKEND_NOT_REGISTERED",
                "No simulation backend is registered for this model.",
                f"Received model={config.model!r}",
                (
                    "Register a backend runner or use one of "
                    f"{registered_simulation_models()}."
                ),
            )
        ])

    result = runner(config)
    diagnostic_issues = diagnose_simulation_result(result)
    result.issues = diagnostic_issues
    result.warnings = _issue_warnings(diagnostic_issues)
    return result


def _run_weak_coupling_lindblad(config: SimulationConfig) -> SimulationResult:
    environment = config.environment
    t1_us, t2_us = map_environment_to_t1_t2(
        temperature_kelvin=environment.temperature_kelvin,
        magnetic_field_tesla=environment.magnetic_field_tesla,
        noise_level=environment.noise_level,
    )
    gamma1, gammaphi = t1_t2_to_gammas(t1_us, t2_us)

    times, states = _simulate_h_gate(
        duration_us=config.duration_us,
        time_steps=config.time_steps,
        gamma1=gamma1,
        gammaphi=gammaphi,
    )
    ideal_states = _ideal_h_gate_series(times, config.duration_us)
    fidelities = fidelity_series(states, ideal_states)
    purities = purity_series(states)
    effective_operation_time_us = effective_time(
        times,
        fidelities,
        config.fidelity_threshold,
    )

    result = SimulationResult(
        config=config,
        times=times,
        fidelity=fidelities,
        purity=purities,
        effective_operation_time_us=effective_operation_time_us,
        output_probabilities=_output_probabilities(states[-1]),
        derived_parameters={
            "t1_us": t1_us,
            "t2_us": t2_us,
            "gamma1_per_us": gamma1,
            "gamma_phi_per_us": gammaphi,
            "gammaphi_per_us": gammaphi,
        },
        diagnostics=_diagnostics(
            times=times,
            states=states,
            fidelities=fidelities,
            purities=purities,
            fidelity_threshold=config.fidelity_threshold,
        ),
        warnings=[],
        issues=[],
    )
    return result


def _empty_result(
    config: SimulationConfig,
    issues: list[ValidationIssue],
) -> SimulationResult:
    return SimulationResult(
        config=config,
        times=[],
        fidelity=[],
        purity=[],
        effective_operation_time_us=None,
        output_probabilities={},
        derived_parameters={},
        diagnostics={},
        warnings=_issue_warnings(issues),
        issues=issues,
    )


def _mvp_runtime_issues(config: SimulationConfig) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if config.model != DEFAULT_SIMULATION_MODEL:
        return issues
    if config.environment.mode != "normalized":
        issues.append(_runtime_error(
            "UNSUPPORTED_ENVIRONMENT_MODE_FOR_MVP",
            "MVP simulator currently supports only normalized environment mode.",
            f"Received mode={config.environment.mode!r}",
            "Use mode='normalized' for this simulation backend.",
        ))
    if config.circuit.logical_qubits != 1:
        issues.append(_runtime_error(
            "UNSUPPORTED_QUBIT_COUNT_FOR_MVP",
            "MVP simulator currently supports exactly 1 logical qubit.",
            f"Received logical_qubits={config.circuit.logical_qubits}",
            "Use a 1-qubit circuit for the current Lindblad MVP backend.",
        ))
    if config.circuit.initial_states != ["0"]:
        issues.append(_runtime_error(
            "UNSUPPORTED_INITIAL_STATE_FOR_MVP",
            "MVP simulator currently supports only initial state |0>.",
            f"Received initial_states={config.circuit.initial_states!r}",
            "Use initial_states=['0'] for the current backend.",
        ))

    gates = [
        gate
        for column in sorted(config.circuit.columns, key=lambda column: column.step)
        for gate in column.gates
    ]
    if len(gates) != 1:
        issues.append(_runtime_error(
            "UNSUPPORTED_GATE_COUNT_FOR_MVP",
            "MVP simulator currently supports exactly one gate.",
            f"Received gate_count={len(gates)}",
            "Use a single H gate for the current backend.",
        ))
        return issues

    gate = gates[0]
    if normalize_gate_type(gate.type) != "H":
        issues.append(_runtime_error(
            "UNSUPPORTED_GATE_FOR_MVP",
            "MVP simulator currently supports only an H gate.",
            f"Received gate type={gate.type!r}",
            "Use a single H gate for the current backend.",
        ))
    if gate.targets != [0]:
        issues.append(_runtime_error(
            "UNSUPPORTED_GATE_TARGET_FOR_MVP",
            "MVP H gate must target qubit 0.",
            f"Received targets={gate.targets!r}",
            "Set the H gate target to [0].",
        ))
    if gate.controls:
        issues.append(_runtime_error(
            "UNSUPPORTED_GATE_CONTROL_FOR_MVP",
            "MVP H gate must not have controls.",
            f"Received controls={gate.controls!r}",
            "Remove controls from the H gate.",
        ))
    if gate.params:
        issues.append(_runtime_error(
            "UNSUPPORTED_GATE_PARAMS_FOR_MVP",
            "MVP H gate must not have params.",
            f"Received params={gate.params!r}",
            "Remove params from the H gate.",
        ))
    return issues


def _runtime_error(
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


def _issue_warnings(issues: list[ValidationIssue]) -> list[str]:
    return [
        f"{issue.code}: {issue.message}"
        for issue in issues
        if issue.level in {"warning", "error", "fatal"}
    ]


def _simulate_h_gate(
    duration_us: float,
    time_steps: int,
    gamma1: float,
    gammaphi: float,
) -> tuple[list[float], list[Matrix2]]:
    times = _time_grid(duration_us, time_steps)
    hamiltonian = h_gate_hamiltonian(duration_us)
    collapse_ops = _collapse_operators(gamma1, gammaphi)

    states = [initial_zero_density_matrix()]
    for start_time, end_time in zip(times, times[1:]):
        dt = end_time - start_time
        next_state = _rk4_step(states[-1], hamiltonian, collapse_ops, dt)
        states.append(_clean_density_matrix(next_state))

    return times, states


def _ideal_h_gate_series(times: Sequence[float], duration_us: float) -> list[Matrix2]:
    if not times:
        return []

    hamiltonian = h_gate_hamiltonian(duration_us)
    states = [initial_zero_density_matrix()]

    for start_time, end_time in zip(times, times[1:]):
        if end_time <= start_time:
            raise ValueError("times must be strictly increasing")

        dt = end_time - start_time
        next_state = _rk4_step(states[-1], hamiltonian, [], dt)
        states.append(_clean_density_matrix(next_state))

    return states


def _output_probabilities(state: Matrix2) -> dict[str, float]:
    return {
        "0": _as_probability(state[0][0].real),
        "1": _as_probability(state[1][1].real),
    }


def _diagnostics(
    times: Sequence[float],
    states: Sequence[Matrix2],
    fidelities: Sequence[float],
    purities: Sequence[float],
    fidelity_threshold: float,
) -> dict[str, float]:
    return {
        "final_fidelity": fidelities[-1],
        "final_purity": purities[-1],
        "min_fidelity": min(fidelities),
        "min_purity": min(purities),
        "time_step_us": times[1] - times[0] if len(times) > 1 else 0.0,
        "threshold_crossed": 1.0 if min(fidelities) < fidelity_threshold else 0.0,
        "max_trace_error": max(_trace_error(state) for state in states),
    }


def _trace_error(state: Matrix2) -> float:
    trace = state[0][0] + state[1][1]
    return abs(trace - 1.0)


def _as_probability(value: float) -> float:
    if value < 0.0 and value > -1e-9:
        return 0.0
    if value > 1.0 and value < 1.0 + 1e-9:
        return 1.0
    return value


register_simulation_backend(
    DEFAULT_SIMULATION_MODEL,
    _run_weak_coupling_lindblad,
)
