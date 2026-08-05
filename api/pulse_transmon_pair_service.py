"""Bounded API service for the coupled two-transmon pulse model."""

from __future__ import annotations

import math
from copy import deepcopy
from time import perf_counter

from api.pulse_models import (
    CoupledTransmonPairPulseSimulateRequest,
    CoupledTransmonPairPulseSimulateResponse,
    QutritPulseEnvelopeRequest,
)
from core.cptp_evolution import evolve_cptp_segment
from core.gates import Matrix, matmul, trace
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    PulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_evolution import (
    ConstantHamiltonian,
    TimeDependentCheckpoint,
    evolve_time_dependent_segment,
    physicality_metrics,
    resolve_time_dependent_backend,
)
from core.pulse_qutrit_contract import transmon_anharmonicity_rad_per_us
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    qutrit_dissipation_rates,
)
from core.pulse_step_policy import recommended_qutrit_step_policy
from core.pulse_transmon_pair import (
    PAIR_BASIS_LABELS,
    CoupledTransmonPairHamiltonian,
    pair_collapse_operator_matrices,
    pair_collapse_operators,
    pair_initial_density_matrix,
    pair_joint_populations,
    pair_leakage_probability,
)
from core.results import EnvironmentConfig
from core.quasi_static_noise import correlated_gaussian_detuning_pair_samples


PAIR_CONTRACT_VERSION = "pulse-coupled-pair-v1"
PAIR_MAX_INTERNAL_STEPS = 15_000
PAIR_CPTP_MAX_INTERVALS = 500


def run_coupled_transmon_pair_request(
    request: CoupledTransmonPairPulseSimulateRequest,
) -> dict[str, object]:
    sigmas = tuple(request.quasi_static_detuning_sigmas_rad_per_us)
    if sigmas == (0.0, 0.0):
        return _run_single_coupled_transmon_pair_request(request)

    started = perf_counter()
    samples = correlated_gaussian_detuning_pair_samples(
        sigmas,
        request.quasi_static_detuning_correlation,
        request.quasi_static_quadrature_order,
    )
    samples = tuple(sorted(
        samples,
        key=lambda item: max(
            abs(request.detunings_rad_per_us[index] + item[0][index])
            for index in range(2)
        ),
        reverse=True,
    ))
    responses: list[dict[str, object]] = []
    for index, (offsets, _) in enumerate(samples):
        sample_request = request.model_copy(update={
            "detunings_rad_per_us": [
                request.detunings_rad_per_us[subsystem] + offsets[subsystem]
                for subsystem in range(2)
            ],
            "quasi_static_detuning_sigmas_rad_per_us": [0.0, 0.0],
        })
        response = _run_single_coupled_transmon_pair_request(sample_request)
        responses.append(response)
        if index == 0:
            worst_steps = int(
                response["step_policy"]["estimated_internal_step_count"]
            )
            if worst_steps * len(samples) > PAIR_MAX_INTERNAL_STEPS:
                from api.pulse_service import PulseExecutionLimitError

                raise PulseExecutionLimitError(
                    "Pair quasi-static ensemble exceeds the work limit: "
                    f"conservative estimate {worst_steps * len(samples)}, "
                    f"maximum {PAIR_MAX_INTERNAL_STEPS}."
                )
    return _average_pair_ensemble_response(
        request,
        responses,
        samples,
        (perf_counter() - started) * 1000.0,
    )


