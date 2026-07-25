"""Bounded API service for the validated experimental qutrit pulse path."""

from __future__ import annotations

import math
from time import perf_counter

from api.pulse_models import (
    QutritPulseSimulateRequest,
    QutritPulseSimulateResponse,
)
from api.pulse_backend_logging import log_pulse_backend_selection
from core.capabilities import DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL
from core.gates import Matrix, matmul, trace
from core.pulse_contract import (
    PULSE_ANGULAR_FREQUENCY_UNIT,
    PULSE_APPROXIMATION,
    PULSE_FRAME,
    PULSE_RATE_UNIT,
    PULSE_TIME_UNIT,
)
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    PulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_evolution import (
    PhysicalityMetrics,
    TimeDependentCheckpoint,
    physicality_metrics,
    resolve_time_dependent_backend,
)
from core.pulse_qutrit import qutrit_initial_density_matrix
from core.pulse_qutrit_contract import (
    QUTRIT_BASIS_LABELS,
    transmon_anharmonicity_rad_per_us,
)
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    evolve_open_qutrit_sequence,
    qutrit_dissipation_rates,
)
from core.pulse_step_policy import recommended_qutrit_step_policy
from core.results import EnvironmentConfig


QUTRIT_API_CONTRACT_VERSION = "pulse-extension-b-v1"
QUTRIT_API_MAX_INTERNAL_STEPS = 4_000
QUTRIT_MODEL_DESCRIPTION = (
    "single-transmon three-level rotating-frame RWA experimental model"
)
QUTRIT_MODEL_WARNING = (
    "Experimental educational qutrit model; this is not calibrated "
    "hardware pulse reproduction."
)
QUTRIT_MODEL_LIMITATIONS = (
    "Single qutrit only; multi-qubit and entangling pulses are omitted.",
    "Three-level truncation only; higher transmon levels are omitted.",
    "Rotating-frame RWA only; laboratory-frame carrier dynamics are omitted.",
    "Markovian Lindblad environment only; non-Markovian noise is omitted.",
    "Fixed-step RK4 is not a strict finite-step CPTP integrator.",
    "No transfer-function distortion, crosstalk, or hardware calibration.",
)


