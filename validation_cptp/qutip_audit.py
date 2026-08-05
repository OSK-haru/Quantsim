"""Independent QuTiP audit for the frozen explicit CPTP pulse path."""

from __future__ import annotations

import math
import platform
from dataclasses import dataclass
from typing import Any, Literal

import numpy as np

from core.cptp_piecewise import piecewise_gksl_exponential_map
from core.cptp_rust import rust_piecewise_gksl_exponential_map
from core.gates import Matrix, SIGMA_MINUS, Z, scale
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_qutrit import (
    QutritPulseHamiltonian,
    qutrit_initial_density_matrix,
)
from core.pulse_qutrit_contract import mhz_to_rad_per_us
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    qutrit_collapse_operator_matrices,
)
from core.rust_dense_kernel import is_rust_kernel_available
from validation_pulse.qutip_adapter import (
    DEFAULT_OPTIONS,
    QUTIP_AVAILABLE,
    compare_density_matrices,
    qutip,
    run_qutip_time_dependent_segment,
)


AUDIT_ID = "phase3a_cptp_qutip_v1"
FREEZE_ID = "quantascope_explicit_cptp_v1"
EVOLUTION_METHOD_ID = "explicit_cptp_midpoint_gksl_v1"
PHYSICALITY_TOLERANCE = 1e-10
PYTHON_RUST_PARITY_TOLERANCE = 2e-10
MONOTONICITY_SLACK = 1e-12
Backend = Literal["python", "rust"]


@dataclass(frozen=True)
class CPTPQuTiPCase:
    case_id: str
    description: str
    model_id: str
    initial_state: Matrix
    hamiltonian: object
    collapse_operators: tuple[Matrix, ...]
    duration_us: float
    interval_sizes_us: tuple[float, ...]
    finest_trace_distance_tolerance: float
    subsystem_dimensions: tuple[int, ...]
    parameters: dict[str, Any]


def cptp_qutip_cases() -> tuple[CPTPQuTiPCase, ...]:
    """Return the preregistered Phase 3A acceptance cases."""

    qubit_envelope = GaussianPulseEnvelope.from_target_rotation_angle(
        target_rotation_angle_rad=1.2,
        sigma_us=0.04,
        truncation_sigma=3.0,
    )
    qubit_provider = TwoLevelPulseHamiltonian(
        envelope=qubit_envelope,
        phase_rad=0.31,
        detuning_rad_per_us=-0.22,
    )

    qutrit_envelope = GaussianPulseEnvelope.from_target_rotation_angle(
        target_rotation_angle_rad=math.pi / 2.0,
        sigma_us=0.002,
        truncation_sigma=4.0,
    )
    qutrit_rates = QutritDissipationRates(
        input_mode="direct_rates",
        gamma_10_down_per_us=0.2,
        gamma_01_up_per_us=0.02,
        gamma_21_down_per_us=0.4,
        gamma_12_up_per_us=0.03,
        gamma_phi_adjacent_per_us=0.08,
    )
    qutrit_provider = QutritPulseHamiltonian(
        envelope=qutrit_envelope,
        anharmonicity_rad_per_us=mhz_to_rad_per_us(-100.0),
        phase_rad=0.35,
        detuning_rad_per_us=0.2,
        drag_beta_us=0.001,
    )

    return (
        CPTPQuTiPCase(
            case_id="two_level_gaussian_open_pulse",
            description=(
                "Two-level Gaussian pulse with phase, detuning, relaxation, "
                "thermal excitation, and pure dephasing."
            ),
            model_id="driven_two_level_rwa_experimental_v1",
            initial_state=_qubit_zero_state(),
            hamiltonian=qubit_provider,
            collapse_operators=(
                scale(math.sqrt(0.031), SIGMA_MINUS),
                scale(math.sqrt(0.004), _sigma_plus()),
                scale(math.sqrt(0.016 / 2.0), Z),
            ),
            duration_us=qubit_envelope.duration_us,
            interval_sizes_us=(0.01, 0.005, 0.0025),
            finest_trace_distance_tolerance=5e-5,
            subsystem_dimensions=(2,),
            parameters={
                "target_rotation_angle_rad": 1.2,
                "sigma_us": 0.04,
                "truncation_sigma": 3.0,
                "phase_rad": 0.31,
                "detuning_rad_per_us": -0.22,
                "gamma_down_per_us": 0.031,
                "gamma_up_per_us": 0.004,
                "gamma_phi_per_us": 0.016,
            },
        ),
        CPTPQuTiPCase(
            case_id="qutrit_drag_open_pulse",
            description=(
                "Qutrit Gaussian DRAG pulse with phase, detuning, "
                "transition-specific dissipation, and number dephasing."
            ),
            model_id="driven_transmon_qutrit_rwa_experimental_v1",
            initial_state=qutrit_initial_density_matrix("0"),
            hamiltonian=qutrit_provider,
            collapse_operators=tuple(
                qutrit_collapse_operator_matrices(qutrit_rates)
            ),
            duration_us=qutrit_envelope.duration_us,
            interval_sizes_us=(0.0002, 0.0001, 0.00005),
            finest_trace_distance_tolerance=2e-4,
            subsystem_dimensions=(3,),
            parameters={
                "target_rotation_angle_rad": math.pi / 2.0,
                "sigma_us": 0.002,
                "truncation_sigma": 4.0,
                "anharmonicity_mhz": -100.0,
                "phase_rad": 0.35,
                "detuning_rad_per_us": 0.2,
                "drag_beta_us": 0.001,
                "rates": qutrit_rates.to_dict(),
            },
        ),
    )


