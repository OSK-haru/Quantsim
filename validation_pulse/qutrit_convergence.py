"""B-3 fixed-step convergence validation for non-DRAG qutrit evolution."""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Any

from core.gates import Matrix, density_from_ket
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    PulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_qutrit import qutrit_initial_density_matrix
from core.pulse_qutrit_contract import (
    transmon_anharmonicity_rad_per_us,
)
from core.pulse_qutrit_open_system import (
    OpenQutritSequenceResult,
    QutritDissipationRates,
    evolve_open_qutrit_sequence,
)
from core.pulse_step_policy import (
    PULSE_QUTRIT_EPSILON_D,
    PULSE_QUTRIT_EPSILON_H,
    PULSE_QUTRIT_MAX_INTERNAL_STEPS,
    PULSE_QUTRIT_SAMPLES_PER_SIGMA,
    QutritPulseStepPolicy,
    recommended_qutrit_step_policy,
)


STATE_ERROR_TOLERANCE = 2e-7
RAW_TRACE_TOLERANCE = 1e-10
RAW_HERMITICITY_TOLERANCE = 1e-10
RAW_MINIMUM_EIGENVALUE_TOLERANCE = -1e-9
CLEANUP_CORRECTION_TOLERANCE = 1e-10
REFINEMENT_FACTORS = (4.0, 2.0, 1.0, 0.5)
REFERENCE_FACTOR = 0.25


@dataclass(frozen=True)
class QutritConvergenceCase:
    name: str
    description: str
    initial_state: Matrix
    envelope: PulseEnvelope
    anharmonicity_rad_per_us: float
    detuning_rad_per_us: float
    rates: QutritDissipationRates
    total_simulation_time_us: float