def _run_single_coupled_transmon_pair_request(
    request: CoupledTransmonPairPulseSimulateRequest,
) -> dict[str, object]:
    from api.pulse_service import PulseExecutionLimitError

    started = perf_counter()
    envelope = _build_envelope(request)
    secondary_envelope = (
        _build_envelope_config(request.secondary_pulse)
        if request.secondary_pulse is not None else None
    )
    pulse_duration = max(
        envelope.duration_us,
        secondary_envelope.duration_us if secondary_envelope is not None else 0.0,
    )
    resolved_backend = resolve_time_dependent_backend(request.backend)
    rate = _build_rate(request)
    rates = (rate, rate)
    alphas = tuple(
        transmon_anharmonicity_rad_per_us(value)
        for value in request.anharmonicities_mhz
    )
    effective_detunings = [
        float(value) for value in request.detunings_rad_per_us
    ]
    effective_detunings[request.drive_target] += (
        request.pulse.detuning_rad_per_us
    )
    if request.secondary_pulse is not None:
        effective_detunings[1 - request.drive_target] += (
            request.secondary_pulse.detuning_rad_per_us
        )
    detunings = tuple(effective_detunings)
    sample_times = _sample_times(
        request.total_simulation_time_us,
        pulse_duration,
        request.snapshot_options.uniform_count,
        request.snapshot_options.custom_times_us,
    )
    pulse_times, idle_times = _segment_sample_times(
        sample_times,
        pulse_duration,
        request.total_simulation_time_us,
    )
    policy_inputs = [(envelope, request.pulse.drag_beta_us)]
    if secondary_envelope is not None and request.secondary_pulse is not None:
        policy_inputs.append((secondary_envelope, request.secondary_pulse.drag_beta_us))
    reference_policies = [
        recommended_qutrit_step_policy(
            drive_envelope,
            max(detunings, key=abs),
            min(alphas),
            rate,
            request.total_simulation_time_us,
            maximum_internal_step_count=PAIR_MAX_INTERNAL_STEPS,
            drag_beta_us=drag_beta,
        )
        for drive_envelope, drag_beta in policy_inputs
    ]
    coupling_step_limit = (
        None
        if request.exchange_coupling_rad_per_us == 0.0
        else 0.02 / (4.0 * request.exchange_coupling_rad_per_us)
    )
    max_step = min(
        min(policy.selected_internal_step_cap_us for policy in reference_policies),
        coupling_step_limit or math.inf,
    )
    integration_step = (
        min(max_step * 5.0, pulse_duration / 8.0)
        if request.evolution_method == "explicit_cptp"
        else max_step
    )
    estimated_steps = (
        _estimated_segment_steps(pulse_times, integration_step)
        + _estimated_segment_steps(idle_times, integration_step)
    )
    maximum_steps = (
        PAIR_CPTP_MAX_INTERVALS
        if request.evolution_method == "explicit_cptp"
        else PAIR_MAX_INTERNAL_STEPS
    )
    if estimated_steps > maximum_steps:
        raise PulseExecutionLimitError(
            "Coupled transmon pair request exceeds the internal-step limit: "
            f"estimated {estimated_steps}, maximum {maximum_steps}."
        )

    initial = pair_initial_density_matrix(request.initial_state)
    collapse_ops = pair_collapse_operators(rates)
    collapse_matrices = pair_collapse_operator_matrices(rates)
    hamiltonian = CoupledTransmonPairHamiltonian(
        envelope=envelope,
        anharmonicities_rad_per_us=alphas,
        detunings_rad_per_us=detunings,
        exchange_coupling_rad_per_us=request.exchange_coupling_rad_per_us,
        drive_target=request.drive_target,
        phase_rad=request.pulse.phase_rad,
        drag_beta_us=request.pulse.drag_beta_us,
        secondary_envelope=secondary_envelope,
        secondary_phase_rad=(
            request.secondary_pulse.phase_rad
            if request.secondary_pulse is not None else 0.0
        ),
        secondary_drag_beta_us=(
            request.secondary_pulse.drag_beta_us
            if request.secondary_pulse is not None else 0.0
        ),
    )
    if request.evolution_method == "explicit_cptp":
        pulse_cptp = evolve_cptp_segment(
            initial,
            hamiltonian,
            collapse_matrices,
            pulse_duration,
            integration_step,
            checkpoint_times_us=pulse_times,
            backend=resolved_backend,
        )
        pulse_result = pulse_cptp.evolution
        pulse_audit = pulse_cptp.audit
    else:
        pulse_result = evolve_time_dependent_segment(
            initial,
            hamiltonian,
            collapse_ops,
            pulse_duration,
            integration_step,
            checkpoint_times_us=pulse_times,
            backend=resolved_backend,
        )
        pulse_audit = None
    idle_duration = request.total_simulation_time_us - pulse_duration
    idle_result = None
    idle_audit = None
    if idle_duration > 0.0:
        zero_drive = CoupledTransmonPairHamiltonian(
            envelope=SquarePulseEnvelope(0.0, max(idle_duration, 1e-12)),
            anharmonicities_rad_per_us=alphas,
            detunings_rad_per_us=detunings,
            exchange_coupling_rad_per_us=request.exchange_coupling_rad_per_us,
            drive_target=request.drive_target,
        )
        if request.evolution_method == "explicit_cptp":
            idle_cptp = evolve_cptp_segment(
                pulse_result.state,
                ConstantHamiltonian(zero_drive.evaluate(0.0)),
                collapse_matrices,
                idle_duration,
                integration_step,
                checkpoint_times_us=idle_times,
                backend=resolved_backend,
            )
            idle_result = idle_cptp.evolution
            idle_audit = idle_cptp.audit
        else:
            idle_result = evolve_time_dependent_segment(
                pulse_result.state,
                ConstantHamiltonian(zero_drive.evaluate(0.0)),
                collapse_ops,
                idle_duration,
                integration_step,
                checkpoint_times_us=idle_times,
                backend=resolved_backend,
            )

    paired = [
        (point.time_us, "pulse", point)
        for point in pulse_result.checkpoints
    ]
    if idle_result is not None:
        paired.extend(
            (pulse_duration + point.time_us, "idle", point)
            for point in idle_result.checkpoints[1:]
        )
    trajectory = [
        _trajectory_point(time_us, segment, point)
        for time_us, segment, point in paired
    ]
    pulse_end = _trajectory_point(
        pulse_duration,
        "pulse",
        pulse_result.checkpoints[-1],
    )
    final = pulse_end if idle_result is None else _trajectory_point(
        request.total_simulation_time_us,
        "idle",
        idle_result.checkpoints[-1],
    )
    response = {
        "contract_version": PAIR_CONTRACT_VERSION,
        "model": {
            "model_id": request.model_id,
            "description": "coupled two-transmon rotating-frame RWA model",
            "logical_qubits": 2,
            "local_levels": 3,
            "hilbert_dimension": 9,
            "basis_order": list(PAIR_BASIS_LABELS),
            "subsystem_dimensions": [3, 3],
            "frame": "rotating",
            "approximation": "RWA",
            "hardware_calibrated": False,
            "experimental": True,
        },
        "input": {
            "initial_state": request.initial_state,
            "anharmonicities_mhz": request.anharmonicities_mhz,
            "detunings_rad_per_us": request.detunings_rad_per_us,
            "effective_detunings_rad_per_us": list(detunings),
            "exchange_coupling_rad_per_us": request.exchange_coupling_rad_per_us,
            "drive_target": request.drive_target,
            "shape": request.pulse.shape,
            "pulse_duration_us": pulse_duration,
            "simultaneous_drive_count": 2 if secondary_envelope is not None else 1,
            "secondary_pulse": (
                None if request.secondary_pulse is None
                else request.secondary_pulse.model_dump()
            ),
            "quasi_static_detuning_sigmas_rad_per_us": [0.0, 0.0],
            "total_simulation_time_us": request.total_simulation_time_us,
            "phase_rad": request.pulse.phase_rad,
            "drag_beta_us": request.pulse.drag_beta_us,
            "sample_count": len(trajectory),
        },
        "rates": [rate.to_dict(), rate.to_dict()],
        "step_policy": {
            "policy_id": (
                "coupled_pair_explicit_cptp_v1"
                if request.evolution_method == "explicit_cptp"
                else "coupled_pair_rk4_v1"
            ),
            "selected_internal_step_cap_us": integration_step,
            "single_qutrit_step_cap_us": (
                min(policy.selected_internal_step_cap_us for policy in reference_policies)
            ),
            "coupling_step_limit_us": coupling_step_limit,
            "estimated_internal_step_count": estimated_steps,
            "maximum_internal_step_count": maximum_steps,
            "within_work_budget": True,
        },
        "sample_times_us": [point["time_us"] for point in trajectory],
        "trajectory": trajectory,
        "leakage": {
            "maximum_recorded_leakage_probability": max(
                point["leakage_probability"] for point in trajectory
            ),
            "leakage_at_pulse_end": pulse_end["leakage_probability"],
            "leakage_at_final_time": final["leakage_probability"],
        },
        "pulse_end": pulse_end,
        "final": final,
        "diagnostics": {
            "api_runtime_ms": (perf_counter() - started) * 1000.0,
            "backend": {
                "requested": request.backend,
                "resolved": resolved_backend,
                "fallback_used": request.backend == "auto" and resolved_backend == "python",
            },
            "evolution": {
                "requested": request.evolution_method,
                "resolved": request.evolution_method,
                "method_id": (
                    "coupled_pair_explicit_cptp_midpoint_v1"
                    if request.evolution_method == "explicit_cptp"
                    else "coupled_pair_fixed_step_rk4_v1"
                ),
                "cleanup_applied": request.evolution_method == "fixed_step_rk4",
                "open_pulse_audit": (
                    None if pulse_audit is None else pulse_audit.to_dict()
                ),
                "open_idle_audit": (
                    None if idle_audit is None else idle_audit.to_dict()
                ),
            },
            "open_pulse": pulse_result.diagnostics.to_dict(),
            "open_idle": (
                None if idle_result is None else idle_result.diagnostics.to_dict()
            ),
            "hamiltonian": {
                "local_model": "Duffing qutrit truncation",
                "coupling_model": "J(a0^dagger a1 + a0 a1^dagger)",
                "drive_model": "one or two simultaneous local rotating-frame I/Q envelopes",
            },
        },
        "warnings": [
            "Experimental educational coupled-transmon model; not calibrated hardware.",
            "Both transmons currently share the same environment-rate profile.",
        ],
        "limitations": [
            "Exactly two transmons with three local levels each.",
            "Exchange coupling and rotating-wave approximation only.",
            "No crosstalk, transfer function, tunable coupler, or calibration model.",
        ],
    }
    return CoupledTransmonPairPulseSimulateResponse.model_validate(
        response
    ).model_dump()


