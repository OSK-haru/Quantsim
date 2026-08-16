"""Bounded API service for scheduled 2-4 transmon pulse networks."""

from __future__ import annotations

import math
from time import perf_counter

from api.pulse_models import (
    CoupledTransmonNetworkPulseSimulateRequest,
    CoupledTransmonNetworkPulseSimulateResponse,
    QutritPulseEnvelopeRequest,
)
from core.gates import Matrix
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    PulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_evolution import (
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
from core.pulse_transmon_network import (
    CoupledTransmonNetworkHamiltonian,
    ScheduledTransmonDrive,
    TransmonExchangeCoupling,
    computational_basis_labels,
    network_basis_labels,
    network_collapse_operators,
    network_initial_density_matrix,
    network_joint_populations,
    network_leakage_probability,
)
from core.results import EnvironmentConfig


NETWORK_CONTRACT_VERSION = "pulse-transmon-network-v1"
# A dimension-aware proxy for dense RK4 work.  This equals roughly 41,000
# two-transmon steps, 1,500 three-transmon steps, or 56 four-transmon steps.
NETWORK_MAX_DENSE_WORK_UNITS = 30_000_000
NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS = 250_000


def run_coupled_transmon_network_request(
    request: CoupledTransmonNetworkPulseSimulateRequest,
) -> dict[str, object]:
    from api.pulse_service import PulseExecutionLimitError

    started = perf_counter()
    count = request.transmon_count
    dimension = 3 ** count
    resolved_backend = resolve_time_dependent_backend(request.backend)
    envelopes = tuple(_build_envelope(item.pulse) for item in request.drives)
    rates = _build_rates(request)
    alphas = tuple(
        transmon_anharmonicity_rad_per_us(value)
        for value in request.anharmonicities_mhz
    )
    detunings = tuple(float(value) for value in request.detunings_rad_per_us)
    scheduled_drives = tuple(
        ScheduledTransmonDrive(
            target=item.target,
            start_time_us=item.start_time_us,
            envelope=envelope,
            phase_rad=item.pulse.phase_rad,
            detuning_rad_per_us=item.pulse.detuning_rad_per_us,
            drag_beta_us=item.pulse.drag_beta_us,
        )
        for item, envelope in zip(request.drives, envelopes, strict=True)
    )
    couplings = tuple(
        TransmonExchangeCoupling(
            left=item.left,
            right=item.right,
            strength_rad_per_us=item.exchange_coupling_rad_per_us,
        )
        for item in request.couplings
    )

    boundary_times = [
        value
        for drive in scheduled_drives
        for value in (drive.start_time_us, drive.end_time_us)
    ]
    sample_times = _sample_times(
        request.total_simulation_time_us,
        request.snapshot_options.uniform_count,
        request.snapshot_options.custom_times_us,
        boundary_times,
    )
    response_elements = len(sample_times) * dimension * dimension
    if response_elements > NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS:
        raise PulseExecutionLimitError(
            "Transmon network response exceeds the density-matrix element "
            f"limit: estimated {response_elements}, maximum "
            f"{NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS}. Reduce snapshot count."
        )

    reference_policies = [
        recommended_qutrit_step_policy(
            envelope,
            abs(detunings[item.target]) + abs(item.pulse.detuning_rad_per_us),
            min(alphas),
            rates[item.target],
            request.total_simulation_time_us,
            maximum_internal_step_count=NETWORK_MAX_DENSE_WORK_UNITS,
            drag_beta_us=item.pulse.drag_beta_us,
        )
        for item, envelope in zip(request.drives, envelopes, strict=True)
    ]
    maximum_coupling = max(
        (coupling.strength_rad_per_us for coupling in couplings),
        default=0.0,
    )
    coupling_step_limit = (
        None if maximum_coupling == 0.0 else 0.02 / (4.0 * maximum_coupling)
    )
    integration_step = min(
        min(policy.selected_internal_step_cap_us for policy in reference_policies),
        coupling_step_limit or math.inf,
    )
    estimated_steps = _estimated_steps(sample_times, integration_step)
    work_units = estimated_steps * dimension ** 3
    maximum_steps_for_dimension = NETWORK_MAX_DENSE_WORK_UNITS // dimension ** 3
    if work_units > NETWORK_MAX_DENSE_WORK_UNITS:
        raise PulseExecutionLimitError(
            "Transmon network request exceeds the dimension-aware dense-work "
            f"limit: {estimated_steps} steps at Hilbert dimension {dimension} "
            f"({work_units} units), maximum {NETWORK_MAX_DENSE_WORK_UNITS}."
        )

    hamiltonian = CoupledTransmonNetworkHamiltonian(
        anharmonicities_rad_per_us=alphas,
        detunings_rad_per_us=detunings,
        couplings=couplings,
        drives=scheduled_drives,
    )
    initial = network_initial_density_matrix(request.initial_state, count)
    collapse_ops = network_collapse_operators(rates)
    evolution = evolve_time_dependent_segment(
        initial,
        hamiltonian,
        collapse_ops,
        request.total_simulation_time_us,
        integration_step,
        checkpoint_times_us=sample_times,
        backend=resolved_backend,
    )

    trajectory = [
        _trajectory_point(point.time_us, point, request, scheduled_drives)
        for point in evolution.checkpoints
    ]
    latest_drive_end = max(drive.end_time_us for drive in scheduled_drives)
    pulse_end = min(
        trajectory,
        key=lambda point: abs(float(point["time_us"]) - latest_drive_end),
    )
    final = trajectory[-1]
    response = {
        "contract_version": NETWORK_CONTRACT_VERSION,
        "model": {
            "model_id": request.model_id,
            "description": (
                f"scheduled coupled {count}-transmon rotating-frame RWA network"
            ),
            "logical_qubits": count,
            "local_levels": 3,
            "hilbert_dimension": dimension,
            "density_matrix_dimension": dimension,
            "basis_order": list(network_basis_labels(count)),
            "subsystem_dimensions": [3] * count,
            "frame": "local rotating frames",
            "approximation": "RWA",
            "hardware_calibrated": False,
            "experimental": True,
        },
        "input": {
            "initial_state": request.initial_state,
            "transmon_count": count,
            "frequencies_ghz": request.frequencies_ghz,
            "anharmonicities_mhz": request.anharmonicities_mhz,
            "detunings_rad_per_us": request.detunings_rad_per_us,
            "couplings": [item.model_dump() for item in request.couplings],
            "drives": [item.model_dump() for item in request.drives],
            "drive_count": len(request.drives),
            "total_simulation_time_us": request.total_simulation_time_us,
            "sample_count": len(trajectory),
        },
        "rates": [rate.to_dict() for rate in rates],
        "step_policy": {
            "policy_id": "coupled_transmon_network_dense_work_v1",
            "selected_internal_step_cap_us": integration_step,
            "single_qutrit_step_cap_us": min(
                policy.selected_internal_step_cap_us
                for policy in reference_policies
            ),
            "coupling_step_limit_us": coupling_step_limit,
            "estimated_internal_step_count": estimated_steps,
            "maximum_internal_step_count_for_dimension": maximum_steps_for_dimension,
            "estimated_dense_work_units": work_units,
            "maximum_dense_work_units": NETWORK_MAX_DENSE_WORK_UNITS,
            "estimated_response_matrix_elements": response_elements,
            "maximum_response_matrix_elements": NETWORK_MAX_RESPONSE_MATRIX_ELEMENTS,
            "within_work_budget": True,
        },
        "sample_times_us": [point["time_us"] for point in trajectory],
        "trajectory": trajectory,
        "leakage": {
            "maximum_recorded_leakage_probability": max(
                float(point["leakage_probability"]) for point in trajectory
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
                "method_id": "coupled_transmon_network_fixed_step_rk4_v1",
                "cptp_guaranteed_by_construction": False,
                "cleanup_applied": True,
                "open_pulse_audit": None,
                "open_idle_audit": None,
            },
            "open_pulse": evolution.diagnostics.to_dict(),
            "open_idle": None,
            "hamiltonian": {
                "local_model": "Duffing qutrit truncation",
                "coupling_model": "sum J_ij(a_i^dagger a_j + a_i a_j^dagger)",
                "drive_model": "independently scheduled local rotating-frame I/Q envelopes",
                "pulse_detuning_model": "phase ramp in each local rotating frame",
            },
        },
        "warnings": [
            "Experimental educational transmon-network model; not calibrated hardware.",
            "Dense-matrix cost grows as 3^(3N) per RK4 matrix multiplication proxy.",
        ],
        "limitations": [
            "Two to four transmons with three local levels each.",
            "Exchange coupling and local rotating-wave approximation only.",
            "Fixed-step RK4 with density-matrix cleanup; explicit CPTP is unavailable for networks.",
            "No crosstalk, transfer function, tunable-coupler dynamics, or calibration model.",
        ],
    }
    return CoupledTransmonNetworkPulseSimulateResponse.model_validate(
        response
    ).model_dump()


def _trajectory_point(
    time_us: float,
    point: TimeDependentCheckpoint,
    request: CoupledTransmonNetworkPulseSimulateRequest,
    drives: tuple[ScheduledTransmonDrive, ...],
) -> dict[str, object]:
    state = point.cleaned_state
    count = request.transmon_count
    populations = network_joint_populations(state, count)
    metrics = physicality_metrics(state)
    segment = "pulse" if any(
        drive.start_time_us - 1e-14 <= time_us <= drive.end_time_us + 1e-14
        for drive in drives
    ) else "idle"
    return {
        "time_us": time_us,
        "segment": segment,
        "joint_populations": populations,
        "computational_population": sum(
            populations[label] for label in computational_basis_labels(count)
        ),
        "leakage_probability": network_leakage_probability(state, count),
        "population_sum_error": abs(sum(populations.values()) - 1.0),
        "purity": float(sum(
            abs(value) ** 2 for row in state for value in row
        )),
        "density_matrix": _matrix_response(state),
        "raw_physicality": _physicality_response(point.raw_physicality),
        "cleaned_physicality": _physicality_response(metrics),
        "cleanup_correction_norm": point.cleanup_correction_norm,
    }


def _build_envelope(pulse: QutritPulseEnvelopeRequest) -> PulseEnvelope:
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


def _build_rates(
    request: CoupledTransmonNetworkPulseSimulateRequest,
) -> tuple[QutritDissipationRates, ...]:
    environment = request.environment
    if environment.input_mode == "direct_rates":
        return tuple(
            qutrit_dissipation_rates(environment, anharmonicity)
            for anharmonicity in request.anharmonicities_mhz
        )
    return tuple(
        qutrit_dissipation_rates(
            EnvironmentConfig(
                input_mode="physical",
                device_quality=environment.device_quality,
                temperature_mk=environment.temperature_mk,
                flux_noise_phi0=environment.flux_noise_phi0,
                qubit_frequency_ghz=frequency,
                t1_max_us=environment.t1_max_us,
                tphi_max_us=environment.tphi_max_us,
                ideal_reference=environment.ideal_reference,
            ),
            anharmonicity,
        )
        for frequency, anharmonicity in zip(
            request.frequencies_ghz,
            request.anharmonicities_mhz,
            strict=True,
        )
    )


def _sample_times(
    total: float,
    count: int,
    custom: list[float],
    boundaries: list[float],
) -> list[float]:
    values = {0.0, float(total), *map(float, custom), *map(float, boundaries)}
    if count >= 2:
        values.update(total * index / (count - 1) for index in range(count))
    ordered = sorted(values)
    normalized: list[float] = []
    for value in ordered:
        if normalized and abs(value - normalized[-1]) <= 1e-14:
            continue
        normalized.append(value)
    return normalized


def _estimated_steps(boundaries: list[float], max_step: float) -> int:
    total = 0
    previous = 0.0
    for boundary in boundaries:
        interval = boundary - previous
        if interval > 1e-15:
            total += math.ceil(interval / max_step)
        previous = boundary
    return total


def _physicality_response(metrics) -> dict[str, float]:
    return {
        "trace_error": metrics.trace_error,
        "hermiticity_error": metrics.hermiticity_error,
        "minimum_eigenvalue": metrics.minimum_eigenvalue,
    }


def _matrix_response(matrix: Matrix) -> list[list[dict[str, float]]]:
    return [[
        {"real": float(value.real), "imag": float(value.imag)}
        for value in row
    ] for row in matrix]
