"""Stable core simulation entry point."""

from __future__ import annotations

from collections.abc import Mapping, Sequence

from core.capabilities import DEFAULT_SIMULATION_MODEL
from core.environment import map_environment_to_t1_t2, t1_t2_to_gammas
from core.evolution import _time_grid
from core.errors import ValidationIssue
from core.gates import (
    Matrix,
    apply_gate_operation,
    clean_density_matrix,
    initial_density_matrix,
    matmul,
    multi_qubit_collapse_operators,
    output_probabilities,
    rk4_step,
    trace,
    zero_hamiltonian,
)
from core.metrics import effective_time
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
        _runtime_issues(config)
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

    times, states, ideal_states = _simulate_circuit(
        config=config,
        duration_us=config.duration_us,
        time_steps=config.time_steps,
        gamma1=gamma1,
        gammaphi=gammaphi,
    )
    fidelities = _fidelity_series(states, ideal_states)
    purities = _purity_series(states)
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
        output_probabilities=output_probabilities(
            states[-1],
            config.circuit.logical_qubits,
        ),
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


def _runtime_issues(config: SimulationConfig) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    if config.model != DEFAULT_SIMULATION_MODEL:
        return issues
    if config.environment.mode != "normalized":
        issues.append(_runtime_error(
            "UNSUPPORTED_ENVIRONMENT_MODE",
            "The current simulator supports only normalized environment mode.",
            f"Received mode={config.environment.mode!r}",
            "Use mode='normalized' for this simulation backend.",
        ))
    if config.circuit.logical_qubits > 2:
        issues.append(_runtime_error(
            "UNSUPPORTED_QUBIT_COUNT",
            "The current simulator supports 1 or 2 logical qubits.",
            f"Received logical_qubits={config.circuit.logical_qubits}",
            "Use a circuit with 1 or 2 logical qubits.",
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


def _simulate_circuit(
    config: SimulationConfig,
    duration_us: float,
    time_steps: int,
    gamma1: float,
    gammaphi: float,
) -> tuple[list[float], list[Matrix], list[Matrix]]:
    times = _time_grid(duration_us, time_steps)
    n_qubits = config.circuit.logical_qubits
    dimension = 2 ** n_qubits
    hamiltonian = zero_hamiltonian(dimension)
    collapse_ops = multi_qubit_collapse_operators(n_qubits, gamma1, gammaphi)

    initial_state = initial_density_matrix(config.circuit.initial_states)
    noisy_state = _apply_circuit_operations(initial_state, config, n_qubits)
    ideal_state = _apply_circuit_operations(initial_state, config, n_qubits)

    states = [noisy_state]
    ideal_states = [ideal_state]
    for start_time, end_time in zip(times, times[1:]):
        dt = end_time - start_time
        next_state = rk4_step(states[-1], hamiltonian, collapse_ops, dt)
        states.append(clean_density_matrix(next_state))
        ideal_states.append(ideal_states[-1])

    return times, states, ideal_states


def _apply_circuit_operations(
    state: Matrix,
    config: SimulationConfig,
    n_qubits: int,
) -> Matrix:
    for column in sorted(config.circuit.columns, key=lambda column: column.step):
        for gate in column.gates:
            state = apply_gate_operation(state, gate, n_qubits)
            state = clean_density_matrix(state)
    return state


def _fidelity_series(states: Sequence[Matrix], ideal_states: Sequence[Matrix]) -> list[float]:
    if len(states) != len(ideal_states):
        raise ValueError("states and ideal_states must have the same length")
    return [
        _as_probability(trace(matmul(state, ideal_state)).real)
        for state, ideal_state in zip(states, ideal_states)
    ]


def _purity_series(states: Sequence[Matrix]) -> list[float]:
    return [
        _as_probability(trace(matmul(state, state)).real)
        for state in states
    ]


def _diagnostics(
    times: Sequence[float],
    states: Sequence[Matrix],
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


def _trace_error(state: Matrix) -> float:
    return abs(trace(state) - 1.0)


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