def _average_pair_ensemble_response(
    request: CoupledTransmonPairPulseSimulateRequest,
    responses: list[dict[str, object]],
    samples: tuple[tuple[tuple[float, float], float], ...],
    runtime_ms: float,
) -> dict[str, object]:
    weights = [weight for _, weight in samples]
    averaged = deepcopy(responses[0])
    trajectories = [response["trajectory"] for response in responses]
    averaged["trajectory"] = [
        _average_pair_point(
            [trajectory[index] for trajectory in trajectories],
            weights,
        )
        for index in range(len(trajectories[0]))
    ]
    averaged["pulse_end"] = _average_pair_point(
        [response["pulse_end"] for response in responses],
        weights,
    )
    averaged["final"] = _average_pair_point(
        [response["final"] for response in responses],
        weights,
    )
    trajectory = averaged["trajectory"]
    averaged["leakage"] = {
        "maximum_recorded_leakage_probability": max(
            point["leakage_probability"] for point in trajectory
        ),
        "leakage_at_pulse_end": averaged["pulse_end"]["leakage_probability"],
        "leakage_at_final_time": averaged["final"]["leakage_probability"],
    }
    averaged["input"].update({
        "detunings_rad_per_us": request.detunings_rad_per_us,
        "quasi_static_detuning_sigmas_rad_per_us": (
            request.quasi_static_detuning_sigmas_rad_per_us
        ),
        "quasi_static_detuning_correlation": (
            request.quasi_static_detuning_correlation
        ),
        "quasi_static_quadrature_order": (
            request.quasi_static_quadrature_order
        ),
    })
    averaged["step_policy"]["estimated_internal_step_count"] = sum(
        int(response["step_policy"]["estimated_internal_step_count"])
        for response in responses
    )
    averaged["step_policy"]["maximum_internal_step_count"] = (
        PAIR_MAX_INTERNAL_STEPS
    )
    diagnostics = averaged["diagnostics"]
    diagnostics["api_runtime_ms"] = runtime_ms
    diagnostics["open_pulse"] = _aggregate_pair_evolution_diagnostics([
        response["diagnostics"]["open_pulse"] for response in responses
    ])
    idle_items = [
        response["diagnostics"]["open_idle"] for response in responses
        if response["diagnostics"]["open_idle"] is not None
    ]
    diagnostics["open_idle"] = (
        _aggregate_pair_evolution_diagnostics(idle_items)
        if idle_items else None
    )
    evolution = diagnostics["evolution"]
    evolution["open_pulse_audit"] = _aggregate_pair_cptp_audits([
        response["diagnostics"]["evolution"]["open_pulse_audit"]
        for response in responses
    ])
    evolution["open_idle_audit"] = _aggregate_pair_cptp_audits([
        response["diagnostics"]["evolution"]["open_idle_audit"]
        for response in responses
    ])
    diagnostics["quasi_static_noise"] = {
        "enabled": True,
        "model_id": "correlated_gaussian_pair_detuning_v1",
        "distribution": "delta ~ Normal(0, covariance)",
        "sigmas_rad_per_us": request.quasi_static_detuning_sigmas_rad_per_us,
        "correlation": request.quasi_static_detuning_correlation,
        "quadrature_method": "tensor-product Gauss-Hermite",
        "quadrature_order_per_axis": request.quasi_static_quadrature_order,
        "sample_count": len(samples),
        "samples": [
            {"offsets_rad_per_us": list(offsets), "weight": weight}
            for offsets, weight in samples
        ],
        "transformation": (
            "delta0=sigma0*z0; delta1=sigma1*(r*z0+sqrt(1-r^2)*z1)"
        ),
    }
    averaged["warnings"] = [
        *averaged["warnings"],
        "Correlated Gaussian quasi-static detuning is averaged over complete "
        "two-transmon trajectories.",
    ]
    return CoupledTransmonPairPulseSimulateResponse.model_validate(
        averaged
    ).model_dump()