def run_qutrit_convergence_validation(
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run the fixed B-3 refinement matrix and unsafe guard fixture."""

    case_reports: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for case in _standard_cases():
        case_report, case_rows = _run_standard_case(case)
        case_reports.append(case_report)
        rows.extend(case_rows)

    unsafe_report, unsafe_rows = _run_unsafe_guard_case()
    case_reports.append(unsafe_report)
    rows.extend(unsafe_rows)

    standard_policy_rows = [
        row
        for row in rows
        if row.get("step_factor") == 1.0
        and row["case"] != "deliberately_coarse_unsafe_guard"
    ]
    total_runtime_ms = sum(float(row["runtime_ms"]) for row in rows)
    total_steps = sum(int(row["actual_internal_step_count"]) for row in rows)
    measured_ms_per_step = (
        total_runtime_ms / total_steps if total_steps else 0.0
    )
    estimated_budget_runtime_ms = (
        measured_ms_per_step * PULSE_QUTRIT_MAX_INTERNAL_STEPS
    )

    overall_pass = all(case["pass"] for case in case_reports)
    report: dict[str, Any] = {
        "validation_id": "pulse_b3_qutrit_convergence_v1",
        "overall_pass": overall_pass,
        "model_id": "driven_transmon_qutrit_rwa_experimental_v1",
        "contract_version": "pulse-extension-b-v1",
        "capability_status": "contract_only",
        "frame": "rotating",
        "approximation": "RWA",
        "basis_order": ["0", "1", "2"],
        "subsystem_dimensions": [3],
        "internal_units": {
            "time": "us",
            "hamiltonian": "rad/us",
            "anharmonicity": "rad/us",
            "rates": "1/us",
        },
        "hamiltonian_convention": (
            "-Delta*n + alpha*n*(n-1)/2 + "
            "Omega_x*(a+a_dagger)/2 + "
            "Omega_y*(-i*(a-a_dagger))/2"
        ),
        "cleanup_policy": (
            "raw metrics before cleanup; Hermiticity/trace cleanup after "
            "each complete RK4 step; no PSD projection"
        ),
        "solver": "fixed_step_rk4_with_post_step_cleanup",
        "policy": {
            "policy_id": "qutrit_fixed_rk4_v1",
            "epsilon_h": PULSE_QUTRIT_EPSILON_H,
            "epsilon_d": PULSE_QUTRIT_EPSILON_D,
            "samples_per_sigma": PULSE_QUTRIT_SAMPLES_PER_SIGMA,
            "maximum_internal_step_count": (
                PULSE_QUTRIT_MAX_INTERNAL_STEPS
            ),
            "state_error_tolerance": STATE_ERROR_TOLERANCE,
            "raw_trace_tolerance": RAW_TRACE_TOLERANCE,
            "raw_hermiticity_tolerance": RAW_HERMITICITY_TOLERANCE,
            "raw_minimum_eigenvalue_tolerance": (
                RAW_MINIMUM_EIGENVALUE_TOLERANCE
            ),
            "cleanup_correction_tolerance": (
                CLEANUP_CORRECTION_TOLERANCE
            ),
            "refinement_factors": list(REFINEMENT_FACTORS),
            "reference_factor": REFERENCE_FACTOR,
        },
        "performance": {
            "measured_total_runtime_ms": total_runtime_ms,
            "measured_total_internal_steps": total_steps,
            "measured_ms_per_internal_step": measured_ms_per_step,
            "estimated_runtime_at_work_budget_ms": (
                estimated_budget_runtime_ms
            ),
            "work_budget_recommendation": (
                PULSE_QUTRIT_MAX_INTERNAL_STEPS
            ),
            "recommendation_scope": (
                "preflight rejection for future public qutrit requests; "
                "not yet API-enabled"
            ),
        },
        "policy_step_summary": {
            "maximum_matrix_error": max(
                row["matrix_max_element_error"]
                for row in standard_policy_rows
            ),
            "maximum_population_error": max(
                row["population_max_error"]
                for row in standard_policy_rows
            ),
            "maximum_leakage_error": max(
                row["leakage_error"]
                for row in standard_policy_rows
            ),
            "minimum_raw_eigenvalue": min(
                row["raw_minimum_eigenvalue"]
                for row in standard_policy_rows
            ),
            "maximum_cleanup_correction_norm": max(
                row["cleanup_correction_norm"]
                for row in standard_policy_rows
            ),
        },
        "cases": case_reports,
        "scope_and_limitations": {
            "proves": [
                "fixed-step refinement for the declared non-DRAG fixtures",
                "anharmonicity is included in the Hamiltonian scale",
                "qutrit transition and dephasing rates limit the step",
                "coarse unsafe and policy-safe conditions are distinguishable",
                "Baseline A policy remains a separate implementation path",
            ],
            "does_not_prove": [
                "adaptive convergence",
                "strict finite-step CPTP propagation",
                "DRAG convergence",
                "QuTiP qutrit agreement",
                "public qutrit API readiness",
            ],
        },
    }
    return report, rows


def _run_standard_case(
    case: QutritConvergenceCase,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    policy = recommended_qutrit_step_policy(
        case.envelope,
        case.detuning_rad_per_us,
        case.anharmonicity_rad_per_us,
        case.rates,
        case.total_simulation_time_us,
    )
    reference_step = (
        policy.selected_internal_step_cap_us * REFERENCE_FACTOR
    )
    reference_result, reference_runtime = _timed_evolution(
        case,
        reference_step,
    )
    reference_state = reference_result.final_state
    reference_diagnostics = _aggregate_diagnostics(reference_result)
    reference_row = _result_row(
        case,
        policy,
        reference_result,
        reference_runtime,
        reference_step,
        REFERENCE_FACTOR,
        reference_state,
        is_reference=True,
    )

    rows: list[dict[str, Any]] = []
    for factor in REFINEMENT_FACTORS:
        step = policy.selected_internal_step_cap_us * factor
        result, runtime_ms = _timed_evolution(case, step)
        rows.append(_result_row(
            case,
            policy,
            result,
            runtime_ms,
            step,
            factor,
            reference_state,
            is_reference=False,
        ))
    rows.append(reference_row)

    refinement_rows = rows[:-1]
    matrix_errors = [
        float(row["matrix_max_element_error"])
        for row in refinement_rows
    ]
    cleanup_norms = [
        float(row["cleanup_correction_norm"])
        for row in refinement_rows
    ]
    policy_row = next(
        row for row in refinement_rows if row["step_factor"] == 1.0
    )
    convergence_pass = _nonincreasing_with_floor(
        matrix_errors,
        absolute_floor=5e-14,
    )
    cleanup_refinement_pass = _nonincreasing_with_floor(
        cleanup_norms,
        absolute_floor=5e-14,
    )
    policy_accuracy_pass = (
        policy_row["matrix_max_element_error"]
        <= STATE_ERROR_TOLERANCE
        and policy_row["population_max_error"]
        <= STATE_ERROR_TOLERANCE
        and policy_row["leakage_error"]
        <= STATE_ERROR_TOLERANCE
    )
    policy_physicality_pass = _physicality_pass(policy_row)
    work_budget_pass = policy.within_work_budget
    case_pass = (
        convergence_pass
        and cleanup_refinement_pass
        and policy_accuracy_pass
        and policy_physicality_pass
        and work_budget_pass
    )
    observed_orders = [
        _observed_order(matrix_errors[index], matrix_errors[index + 1])
        for index in range(len(matrix_errors) - 1)
    ]
    return {
        "name": case.name,
        "description": case.description,
        "pass": case_pass,
        "input_summary": _case_input_summary(case),
        "policy": policy.to_dict(),
        "convergence_pass": convergence_pass,
        "cleanup_refinement_pass": cleanup_refinement_pass,
        "policy_accuracy_pass": policy_accuracy_pass,
        "policy_physicality_pass": policy_physicality_pass,
        "work_budget_pass": work_budget_pass,
        "observed_orders": observed_orders,
        "policy_step_matrix_error": (
            policy_row["matrix_max_element_error"]
        ),
        "policy_step_population_error": (
            policy_row["population_max_error"]
        ),
        "policy_step_leakage_error": policy_row["leakage_error"],
        "reference_internal_steps": (
            reference_diagnostics["actual_internal_step_count"]
        ),
    }, rows


def _run_unsafe_guard_case(
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    duration = 0.05
    case = QutritConvergenceCase(
        name="deliberately_coarse_unsafe_guard",
        description=(
            "A one-step, strongly dissipative |2> decay compared with the "
            "qutrit policy limit."
        ),
        initial_state=qutrit_initial_density_matrix("2"),
        envelope=SquarePulseEnvelope(0.0, duration),
        anharmonicity_rad_per_us=-1.0,
        detuning_rad_per_us=0.0,
        rates=_direct_rates(gamma_21_down_per_us=100.0),
        total_simulation_time_us=duration,
    )
    policy = recommended_qutrit_step_policy(
        case.envelope,
        case.detuning_rad_per_us,
        case.anharmonicity_rad_per_us,
        case.rates,
        case.total_simulation_time_us,
    )
    reference_result, _ = _timed_evolution(
        case,
        policy.selected_internal_step_cap_us * 0.25,
    )
    coarse_result, coarse_runtime = _timed_evolution(case, duration)
    safe_result, safe_runtime = _timed_evolution(
        case,
        policy.selected_internal_step_cap_us,
    )
    coarse_row = _result_row(
        case,
        policy,
        coarse_result,
        coarse_runtime,
        duration,
        duration / policy.selected_internal_step_cap_us,
        reference_result.final_state,
        is_reference=False,
    )
    coarse_row["guard_variant"] = "deliberately_coarse"
    safe_row = _result_row(
        case,
        policy,
        safe_result,
        safe_runtime,
        policy.selected_internal_step_cap_us,
        1.0,
        reference_result.final_state,
        is_reference=False,
    )
    safe_row["guard_variant"] = "policy_safe"

    coarse_breakdown_detected = (
        coarse_row["raw_minimum_eigenvalue"] < -1e-5
        and coarse_row["matrix_max_element_error"]
        > STATE_ERROR_TOLERANCE
    )
    safe_pass = (
        _physicality_pass(safe_row)
        and safe_row["matrix_max_element_error"]
        <= STATE_ERROR_TOLERANCE
    )
    return {
        "name": case.name,
        "description": case.description,
        "pass": coarse_breakdown_detected and safe_pass,
        "input_summary": _case_input_summary(case),
        "policy": policy.to_dict(),
        "coarse_breakdown_detected": coarse_breakdown_detected,
        "safe_policy_pass": safe_pass,
        "coarse_raw_minimum_eigenvalue": (
            coarse_row["raw_minimum_eigenvalue"]
        ),
        "coarse_cleanup_correction_norm": (
            coarse_row["cleanup_correction_norm"]
        ),
        "safe_raw_minimum_eigenvalue": (
            safe_row["raw_minimum_eigenvalue"]
        ),
        "safe_cleanup_correction_norm": (
            safe_row["cleanup_correction_norm"]
        ),
    }, [coarse_row, safe_row]


def _result_row(
    case: QutritConvergenceCase,
    policy: QutritPulseStepPolicy,
    result: OpenQutritSequenceResult,
    runtime_ms: float,
    requested_step_us: float,
    step_factor: float,
    reference_state: Matrix,
    *,
    is_reference: bool,
) -> dict[str, Any]:
    diagnostics = _aggregate_diagnostics(result)
    matrix_error = (
        0.0
        if is_reference
        else _matrix_max_error(result.final_state, reference_state)
    )
    population_error = (
        0.0
        if is_reference
        else max(
            abs(
                result.final_state[index][index].real
                - reference_state[index][index].real
            )
            for index in range(3)
        )
    )
    leakage_error = (
        0.0
        if is_reference
        else abs(
            result.final_state[2][2].real
            - reference_state[2][2].real
        )
    )
    return {
        "case": case.name,
        "is_reference": is_reference,
        "step_factor": step_factor,
        "requested_internal_step_cap_us": requested_step_us,
        "hamiltonian_scale_max_rad_per_us": (
            policy.hamiltonian_scale_max_rad_per_us
        ),
        "dissipation_scale_per_us": (
            policy.dissipation_scale_per_us
        ),
        "envelope_step_limit_us": policy.envelope_step_limit_us,
        "selected_internal_step_cap_us": (
            policy.selected_internal_step_cap_us
        ),
        "actual_internal_step_min_us": (
            diagnostics["actual_internal_step_min_us"]
        ),
        "actual_internal_step_max_us": (
            diagnostics["actual_internal_step_max_us"]
        ),
        "actual_internal_step_count": (
            diagnostics["actual_internal_step_count"]
        ),
        "step_limit_reason": policy.step_limit_reason,
        "runtime_ms": runtime_ms,
        "raw_trace_error": diagnostics["raw_trace_error"],
        "raw_hermiticity_error": diagnostics["raw_hermiticity_error"],
        "raw_minimum_eigenvalue": (
            diagnostics["raw_minimum_eigenvalue"]
        ),
        "cleanup_correction_norm": (
            diagnostics["cleanup_correction_norm"]
        ),
        "matrix_max_element_error": matrix_error,
        "population_max_error": population_error,
        "leakage_error": leakage_error,
        "population_0": float(result.final_state[0][0].real),
        "population_1": float(result.final_state[1][1].real),
        "population_2": float(result.final_state[2][2].real),
        "leakage_probability": float(result.final_state[2][2].real),
    }


def _timed_evolution(
    case: QutritConvergenceCase,
    max_step_us: float,
) -> tuple[OpenQutritSequenceResult, float]:
    started = time.perf_counter()
    result = evolve_open_qutrit_sequence(
        case.initial_state,
        case.envelope,
        case.anharmonicity_rad_per_us,
        case.rates,
        case.total_simulation_time_us,
        max_step_us,
        detuning_rad_per_us=case.detuning_rad_per_us,
    )
    return result, (time.perf_counter() - started) * 1000.0


def _aggregate_diagnostics(
    result: OpenQutritSequenceResult,
) -> dict[str, float | int]:
    diagnostics = [result.pulse_result.diagnostics]
    if result.idle_result is not None:
        diagnostics.append(result.idle_result.diagnostics)
    return {
        "actual_internal_step_min_us": min(
            item.minimum_internal_step_us for item in diagnostics
        ),
        "actual_internal_step_max_us": max(
            item.maximum_internal_step_us for item in diagnostics
        ),
        "actual_internal_step_count": sum(
            item.internal_step_count for item in diagnostics
        ),
        "raw_trace_error": max(
            item.raw_trace_error for item in diagnostics
        ),
        "raw_hermiticity_error": max(
            item.raw_hermiticity_error for item in diagnostics
        ),
        "raw_minimum_eigenvalue": min(
            item.raw_minimum_eigenvalue for item in diagnostics
        ),
        "cleanup_correction_norm": max(
            item.cleanup_correction_norm for item in diagnostics
        ),
    }


def _standard_cases() -> tuple[QutritConvergenceCase, ...]:
    zero_rates = _direct_rates()
    return (
        QutritConvergenceCase(
            name="free_qutrit_phase_large_anharmonicity",
            description=(
                "Free phase evolution of a |0>+|2> coherence at "
                "alpha/(2pi) = -300 MHz."
            ),
            initial_state=density_from_ket((
                1.0 / math.sqrt(2.0),
                0.0 + 0.0j,
                1.0 / math.sqrt(2.0),
            )),
            envelope=SquarePulseEnvelope(0.0, 0.004),
            anharmonicity_rad_per_us=(
                transmon_anharmonicity_rad_per_us(-300.0)
            ),
            detuning_rad_per_us=0.0,
            rates=zero_rates,
            total_simulation_time_us=0.004,
        ),
        QutritConvergenceCase(
            name="closed_resonant_gaussian_leakage",
            description=(
                "Resonant Gaussian pi pulse with deliberately measurable "
                "transmon leakage."
            ),
            initial_state=qutrit_initial_density_matrix("0"),
            envelope=GaussianPulseEnvelope.from_target_rotation_angle(
                math.pi,
                sigma_us=0.0015,
                truncation_sigma=4.0,
            ),
            anharmonicity_rad_per_us=(
                transmon_anharmonicity_rad_per_us(-100.0)
            ),
            detuning_rad_per_us=0.0,
            rates=zero_rates,
            total_simulation_time_us=0.012,
        ),
        QutritConvergenceCase(
            name="detuned_gaussian",
            description=(
                "Detuned Gaussian pi/2 pulse with the qutrit spectral span "
                "including detuning and anharmonicity."
            ),
            initial_state=qutrit_initial_density_matrix("0"),
            envelope=GaussianPulseEnvelope.from_target_rotation_angle(
                math.pi / 2.0,
                sigma_us=0.0015,
                truncation_sigma=4.0,
            ),
            anharmonicity_rad_per_us=(
                transmon_anharmonicity_rad_per_us(-150.0)
            ),
            detuning_rad_per_us=30.0,
            rates=zero_rates,
            total_simulation_time_us=0.012,
        ),
        QutritConvergenceCase(
            name="dissipative_gaussian",
            description=(
                "Gaussian pi pulse with all adjacent transition channels "
                "and number-operator dephasing active."
            ),
            initial_state=qutrit_initial_density_matrix("0"),
            envelope=GaussianPulseEnvelope.from_target_rotation_angle(
                math.pi,
                sigma_us=0.0015,
                truncation_sigma=4.0,
            ),
            anharmonicity_rad_per_us=(
                transmon_anharmonicity_rad_per_us(-100.0)
            ),
            detuning_rad_per_us=0.0,
            rates=_direct_rates(0.8, 0.2, 1.4, 0.1, 0.5),
            total_simulation_time_us=0.012,
        ),
        QutritConvergenceCase(
            name="pulse_then_idle",
            description=(
                "Dissipative Gaussian pi/2 pulse followed by free idle "
                "under the same Hamiltonian and collapse operators."
            ),
            initial_state=qutrit_initial_density_matrix("0"),
            envelope=GaussianPulseEnvelope.from_target_rotation_angle(
                math.pi / 2.0,
                sigma_us=0.0015,
                truncation_sigma=4.0,
            ),
            anharmonicity_rad_per_us=(
                transmon_anharmonicity_rad_per_us(-100.0)
            ),
            detuning_rad_per_us=15.0,
            rates=_direct_rates(0.5, 0.1, 0.9, 0.05, 0.25),
            total_simulation_time_us=0.02,
        ),
    )


def _direct_rates(
    gamma_10_down_per_us: float = 0.0,
    gamma_01_up_per_us: float = 0.0,
    gamma_21_down_per_us: float = 0.0,
    gamma_12_up_per_us: float = 0.0,
    gamma_phi_adjacent_per_us: float = 0.0,
) -> QutritDissipationRates:
    return QutritDissipationRates(
        "direct_rates",
        gamma_10_down_per_us,
        gamma_01_up_per_us,
        gamma_21_down_per_us,
        gamma_12_up_per_us,
        gamma_phi_adjacent_per_us,
    )


def _case_input_summary(
    case: QutritConvergenceCase,
) -> dict[str, Any]:
    envelope_summary: dict[str, Any] = {
        "type": type(case.envelope).__name__,
        "peak_amplitude_rad_per_us": (
            case.envelope.peak_amplitude_rad_per_us
        ),
        "duration_us": case.envelope.duration_us,
        "pulse_area_rad": case.envelope.pulse_area_rad,
    }
    if isinstance(case.envelope, GaussianPulseEnvelope):
        envelope_summary.update({
            "sigma_us": case.envelope.sigma_us,
            "truncation_sigma": case.envelope.truncation_sigma,
        })
    return {
        "envelope": envelope_summary,
        "anharmonicity_rad_per_us": (
            case.anharmonicity_rad_per_us
        ),
        "detuning_rad_per_us": case.detuning_rad_per_us,
        "total_simulation_time_us": case.total_simulation_time_us,
        "rates": case.rates.to_dict(),
    }


def _matrix_max_error(actual: Matrix, expected: Matrix) -> float:
    return max(
        abs(actual[row][column] - expected[row][column])
        for row in range(3)
        for column in range(3)
    )


def _physicality_pass(row: dict[str, Any]) -> bool:
    return (
        row["raw_trace_error"] <= RAW_TRACE_TOLERANCE
        and row["raw_hermiticity_error"] <= RAW_HERMITICITY_TOLERANCE
        and row["raw_minimum_eigenvalue"]
        >= RAW_MINIMUM_EIGENVALUE_TOLERANCE
        and row["cleanup_correction_norm"]
        <= CLEANUP_CORRECTION_TOLERANCE
    )


def _nonincreasing_with_floor(
    values: list[float],
    *,
    absolute_floor: float,
) -> bool:
    return all(
        finer <= max(coarser * 1.05, absolute_floor)
        for coarser, finer in zip(values, values[1:])
    )


def _observed_order(coarse_error: float, fine_error: float) -> float | None:
    if coarse_error <= 0.0 or fine_error <= 0.0:
        return None
    return math.log(coarse_error / fine_error, 2.0)