def run_qutrit_pulse_request(
    request: QutritPulseSimulateRequest,
) -> dict[str, object]:
    from api.pulse_service import PulseExecutionLimitError

    started = perf_counter()
    resolved_backend = resolve_time_dependent_backend(request.backend)
    log_pulse_backend_selection(
        model_id=DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL,
        requested=request.backend,
        resolved=resolved_backend,
    )
    envelope = _build_envelope(request)
    rates = _build_rates(request)
    alpha = transmon_anharmonicity_rad_per_us(
        request.anharmonicity_mhz
    )
    sample_times = _sample_times(
        request.total_simulation_time_us,
        envelope.duration_us,
        request.snapshot_options.uniform_count,
        request.snapshot_options.custom_times_us,
    )
    pulse_times, idle_times = _segment_sample_times(
        sample_times,
        envelope.duration_us,
        request.total_simulation_time_us,
    )
    policy = recommended_qutrit_step_policy(
        envelope,
        request.pulse.detuning_rad_per_us,
        alpha,
        rates,
        request.total_simulation_time_us,
        maximum_internal_step_count=QUTRIT_API_MAX_INTERNAL_STEPS,
        drag_beta_us=request.pulse.drag_beta_us,
    )
    estimated_steps = (
        _estimated_segment_steps(
            pulse_times, policy.selected_internal_step_cap_us
        )
        + _estimated_segment_steps(
            idle_times, policy.selected_internal_step_cap_us
        )
    )
    if estimated_steps > QUTRIT_API_MAX_INTERNAL_STEPS:
        raise PulseExecutionLimitError(
            "Qutrit pulse request exceeds the internal-step limit: "
            f"estimated {estimated_steps} steps, maximum "
            f"{QUTRIT_API_MAX_INTERNAL_STEPS}."
        )

    result = evolve_open_qutrit_sequence(
        qutrit_initial_density_matrix(request.initial_state),
        envelope,
        alpha,
        rates,
        request.total_simulation_time_us,
        policy.selected_internal_step_cap_us,
        phase_rad=request.pulse.phase_rad,
        detuning_rad_per_us=request.pulse.detuning_rad_per_us,
        drag_beta_us=request.pulse.drag_beta_us,
        pulse_checkpoint_times_us=pulse_times,
        idle_checkpoint_times_us=idle_times,
        backend=resolved_backend,
    )
    paired = _sequence_checkpoints(result, envelope.duration_us)
    trajectory = [
        _trajectory_point(time_us, segment, point)
        for time_us, segment, point in paired
    ]
    pulse_end = _trajectory_point(
        envelope.duration_us,
        "pulse",
        result.pulse_result.checkpoints[-1],
    )
    final = (
        pulse_end
        if result.idle_result is None
        else _trajectory_point(
            request.total_simulation_time_us,
            "idle",
            result.idle_result.checkpoints[-1],
        )
    )
    cleaned = [
        physicality_metrics(point.cleaned_state)
        for _, _, point in paired
    ]
    step_policy = policy.to_dict()
    step_policy["estimated_internal_step_count"] = estimated_steps
    step_policy["within_work_budget"] = True
    response = {
        "contract_version": QUTRIT_API_CONTRACT_VERSION,
        "model": {
            "model_id": DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL,
            "description": QUTRIT_MODEL_DESCRIPTION,
            "frame": PULSE_FRAME,
            "approximation": PULSE_APPROXIMATION,
            "logical_qubits": 1,
            "state_levels": 3,
            "basis_order": list(QUTRIT_BASIS_LABELS),
            "subsystem_dimensions": [3],
            "experimental": True,
            "hardware_calibrated": False,
            "internal_units": {
                "time": PULSE_TIME_UNIT,
                "angular_frequency": PULSE_ANGULAR_FREQUENCY_UNIT,
                "rate": PULSE_RATE_UNIT,
            },
        },
        "input": {
            "initial_state": request.initial_state,
            "anharmonicity_mhz": request.anharmonicity_mhz,
            "shape": request.pulse.shape,
            "amplitude_mode": request.pulse.amplitude_mode,
            "target_rotation_angle_rad": (
                request.pulse.target_rotation_angle_rad
            ),
            "peak_amplitude_rad_per_us": (
                envelope.peak_amplitude_rad_per_us
            ),
            "pulse_area_rad": envelope.pulse_area_rad,
            "pulse_duration_us": envelope.duration_us,
            "total_simulation_time_us": request.total_simulation_time_us,
            "idle_duration_us": (
                request.total_simulation_time_us - envelope.duration_us
            ),
            "phase_rad": request.pulse.phase_rad,
            "detuning_rad_per_us": request.pulse.detuning_rad_per_us,
            "drag_beta_us": request.pulse.drag_beta_us,
            "sample_count": len(trajectory),
        },
        "rates": rates.to_dict(),
        "step_policy": step_policy,
        "sample_times_us": [point["time_us"] for point in trajectory],
        "trajectory": trajectory,
        "leakage": {
            "maximum_recorded_leakage_probability": (
                result.leakage.maximum_recorded_leakage_probability
            ),
            "leakage_at_pulse_end": (
                result.leakage.leakage_at_pulse_end
            ),
            "leakage_at_final_time": (
                result.leakage.leakage_at_final_time
            ),
        },
        "pulse_end": pulse_end,
        "final": final,
        "diagnostics": {
            "api_runtime_ms": (perf_counter() - started) * 1000.0,
            "backend": {
                "requested": request.backend,
                "resolved": resolved_backend,
                "fallback_used": (
                    request.backend == "auto" and resolved_backend == "python"
                ),
            },
            "open_pulse": result.pulse_result.diagnostics.to_dict(),
            "open_idle": (
                None
                if result.idle_result is None
                else result.idle_result.diagnostics.to_dict()
            ),
            "maximum_cleaned_trace_error": max(
                item.trace_error for item in cleaned
            ),
            "maximum_cleaned_hermiticity_error": max(
                item.hermiticity_error for item in cleaned
            ),
            "minimum_cleaned_eigenvalue": min(
                item.minimum_eigenvalue for item in cleaned
            ),
        },
        "warnings": _warnings(request),
        "limitations": list(QUTRIT_MODEL_LIMITATIONS),
    }
    return QutritPulseSimulateResponse.model_validate(response).model_dump()