def _average_pair_point(points, weights):
    averaged = deepcopy(points[0])
    state = _weighted_pair_density_matrix(
        [point["density_matrix"] for point in points],
        weights,
    )
    populations = pair_joint_populations(state)
    metrics = physicality_metrics(state)
    averaged.update({
        "joint_populations": populations,
        "computational_population": sum(
            populations[label] for label in ("00", "01", "10", "11")
        ),
        "leakage_probability": pair_leakage_probability(state),
        "population_sum_error": abs(sum(populations.values()) - 1.0),
        "purity": float(trace(matmul(state, state)).real),
        "density_matrix": _matrix_response(state),
        "raw_physicality": {
            "trace_error": max(
                point["raw_physicality"]["trace_error"] for point in points
            ),
            "hermiticity_error": max(
                point["raw_physicality"]["hermiticity_error"] for point in points
            ),
            "minimum_eigenvalue": min(
                point["raw_physicality"]["minimum_eigenvalue"] for point in points
            ),
        },
        "cleaned_physicality": _physicality_response(metrics),
        "cleanup_correction_norm": sum(
            weight * point["cleanup_correction_norm"]
            for point, weight in zip(points, weights, strict=True)
        ),
    })
    return averaged


def _weighted_pair_density_matrix(matrices, weights) -> Matrix:
    return tuple(
        tuple(
            sum(
                weight * complex(
                    matrix[row][column]["real"],
                    matrix[row][column]["imag"],
                )
                for matrix, weight in zip(matrices, weights, strict=True)
            )
            for column in range(9)
        )
        for row in range(9)
    )