def run_cptp_qutip_audit(
    *,
    include_rust: bool = True,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run the preregistered CPTP-to-QuTiP refinement audit."""

    if not QUTIP_AVAILABLE:
        raise RuntimeError("QuTiP is unavailable in this validation environment")

    rust_available = is_rust_kernel_available()
    backends: tuple[Backend, ...] = (
        ("python", "rust")
        if include_rust and rust_available
        else ("python",)
    )
    case_reports = []
    rows: list[dict[str, Any]] = []
    for case in cptp_qutip_cases():
        case_report, case_rows = _run_case(case, backends)
        case_reports.append(case_report)
        rows.extend(case_rows)

    rust_required = include_rust
    rust_requirement_pass = not rust_required or rust_available
    overall_pass = (
        rust_requirement_pass
        and all(case["case_pass"] for case in case_reports)
    )
    return {
        "audit_id": AUDIT_ID,
        "decision": "PASS" if overall_pass else "FAIL",
        "overall_pass": overall_pass,
        "frozen_contract": {
            "freeze_id": FREEZE_ID,
            "evolution_method_id": EVOLUTION_METHOD_ID,
            "time_dependent_sampling_id": (
                "midpoint_piecewise_constant_v1"
            ),
            "cleanup_applied": False,
        },
        "preregistered_acceptance": {
            "required_cases": [
                case.case_id for case in cptp_qutip_cases()
            ],
            "required_backends": (
                ["python", "rust"] if rust_required else ["python"]
            ),
            "physicality_tolerance": PHYSICALITY_TOLERANCE,
            "python_rust_parity_tolerance": (
                PYTHON_RUST_PARITY_TOLERANCE
            ),
            "monotonicity_slack": MONOTONICITY_SLACK,
            "case_finest_trace_distance_tolerances": {
                case.case_id: case.finest_trace_distance_tolerance
                for case in cptp_qutip_cases()
            },
        },
        "methodology": {
            "comparison_rule": (
                "identical rho0, H(t) matrices, collapse-operator matrices, "
                "and interval-boundary times"
            ),
            "cptp_solver": (
                "midpoint piecewise-constant GKSL exponential composition"
            ),
            "qutip_solver": "mesolve with DOP853",
            "qutip_options": dict(DEFAULT_OPTIONS),
            "qutip_max_step_rule": "CPTP interval size divided by 8",
            "all_interval_boundaries_compared": True,
            "temperature_reinterpreted_by_qutip": False,
        },
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "qutip": qutip.__version__,
            "rust_extension_available": rust_available,
        },
        "rust_requirement_pass": rust_requirement_pass,
        "cases": case_reports,
        "maximum_observed_errors": _maximum_errors(rows),
        "scope_limitations": [
            "This validates solver agreement for the shared equations.",
            "It does not establish calibrated-hardware validity.",
            "The CPTP pulse path remains a midpoint time-discretization.",
            "Gate-aware execution is outside this explicit-CPTP audit.",
        ],
    }, rows


def _run_case(
    case: CPTPQuTiPCase,
    backends: tuple[Backend, ...],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    backend_reports = []
    rows: list[dict[str, Any]] = []
    states_by_backend_and_step: dict[tuple[str, float], list[Matrix]] = {}

    for interval_size in case.interval_sizes_us:
        python_map = piecewise_gksl_exponential_map(
            case.hamiltonian,
            case.collapse_operators,
            case.duration_us,
            interval_size,
            name=f"{case.case_id}_python",
        )
        boundaries = (
            0.0,
            *(interval.end_time_us for interval in python_map.intervals),
        )
        qutip_states = run_qutip_time_dependent_segment(
            case.initial_state,
            case.hamiltonian,
            case.collapse_operators,
            None,
            case.duration_us,
            boundaries,
            max_step_us=interval_size / 8.0,
            subsystem_dimensions=case.subsystem_dimensions,
        )

        for backend in backends:
            piecewise_map = (
                python_map
                if backend == "python"
                else rust_piecewise_gksl_exponential_map(
                    case.hamiltonian,
                    case.collapse_operators,
                    case.duration_us,
                    interval_size,
                    name=f"{case.case_id}_rust",
                )
            )
            cptp_states = _interval_boundary_states(
                case.initial_state,
                piecewise_map,
            )
            states_by_backend_and_step[
                (backend, interval_size)
            ] = cptp_states
            rows.extend(_comparison_rows(
                case,
                backend,
                interval_size,
                boundaries,
                cptp_states,
                qutip_states,
                piecewise_map,
            ))

    for backend in backends:
        backend_rows = [
            row for row in rows if row["backend"] == backend
        ]
        summaries = []
        for interval_size in case.interval_sizes_us:
            step_rows = [
                row
                for row in backend_rows
                if row["max_interval_us"] == interval_size
            ]
            summaries.append({
                "max_interval_us": interval_size,
                "interval_count": len(step_rows) - 1,
                "maximum_max_element_difference": max(
                    row["max_element_difference"] for row in step_rows
                ),
                "maximum_frobenius_difference": max(
                    row["frobenius_difference"] for row in step_rows
                ),
                "maximum_trace_distance": max(
                    row["trace_distance"] for row in step_rows
                ),
                "minimum_cptp_state_eigenvalue": min(
                    row["quanta_minimum_eigenvalue"] for row in step_rows
                ),
            })
        distances = [
            summary["maximum_trace_distance"] for summary in summaries
        ]
        monotonic = all(
            later <= earlier + MONOTONICITY_SLACK
            for earlier, later in zip(distances, distances[1:])
        )
        physicality_pass = all(
            _row_physicality_pass(row) for row in backend_rows
        )
        backend_reports.append({
            "backend": backend,
            "refinement": summaries,
            "trace_distance_monotonic": monotonic,
            "physicality_pass": physicality_pass,
            "finest_trace_distance": distances[-1],
            "finest_trace_distance_tolerance": (
                case.finest_trace_distance_tolerance
            ),
            "backend_pass": (
                monotonic
                and physicality_pass
                and distances[-1]
                <= case.finest_trace_distance_tolerance
            ),
        })

    parity_error = 0.0
    if "rust" in backends:
        for interval_size in case.interval_sizes_us:
            python_states = states_by_backend_and_step[
                ("python", interval_size)
            ]
            rust_states = states_by_backend_and_step[
                ("rust", interval_size)
            ]
            parity_error = max(
                parity_error,
                *(
                    float(np.max(np.abs(
                        np.asarray(python_state)
                        - np.asarray(rust_state)
                    )))
                    for python_state, rust_state in zip(
                        python_states,
                        rust_states,
                        strict=True,
                    )
                ),
            )
    parity_pass = parity_error <= PYTHON_RUST_PARITY_TOLERANCE
    return {
        "case_id": case.case_id,
        "description": case.description,
        "model_id": case.model_id,
        "duration_us": case.duration_us,
        "subsystem_dimensions": list(case.subsystem_dimensions),
        "parameters": case.parameters,
        "backends": backend_reports,
        "python_rust_max_element_difference": parity_error,
        "python_rust_parity_pass": parity_pass,
        "case_pass": (
            parity_pass
            and all(report["backend_pass"] for report in backend_reports)
        ),
    }, rows


def _interval_boundary_states(
    initial_state: Matrix,
    piecewise_map: object,
) -> list[Matrix]:
    current = initial_state
    states = [current]
    for interval in piecewise_map.intervals:
        current = interval.channel.apply(current)
        states.append(current)
    return states


def _comparison_rows(
    case: CPTPQuTiPCase,
    backend: Backend,
    interval_size: float,
    times: tuple[float, ...],
    cptp_states: list[Matrix],
    qutip_states: list[Matrix],
    piecewise_map: object,
) -> list[dict[str, Any]]:
    rows = []
    for time_us, cptp_state, qutip_state in zip(
        times,
        cptp_states,
        qutip_states,
        strict=True,
    ):
        rows.append({
            "case_id": case.case_id,
            "model_id": case.model_id,
            "backend": backend,
            "max_interval_us": interval_size,
            "time_us": time_us,
            **compare_density_matrices(cptp_state, qutip_state),
            "composed_choi_minimum_eigenvalue": (
                piecewise_map.audit.choi_minimum_eigenvalue
            ),
            "composed_tp_frobenius_error": (
                piecewise_map.audit.trace_preservation_frobenius_error
            ),
        })
    return rows


def _row_physicality_pass(row: dict[str, Any]) -> bool:
    return (
        row["quanta_trace_error"] <= PHYSICALITY_TOLERANCE
        and row["quanta_hermiticity_error"] <= PHYSICALITY_TOLERANCE
        and row["quanta_minimum_eigenvalue"] >= -PHYSICALITY_TOLERANCE
        and row["qutip_trace_error"] <= PHYSICALITY_TOLERANCE
        and row["qutip_hermiticity_error"] <= PHYSICALITY_TOLERANCE
        and row["qutip_minimum_eigenvalue"] >= -PHYSICALITY_TOLERANCE
        and row["composed_choi_minimum_eigenvalue"]
        >= -PHYSICALITY_TOLERANCE
        and row["composed_tp_frobenius_error"]
        <= PHYSICALITY_TOLERANCE
    )


def _maximum_errors(rows: list[dict[str, Any]]) -> dict[str, float]:
    return {
        key: max(float(row[key]) for row in rows)
        for key in (
            "max_element_difference",
            "frobenius_difference",
            "trace_distance",
            "population_difference",
            "coherence_difference",
            "purity_difference",
        )
    }


def _qubit_zero_state() -> Matrix:
    return (
        (1.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j),
    )


def _sigma_plus() -> Matrix:
    return (
        (0.0 + 0.0j, 0.0 + 0.0j),
        (1.0 + 0.0j, 0.0 + 0.0j),
    )