def _build_envelope(request: QutritPulseSimulateRequest) -> PulseEnvelope:
    pulse = request.pulse
    if pulse.shape == "square":
        assert pulse.pulse_duration_us is not None
        if pulse.amplitude_mode == "target_rotation_angle":
            assert pulse.target_rotation_angle_rad is not None
            return SquarePulseEnvelope.from_target_rotation_angle(
                pulse.target_rotation_angle_rad, pulse.pulse_duration_us
            )
        assert pulse.peak_amplitude_rad_per_us is not None
        return SquarePulseEnvelope(
            pulse.peak_amplitude_rad_per_us, pulse.pulse_duration_us
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
    request: QutritPulseSimulateRequest,
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
        request.anharmonicity_mhz,
    )


def _sample_times(
    total: float, pulse: float, count: int, custom: list[float]
) -> list[float]:
    values = {0.0, float(pulse), float(total), *map(float, custom)}
    if count >= 2:
        values.update(total * index / (count - 1) for index in range(count))
    return sorted(values)


def _segment_sample_times(
    times: list[float], pulse: float, total: float
) -> tuple[tuple[float, ...], tuple[float, ...]]:
    tolerance = 1e-14
    pulse_times = tuple(
        min(value, pulse) for value in times
        if value <= pulse + tolerance
    )
    if total <= pulse:
        return pulse_times, ()
    idle_duration = total - pulse
    idle_times = tuple(
        min(idle_duration, max(0.0, value - pulse))
        for value in times
        if value >= pulse - tolerance
    )
    return pulse_times, idle_times


def _estimated_segment_steps(
    boundaries: tuple[float, ...], max_step: float
) -> int:
    total = 0
    previous = 0.0
    for boundary in boundaries:
        interval = boundary - previous
        if interval > 1e-15:
            total += math.ceil(interval / max_step)
        previous = boundary
    return total


def _sequence_checkpoints(result, pulse_duration: float):
    paired = [
        (point.time_us, "pulse", point)
        for point in result.pulse_result.checkpoints
    ]
    if result.idle_result is not None:
        paired.extend(
            (pulse_duration + point.time_us, "idle", point)
            for point in result.idle_result.checkpoints[1:]
        )
    return paired


def _trajectory_point(
    time_us: float, segment: str, point: TimeDependentCheckpoint
) -> dict[str, object]:
    state = point.cleaned_state
    populations = [float(state[index][index].real) for index in range(3)]
    cleaned = physicality_metrics(state)
    return {
        "time_us": time_us,
        "segment": segment,
        "population_0": populations[0],
        "population_1": populations[1],
        "population_2": populations[2],
        "computational_population": populations[0] + populations[1],
        "leakage_probability": populations[2],
        "population_sum_error": abs(sum(populations) - 1.0),
        "purity": float(trace(matmul(state, state)).real),
        "density_matrix": _matrix_response(state),
        "raw_physicality": _physicality_response(point.raw_physicality),
        "cleaned_physicality": _physicality_response(cleaned),
        "cleanup_correction_norm": point.cleanup_correction_norm,
    }


def _warnings(request: QutritPulseSimulateRequest) -> list[str]:
    warnings = [QUTRIT_MODEL_WARNING]
    if request.environment.input_mode == "direct_rates":
        warnings.append(
            "Direct-rate mode bypasses the educational physical-input mapping."
        )
    elif request.environment.ideal_reference:
        warnings.append(
            "ideal_reference disables environmental rates for the physical "
            "input profile."
        )
    return warnings


def _physicality_response(metrics: PhysicalityMetrics) -> dict[str, float]:
    return {
        "trace_error": metrics.trace_error,
        "hermiticity_error": metrics.hermiticity_error,
        "minimum_eigenvalue": metrics.minimum_eigenvalue,
    }


def _matrix_response(matrix: Matrix) -> list[list[dict[str, float]]]:
    return [
        [
            {"real": float(value.real), "imag": float(value.imag)}
            for value in row
        ]
        for row in matrix
    ]