def _aggregate_pair_evolution_diagnostics(items):
    result = deepcopy(items[0])
    for key in (
        "internal_step_count",
        "rhs_evaluation_count",
        "hamiltonian_evaluation_count",
    ):
        result[key] = sum(int(item[key]) for item in items)
    result["minimum_internal_step_us"] = min(
        item["minimum_internal_step_us"] for item in items
    )
    result["maximum_internal_step_us"] = max(
        item["maximum_internal_step_us"] for item in items
    )
    for key in (
        "raw_trace_error",
        "raw_hermiticity_error",
        "cleanup_correction_norm",
        "actual_duration_us",
    ):
        result[key] = max(item[key] for item in items)
    result["raw_minimum_eigenvalue"] = min(
        item["raw_minimum_eigenvalue"] for item in items
    )
    return result


def _aggregate_pair_cptp_audits(items):
    audits = [item for item in items if item is not None]
    if not audits:
        return None
    result = deepcopy(audits[0])
    result["map_count"] = sum(item["map_count"] for item in audits)
    result["interval_count"] = sum(item["interval_count"] for item in audits)
    result["minimum_choi_eigenvalue"] = min(
        item["minimum_choi_eigenvalue"] for item in audits
    )
    result["maximum_trace_preservation_frobenius_error"] = max(
        item["maximum_trace_preservation_frobenius_error"] for item in audits
    )
    result["maximum_trace_preservation_max_abs_error"] = max(
        item["maximum_trace_preservation_max_abs_error"] for item in audits
    )
    result["all_maps_cptp"] = all(item["all_maps_cptp"] for item in audits)
    return result


def _trajectory_point(
    time_us: float,
    segment: str,
    point: TimeDependentCheckpoint,
) -> dict[str, object]:
    state = point.cleaned_state
    populations = pair_joint_populations(state)
    metrics = physicality_metrics(state)
    return {
        "time_us": time_us,
        "segment": segment,
        "joint_populations": populations,
        "computational_population": sum(
            populations[label] for label in ("00", "01", "10", "11")
        ),
        "leakage_probability": pair_leakage_probability(state),
        "population_sum_error": abs(sum(populations.values()) - 1.0),
        "purity": float(trace(matmul(state, state)).real),
        "density_matrix": _matrix_response(state),
        "raw_physicality": _physicality_response(point.raw_physicality),
        "cleaned_physicality": _physicality_response(metrics),
        "cleanup_correction_norm": point.cleanup_correction_norm,
    }


