"""Stable core simulation entry point."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from core.capabilities import (
    DEFAULT_SIMULATION_MODEL,
    GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL,
    GATE_AWARE_SPLIT_STEP_MODEL,
    POST_CIRCUIT_DEGRADATION_MODEL,
)
from core.complexity import complexity_diagnostics
from core.errors import ValidationIssue
from core.gates import (
    CachedCollapseOperator,
    Matrix,
    apply_unitary_to_density,
    clean_density_matrix,
    column_duration_us,
    effective_hamiltonian_from_involution,
    gate_unitary,
    identity_matrix,
    initial_density_matrix,
    matmul,
    multi_qubit_environment_collapse_operators,
    output_probabilities,
    prepare_collapse_operators,
    rk4_step_cached,
    trace,
    zero_hamiltonian,
)
from core.metrics import effective_time
from core.physical_environment import (
    SUPPORTED_ENVIRONMENT_MODELS,
    UNIFIED_ENVIRONMENT_MODEL,
    compute_environment_rates,
    environment_rates_to_derived_parameters,
)
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


MAX_RK4_RATE_STEP_PRODUCT = 1.0
MAX_GENERATOR_STEP_PRODUCT = 1.0
PYTHON_DENSE_BACKEND_NAME = "python_dense_streaming_v1"


@dataclass
class _SimulationSeries:
    times: list[float]
    fidelity: list[float]
    purity: list[float]
    final_noisy_state: Matrix
    final_ideal_state: Matrix
    metadata: dict[str, object]


@dataclass
class _SimulationCaches:
    gate_unitaries: dict[tuple[object, ...], Matrix]
    column_unitaries: dict[tuple[object, ...], Matrix]
    hamiltonians: dict[tuple[object, ...], Matrix]

    @classmethod
    def empty(cls) -> "_SimulationCaches":
        return cls(gate_unitaries={}, column_unitaries={}, hamiltonians={})


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
    if config.duration_us < _total_gate_duration_us(config):
        return _run_post_circuit_degradation(config)
    return _run_gate_aware_hamiltonian_lindblad(config)


def _run_gate_aware_hamiltonian_lindblad(config: SimulationConfig) -> SimulationResult:
    rates = compute_environment_rates(config.environment)
    collapse_ops = multi_qubit_environment_collapse_operators(
        config.circuit.logical_qubits,
        rates,
    )
    cached_collapse_ops = prepare_collapse_operators(collapse_ops)
    caches = _SimulationCaches.empty()
    derived_parameters = environment_rates_to_derived_parameters(rates)

    try:
        simulation = _simulate_circuit_gate_aware_hamiltonian(
            config=config,
            duration_us=config.duration_us,
            time_steps=config.time_steps,
            collapse_ops=cached_collapse_ops,
            max_environment_rate_per_us=_max_environment_rate_per_us(rates),
            caches=caches,
        )
    except ValueError as exc:
        return _empty_result(config, [
            _runtime_error(
                "GATE_AWARE_HAMILTONIAN_UNSUPPORTED",
                "Gate-aware effective Hamiltonian simulation could not run this circuit.",
                str(exc),
                (
                    "Use non-overlapping involutory gates per column or run "
                    f"the {POST_CIRCUIT_DEGRADATION_MODEL!r} comparison model."
                ),
            )
        ])
    times = simulation.times
    fidelities = simulation.fidelity
    purities = simulation.purity
    simulation_metadata = simulation.metadata
    derived_parameters.update(simulation_metadata)
    effective_operation_time_us = effective_time(
        times,
        fidelities,
        config.fidelity_threshold,
    )

    diagnostics = _diagnostics(
        times=times,
        fidelities=fidelities,
        purities=purities,
        fidelity_threshold=config.fidelity_threshold,
        integration_substeps=simulation_metadata["integration_substeps"],
        max_trace_error=simulation_metadata["max_trace_error"],
        extra={
            "backend_name": PYTHON_DENSE_BACKEND_NAME,
            "simulation_mode": simulation_metadata["simulation_mode"],
            "hamiltonian_mode": simulation_metadata["hamiltonian_mode"],
            "completion_time_us": simulation_metadata["completion_time_us"],
            "completion_fidelity": simulation_metadata["completion_fidelity"],
            "completion_purity": simulation_metadata["completion_purity"],
            "configured_duration_us": config.duration_us,
            "total_gate_duration_us": simulation_metadata["total_gate_duration_us"],
            "idle_duration_us": simulation_metadata["idle_duration_us"],
            "actual_duration_us": simulation_metadata["actual_duration_us"],
            "gate_duration_model": simulation_metadata["gate_duration_model"],
            "gate_aware_noise": 1.0,
            "post_circuit_degradation": 0.0,
            "recorded_state_count": float(len(times)),
            "state_history_retained": 0.0,
            "state_history_storage_mode": "streaming_metrics_only",
        },
    )
    diagnostics.update(complexity_diagnostics(
        config,
        diagnostics=diagnostics,
        derived_parameters=derived_parameters,
    ))

    result = SimulationResult(
        config=config,
        times=times,
        fidelity=fidelities,
        purity=purities,
        effective_operation_time_us=effective_operation_time_us,
        output_probabilities=output_probabilities(
            simulation.final_noisy_state,
            config.circuit.logical_qubits,
        ),
        derived_parameters=derived_parameters,
        diagnostics=diagnostics,
        warnings=[],
        issues=[],
    )
    return result


def _run_post_circuit_degradation(config: SimulationConfig) -> SimulationResult:
    rates = compute_environment_rates(config.environment)
    collapse_ops = multi_qubit_environment_collapse_operators(
        config.circuit.logical_qubits,
        rates,
    )
    cached_collapse_ops = prepare_collapse_operators(collapse_ops)
    caches = _SimulationCaches.empty()
    derived_parameters = environment_rates_to_derived_parameters(rates)
    derived_parameters.update({
        "backend_name": PYTHON_DENSE_BACKEND_NAME,
        "simulation_mode": POST_CIRCUIT_DEGRADATION_MODEL,
        "gate_aware_noise": False,
        "hamiltonian_mode": "none",
        "total_gate_duration_us": _total_gate_duration_us(config),
        "idle_duration_us": config.duration_us,
        "actual_duration_us": config.duration_us,
        "gate_duration_model": "default_gate_duration_us_with_params_override",
        "post_circuit_degradation": True,
    })

    simulation = _simulate_circuit_post_circuit(
        config=config,
        duration_us=config.duration_us,
        time_steps=config.time_steps,
        collapse_ops=cached_collapse_ops,
        max_environment_rate_per_us=_max_environment_rate_per_us(rates),
        caches=caches,
    )
    times = simulation.times
    fidelities = simulation.fidelity
    purities = simulation.purity
    effective_operation_time_us = effective_time(
        times,
        fidelities,
        config.fidelity_threshold,
    )

    diagnostics = _diagnostics(
        times=times,
        fidelities=fidelities,
        purities=purities,
        fidelity_threshold=config.fidelity_threshold,
        integration_substeps=_integration_substeps(
            config.duration_us,
            config.time_steps,
            _max_environment_rate_per_us(rates),
        ),
        max_trace_error=simulation.metadata["max_trace_error"],
        extra={
            "backend_name": PYTHON_DENSE_BACKEND_NAME,
            "simulation_mode": derived_parameters["simulation_mode"],
            "hamiltonian_mode": derived_parameters["hamiltonian_mode"],
            "completion_time_us": 0.0,
            "completion_fidelity": fidelities[0],
            "completion_purity": purities[0],
            "configured_duration_us": config.duration_us,
            "total_gate_duration_us": derived_parameters["total_gate_duration_us"],
            "idle_duration_us": config.duration_us,
            "actual_duration_us": config.duration_us,
            "gate_duration_model": derived_parameters["gate_duration_model"],
            "gate_aware_noise": 0.0,
            "post_circuit_degradation": 1.0,
            "recorded_state_count": float(len(times)),
            "state_history_retained": 0.0,
            "state_history_storage_mode": "streaming_metrics_only",
        },
    )
    diagnostics.update(complexity_diagnostics(
        config,
        diagnostics=diagnostics,
        derived_parameters=derived_parameters,
    ))

    result = SimulationResult(
        config=config,
        times=times,
        fidelity=fidelities,
        purity=purities,
        effective_operation_time_us=effective_operation_time_us,
        output_probabilities=output_probabilities(
            simulation.final_noisy_state,
            config.circuit.logical_qubits,
        ),
        derived_parameters=derived_parameters,
        diagnostics=diagnostics,
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
    if config.environment.model not in SUPPORTED_ENVIRONMENT_MODELS:
        issues.append(_runtime_error(
            "UNSUPPORTED_ENVIRONMENT_MODEL",
            "The current simulator does not support this environment model.",
            f"Received model={config.environment.model!r}",
            f"Use {UNIFIED_ENVIRONMENT_MODEL!r}.",
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


def _simulate_circuit_post_circuit(
    config: SimulationConfig,
    duration_us: float,
    time_steps: int,
    collapse_ops: Sequence[CachedCollapseOperator],
    max_environment_rate_per_us: float = 0.0,
    caches: _SimulationCaches | None = None,
) -> _SimulationSeries:
    caches = caches or _SimulationCaches.empty()
    times = _time_grid(duration_us, time_steps)
    n_qubits = config.circuit.logical_qubits
    dimension = 2 ** n_qubits
    hamiltonian = zero_hamiltonian(dimension)

    initial_state = initial_density_matrix(config.circuit.initial_states)
    noisy_state = _apply_circuit_operations(initial_state, config, n_qubits, caches)
    ideal_state = _apply_circuit_operations(initial_state, config, n_qubits, caches)

    fidelities = [_state_fidelity(noisy_state, ideal_state)]
    purities = [_state_purity(noisy_state)]
    max_trace_error = _trace_error(noisy_state)
    for start_time, end_time in zip(times, times[1:]):
        dt = end_time - start_time
        noisy_state = _evolve_stable(
            noisy_state,
            hamiltonian,
            collapse_ops,
            dt,
            max_environment_rate_per_us,
        )
        fidelities.append(_state_fidelity(noisy_state, ideal_state))
        purities.append(_state_purity(noisy_state))
        max_trace_error = max(max_trace_error, _trace_error(noisy_state))

    return _SimulationSeries(
        times=times,
        fidelity=fidelities,
        purity=purities,
        final_noisy_state=noisy_state,
        final_ideal_state=ideal_state,
        metadata={
            "max_trace_error": max_trace_error,
            "state_history_retained": False,
            "state_history_storage_mode": "streaming_metrics_only",
        },
    )


def _simulate_circuit_gate_aware_hamiltonian(
    config: SimulationConfig,
    duration_us: float,
    time_steps: int,
    collapse_ops: Sequence[CachedCollapseOperator],
    max_environment_rate_per_us: float = 0.0,
    caches: _SimulationCaches | None = None,
) -> _SimulationSeries:
    caches = caches or _SimulationCaches.empty()
    n_qubits = config.circuit.logical_qubits
    segments = _gate_aware_segments(config, n_qubits, caches)
    total_gate_duration = sum(segment["duration_us"] for segment in segments)
    actual_duration = max(duration_us, total_gate_duration)
    idle_duration = max(0.0, actual_duration - total_gate_duration)
    times = _time_grid(actual_duration, time_steps)

    noisy_state = initial_density_matrix(config.circuit.initial_states)
    ideal_state = initial_density_matrix(config.circuit.initial_states)
    fidelities = [_state_fidelity(noisy_state, ideal_state)]
    purities = [_state_purity(noisy_state)]
    max_trace_error = _trace_error(noisy_state)

    current_time = 0.0
    segment_index = 0
    segment_elapsed = 0.0
    segment_start_noisy = noisy_state
    segment_start_ideal = ideal_state
    max_substeps = 1
    completion_time = 0.0 if not segments else None
    completion_noisy_state = noisy_state if not segments else None
    completion_ideal_state = ideal_state if not segments else None

    for target_time in times[1:]:
        while current_time < target_time - 1e-15:
            while (
                segment_index < len(segments)
                and segments[segment_index]["duration_us"] == 0.0
            ):
                unitary = segments[segment_index]["unitary"]
                noisy_state = clean_density_matrix(
                    apply_unitary_to_density(noisy_state, unitary)
                )
                ideal_state = clean_density_matrix(
                    apply_unitary_to_density(ideal_state, unitary)
                )
                segment_index += 1
                segment_elapsed = 0.0
                segment_start_noisy = noisy_state
                segment_start_ideal = ideal_state
                if segment_index >= len(segments) and completion_time is None:
                    completion_time = current_time
                    completion_noisy_state = noisy_state
                    completion_ideal_state = ideal_state

            if segment_index >= len(segments):
                step_dt = target_time - current_time
                if step_dt > 0.0:
                    substeps = _substep_count(step_dt, max_environment_rate_per_us)
                    max_substeps = max(max_substeps, substeps)
                    noisy_state = _evolve_stable_with_substeps(
                        noisy_state,
                        zero_hamiltonian(len(noisy_state)),
                        collapse_ops,
                        step_dt,
                        substeps,
                    )
                    current_time = target_time
                continue

            segment = segments[segment_index]
            duration = segment["duration_us"]
            remaining = duration - segment_elapsed
            step_dt = min(target_time - current_time, remaining)
            completes_segment = abs(step_dt - remaining) <= 1e-15

            if segment_elapsed == 0.0:
                segment_start_noisy = noisy_state
                segment_start_ideal = ideal_state

            unitary = segment["unitary"]
            hamiltonian = segment["hamiltonian"]
            hamiltonian_scale = segment["hamiltonian_scale_per_us"]
            if step_dt > 0.0:
                substeps = _generator_substep_count(
                    step_dt,
                    max_environment_rate_per_us + hamiltonian_scale,
                )
                max_substeps = max(max_substeps, substeps)
                if collapse_ops or not completes_segment:
                    noisy_state = _evolve_stable_with_substeps(
                        noisy_state,
                        hamiltonian,
                        collapse_ops,
                        step_dt,
                        substeps,
                    )
                else:
                    noisy_state = clean_density_matrix(
                        apply_unitary_to_density(segment_start_noisy, unitary)
                    )

                if completes_segment:
                    ideal_state = clean_density_matrix(
                        apply_unitary_to_density(segment_start_ideal, unitary)
                    )
                else:
                    ideal_state = _evolve_stable_with_substeps(
                        ideal_state,
                        hamiltonian,
                        [],
                        step_dt,
                        substeps,
                    )

            current_time += step_dt
            segment_elapsed += step_dt
            if completes_segment:
                segment_index += 1
                segment_elapsed = 0.0
                segment_start_noisy = noisy_state
                segment_start_ideal = ideal_state
                if segment_index >= len(segments) and completion_time is None:
                    completion_time = current_time
                    completion_noisy_state = noisy_state
                    completion_ideal_state = ideal_state

        while (
            segment_index < len(segments)
            and segments[segment_index]["duration_us"] == 0.0
        ):
            unitary = segments[segment_index]["unitary"]
            noisy_state = clean_density_matrix(
                apply_unitary_to_density(noisy_state, unitary)
            )
            ideal_state = clean_density_matrix(
                apply_unitary_to_density(ideal_state, unitary)
            )
            segment_index += 1
            segment_elapsed = 0.0
            segment_start_noisy = noisy_state
            segment_start_ideal = ideal_state
            if segment_index >= len(segments) and completion_time is None:
                completion_time = current_time
                completion_noisy_state = noisy_state
                completion_ideal_state = ideal_state

        fidelities.append(_state_fidelity(noisy_state, ideal_state))
        purities.append(_state_purity(noisy_state))
        max_trace_error = max(max_trace_error, _trace_error(noisy_state))

    if completion_time is None:
        completion_time = current_time
        completion_noisy_state = noisy_state
        completion_ideal_state = ideal_state

    segment_complexity = _segment_complexity_metadata(
        segments,
        idle_duration,
        max_environment_rate_per_us,
    )
    metadata = {
        "backend_name": PYTHON_DENSE_BACKEND_NAME,
        "simulation_mode": GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL,
        "gate_aware_noise": True,
        "hamiltonian_mode": "effective_involution_generator",
        "completion_time_us": completion_time,
        "completion_fidelity": _state_fidelity(
            completion_noisy_state,
            completion_ideal_state,
        ),
        "completion_purity": _state_purity(completion_noisy_state),
        "total_gate_duration_us": total_gate_duration,
        "idle_duration_us": idle_duration,
        "actual_duration_us": actual_duration,
        "gate_duration_model": "default_gate_duration_us_with_params_override",
        "post_circuit_degradation": False,
        "integration_substeps": float(max_substeps),
        "max_trace_error": max_trace_error,
        "state_history_retained": False,
        "state_history_storage_mode": "streaming_metrics_only",
        **segment_complexity,
    }
    return _SimulationSeries(
        times=times,
        fidelity=fidelities,
        purity=purities,
        final_noisy_state=noisy_state,
        final_ideal_state=ideal_state,
        metadata=metadata,
    )


def _gate_aware_segments(
    config: SimulationConfig,
    n_qubits: int,
    caches: _SimulationCaches | None = None,
) -> list[dict[str, object]]:
    caches = caches or _SimulationCaches.empty()
    segments: list[dict[str, object]] = []
    for column in sorted(config.circuit.columns, key=lambda column: column.step):
        unitary = _column_unitary_cached(column, n_qubits, caches)
        duration = column_duration_us(column)
        if duration == 0.0:
            hamiltonian = zero_hamiltonian(2 ** n_qubits)
        else:
            hamiltonian = _effective_hamiltonian_cached(unitary, duration, caches)
            hamiltonian_scale = 2.0 * math.pi / duration
        segments.append({
            "segment_type": "gate",
            "unitary": unitary,
            "duration_us": duration,
            "hamiltonian": hamiltonian,
            "hamiltonian_scale_per_us": hamiltonian_scale if duration > 0.0 else 0.0,
        })
    return segments


def _segment_complexity_metadata(
    segments: list[dict[str, object]],
    idle_duration_us: float,
    environment_rate_per_us: float,
) -> dict[str, float]:
    gate_segment_count = 0
    idle_segment_count = 1 if idle_duration_us > 0.0 else 0
    gate_substeps = 0
    idle_substeps = 0
    max_hamiltonian_scale = 0.0
    max_generator_scale = 0.0

    for segment in segments:
        duration = float(segment["duration_us"])
        if duration <= 0.0:
            continue
        gate_segment_count += 1
        hamiltonian_scale = float(segment["hamiltonian_scale_per_us"])
        generator_scale = environment_rate_per_us + hamiltonian_scale
        substeps = _generator_substep_count(duration, generator_scale)
        gate_substeps += substeps
        max_hamiltonian_scale = max(max_hamiltonian_scale, hamiltonian_scale)
        max_generator_scale = max(max_generator_scale, generator_scale)

    if idle_duration_us > 0.0:
        idle_substeps = _generator_substep_count(idle_duration_us, environment_rate_per_us)
        max_generator_scale = max(max_generator_scale, environment_rate_per_us)

    total_substeps = gate_substeps + idle_substeps
    return {
        "gate_segment_count": float(gate_segment_count),
        "idle_segment_count": float(idle_segment_count),
        "total_segment_count": float(gate_segment_count + idle_segment_count),
        "total_rk4_substeps": float(total_substeps),
        "total_rhs_evaluations": float(4 * total_substeps),
        "gate_rk4_substeps": float(gate_substeps),
        "idle_rk4_substeps": float(idle_substeps),
        "max_hamiltonian_scale_per_us": float(max_hamiltonian_scale),
        "max_environment_rate_per_us": float(environment_rate_per_us),
        "max_generator_scale_per_us": float(max_generator_scale),
    }


def _total_gate_duration_us(config: SimulationConfig) -> float:
    return sum(column_duration_us(column) for column in config.circuit.columns)


def _time_grid(duration_us: float, step_count: int) -> list[float]:
    if duration_us <= 0.0:
        raise ValueError("duration_us must be positive")
    if step_count < 2:
        raise ValueError("step_count must be at least 2")
    return [
        duration_us * step_index / (step_count - 1)
        for step_index in range(step_count)
    ]


def _apply_circuit_operations(
    state: Matrix,
    config: SimulationConfig,
    n_qubits: int,
    caches: _SimulationCaches | None = None,
) -> Matrix:
    caches = caches or _SimulationCaches.empty()
    for column in sorted(config.circuit.columns, key=lambda column: column.step):
        for gate in column.gates:
            state = apply_unitary_to_density(
                state,
                _gate_unitary_cached(gate, n_qubits, caches),
            )
            state = clean_density_matrix(state)
    return state


def _gate_unitary_cached(
    gate,
    n_qubits: int,
    caches: _SimulationCaches,
) -> Matrix:
    key = _gate_unitary_cache_key(gate, n_qubits)
    if key not in caches.gate_unitaries:
        caches.gate_unitaries[key] = gate_unitary(gate, n_qubits)
    return caches.gate_unitaries[key]


def _column_unitary_cached(
    column,
    n_qubits: int,
    caches: _SimulationCaches,
) -> Matrix:
    key = _column_unitary_cache_key(column, n_qubits)
    if key not in caches.column_unitaries:
        unitary = identity_matrix(2 ** n_qubits)
        for gate in column.gates:
            unitary = matmul(_gate_unitary_cached(gate, n_qubits, caches), unitary)
        caches.column_unitaries[key] = unitary
    return caches.column_unitaries[key]


def _effective_hamiltonian_cached(
    unitary: Matrix,
    duration_us: float,
    caches: _SimulationCaches,
) -> Matrix:
    key = (float(duration_us), unitary)
    if key not in caches.hamiltonians:
        caches.hamiltonians[key] = effective_hamiltonian_from_involution(
            unitary,
            duration_us,
        )
    return caches.hamiltonians[key]


def _gate_unitary_cache_key(gate, n_qubits: int) -> tuple[object, ...]:
    return (
        int(n_qubits),
        str(gate.type).upper(),
        tuple(int(target) for target in gate.targets),
        tuple(int(control) for control in (gate.controls or [])),
    )


def _column_unitary_cache_key(column, n_qubits: int) -> tuple[object, ...]:
    return (
        int(n_qubits),
        tuple(_gate_unitary_cache_key(gate, n_qubits) for gate in column.gates),
    )


def _fidelity_series(states: Sequence[Matrix], ideal_states: Sequence[Matrix]) -> list[float]:
    if len(states) != len(ideal_states):
        raise ValueError("states and ideal_states must have the same length")
    return [
        _state_fidelity(state, ideal_state)
        for state, ideal_state in zip(states, ideal_states)
    ]


def _purity_series(states: Sequence[Matrix]) -> list[float]:
    return [
        _state_purity(state)
        for state in states
    ]


def _state_fidelity(state: Matrix, ideal_state: Matrix) -> float:
    return _as_probability(trace(matmul(state, ideal_state)).real)


def _state_purity(state: Matrix) -> float:
    return _as_probability(trace(matmul(state, state)).real)


def _diagnostics(
    times: Sequence[float],
    fidelities: Sequence[float],
    purities: Sequence[float],
    fidelity_threshold: float,
    integration_substeps: int = 1,
    max_trace_error: float = 0.0,
    extra: Mapping[str, object] | None = None,
) -> dict[str, object]:
    diagnostics = {
        "final_time_us": times[-1],
        "final_fidelity": fidelities[-1],
        "final_purity": purities[-1],
        "min_fidelity": min(fidelities),
        "min_purity": min(purities),
        "time_step_us": times[1] - times[0] if len(times) > 1 else 0.0,
        "threshold_crossed": 1.0 if min(fidelities) < fidelity_threshold else 0.0,
        "max_trace_error": float(max_trace_error),
        "integration_substeps": float(integration_substeps),
    }
    diagnostics.update(dict(extra or {}))
    return diagnostics


def _evolve_stable(
    state: Matrix,
    hamiltonian: Matrix,
    collapse_ops: Sequence[CachedCollapseOperator],
    dt: float,
    max_environment_rate_per_us: float,
) -> Matrix:
    substeps = _substep_count(dt, max_environment_rate_per_us)
    sub_dt = dt / substeps
    evolved = state
    for _ in range(substeps):
        evolved = clean_density_matrix(
            rk4_step_cached(evolved, hamiltonian, collapse_ops, sub_dt)
        )
    return evolved


def _evolve_stable_with_substeps(
    state: Matrix,
    hamiltonian: Matrix,
    collapse_ops: Sequence[CachedCollapseOperator],
    dt: float,
    substeps: int,
) -> Matrix:
    substeps = max(1, int(substeps))
    sub_dt = dt / substeps
    evolved = state
    for _ in range(substeps):
        evolved = clean_density_matrix(
            rk4_step_cached(evolved, hamiltonian, collapse_ops, sub_dt)
        )
    return evolved


def _integration_substeps(
    duration_us: float,
    time_steps: int,
    max_environment_rate_per_us: float,
) -> int:
    if time_steps < 2:
        return 1
    return _substep_count(duration_us / (time_steps - 1), max_environment_rate_per_us)


def _substep_count(dt: float, max_environment_rate_per_us: float) -> int:
    rate_step = abs(dt) * max(0.0, max_environment_rate_per_us)
    if rate_step <= MAX_RK4_RATE_STEP_PRODUCT:
        return 1
    return max(1, int(math.ceil(rate_step / MAX_RK4_RATE_STEP_PRODUCT)))


def _generator_substep_count(dt: float, generator_scale_per_us: float) -> int:
    rate_step = abs(dt) * max(0.0, generator_scale_per_us)
    if rate_step <= MAX_GENERATOR_STEP_PRODUCT:
        return 1
    return max(1, int(math.ceil(rate_step / MAX_GENERATOR_STEP_PRODUCT)))


def _max_environment_rate_per_us(rates) -> float:
    return (
        abs(float(rates.gamma_down_per_us))
        + abs(float(rates.gamma_up_per_us))
        + abs(float(rates.gamma_phi_per_us))
    )


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
register_simulation_backend(
    GATE_AWARE_HAMILTONIAN_LINDBLAD_MODEL,
    _run_gate_aware_hamiltonian_lindblad,
)
register_simulation_backend(
    GATE_AWARE_SPLIT_STEP_MODEL,
    _run_gate_aware_hamiltonian_lindblad,
)
register_simulation_backend(
    POST_CIRCUIT_DEGRADATION_MODEL,
    _run_post_circuit_degradation,
)