def _build_envelope(request: CoupledTransmonPairPulseSimulateRequest) -> PulseEnvelope:
    return _build_envelope_config(request.pulse)


def _build_envelope_config(pulse: QutritPulseEnvelopeRequest) -> PulseEnvelope:
    if pulse.shape == "square":
        assert pulse.pulse_duration_us is not None
        if pulse.amplitude_mode == "target_rotation_angle":
            assert pulse.target_rotation_angle_rad is not None
            return SquarePulseEnvelope.from_target_rotation_angle(
                pulse.target_rotation_angle_rad,
                pulse.pulse_duration_us,
            )
        assert pulse.peak_amplitude_rad_per_us is not None
        return SquarePulseEnvelope(
            pulse.peak_amplitude_rad_per_us,
            pulse.pulse_duration_us,
        )
    assert pulse.sigma_us is not None
    assert pulse.truncation_sigma is not None
    if pulse.amplitude_mode == "target_rotation_angle":
        assert pulse.target_rotation_angle_rad is not None
        return GaussianPulseEnvelope.from_target_rotation_angle(
            pulse.target_rotation_angle_rad,
            pulse.sigma_us,
            pulse.truncation_sigma,
        )
    assert pulse.peak_amplitude_rad_per_us is not None
    return GaussianPulseEnvelope(
        pulse.peak_amplitude_rad_per_us,
        pulse.sigma_us,
        pulse.truncation_sigma,
    )


def _build_rate(
    request: CoupledTransmonPairPulseSimulateRequest,
) -> QutritDissipationRates:
    environment = request.environment
    if environment.input_mode == "direct_rates":
        return QutritDissipationRates(
            "direct_rates",
            environment.gamma_10_down_per_us,
            environment.gamma_01_up_per_us,
            environment.gamma_21_down_per_us,
            environment.gamma_12_up_per_us,
            environment.gamma_phi_adjacent_per_us,
        )
    return qutrit_dissipation_rates(
        EnvironmentConfig(
            input_mode="physical",
            device_quality=environment.device_quality,
            temperature_mk=environment.temperature_mk,
            flux_noise_phi0=environment.flux_noise_phi0,
            qubit_frequency_ghz=environment.qubit_frequency_ghz,
            t1_max_us=environment.t1_max_us,
            tphi_max_us=environment.tphi_max_us,
            ideal_reference=environment.ideal_reference,
        ),
        request.anharmonicities_mhz[0],
    )


def _sample_times(total: float, pulse: float, count: int, custom: list[float]) -> list[float]:
    values = {0.0, float(pulse), float(total), *map(float, custom)}
    if count >= 2:
        values.update(total * index / (count - 1) for index in range(count))
    ordered = sorted(values)
    normalized: list[float] = []
    for value in ordered:
        if normalized and abs(value - normalized[-1]) <= 1e-14:
            # Prefer exact segment boundaries over their floating-point-near
            # uniform-grid equivalents.  Otherwise clamping in
            # _segment_sample_times can create duplicate checkpoints.
            if abs(value - pulse) < abs(normalized[-1] - pulse):
                normalized[-1] = value
            continue
        normalized.append(value)
    return normalized


def _segment_sample_times(times, pulse, total):
    tolerance = 1e-14
    pulse_times = _strictly_increasing_times(
        min(value, pulse) for value in times if value <= pulse + tolerance
    )
    if total <= pulse:
        return pulse_times, ()
    idle = total - pulse
    idle_times = _strictly_increasing_times(
        min(idle, max(0.0, value - pulse))
        for value in times if value >= pulse - tolerance
    )
    return pulse_times, idle_times


def _strictly_increasing_times(values):
    result: list[float] = []
    for value in values:
        if not result or value - result[-1] > 1e-14:
            result.append(value)
    return tuple(result)


def _estimated_segment_steps(boundaries, max_step):
    total = 0
    previous = 0.0
    for boundary in boundaries:
        interval = boundary - previous
        if interval > 1e-15:
            total += math.ceil(interval / max_step)
        previous = boundary
    return total


def _physicality_response(metrics):
    return {
        "trace_error": metrics.trace_error,
        "hermiticity_error": metrics.hermiticity_error,
        "minimum_eigenvalue": metrics.minimum_eigenvalue,
    }


def _matrix_response(matrix: Matrix):
    return [[
        {"real": float(value.real), "imag": float(value.imag)}
        for value in row
    ] for row in matrix]
