"""Independent QuTiP audit for the coupled two-transmon Pulse model.

The QuTiP side intentionally reconstructs the Hamiltonian and collapse
operators from the public request contract.  It does not call the production
Hamiltonian provider, so a shared matrix-construction bug remains detectable.
"""

from __future__ import annotations

import math
import platform
from dataclasses import dataclass
from typing import Any

import numpy as np

from api.pulse_models import CoupledTransmonPairPulseSimulateRequest
from api.pulse_transmon_pair_service import run_coupled_transmon_pair_request
from core.rust_dense_kernel import is_rust_kernel_available
from validation_pulse.qutip_adapter import DEFAULT_OPTIONS, QUTIP_AVAILABLE, qutip


PAIR_QUTIP_BASIS = ("00", "01", "02", "10", "11", "12", "20", "21", "22")
PAIR_QUTIP_SUBSYSTEM_DIMENSIONS = (3, 3)


@dataclass(frozen=True)
class PairQutipCase:
    name: str
    category: str
    payload: dict[str, Any]
    tolerance: float


def pair_qutip_cases() -> tuple[PairQutipCase, ...]:
    """Return the preregistered sweep and stress cases."""

    cases: list[PairQutipCase] = []
    for name, coupling, detunings in (
        ("sweep_uncoupled_resonant", 0.0, [0.0, 0.0]),
        ("sweep_moderate_exchange_detuned", 8.0, [0.0, 18.0]),
        ("sweep_strong_exchange_opposite_detuning", 30.0, [-22.0, 35.0]),
    ):
        payload = _base_payload()
        payload.update({
            "exchange_coupling_rad_per_us": coupling,
            "detunings_rad_per_us": detunings,
        })
        cases.append(PairQutipCase(name, "coupling_detuning_sweep", payload, 2e-6))

    dissipative = _base_payload()
    dissipative.update({"initial_state": "11", "total_simulation_time_us": 0.08})
    dissipative["pulse"] = _square_pulse(0.35, 0.008, phase=0.2)
    dissipative["environment"] = _rates(0.75, 0.11, 1.25, 0.17, 0.32)
    cases.append(PairQutipCase(
        "nonzero_dissipation_long_idle",
        "dissipation_long_time",
        dissipative,
        8e-6,
    ))

    simultaneous = _base_payload()
    simultaneous.update({
        "detunings_rad_per_us": [6.0, -11.0],
        "exchange_coupling_rad_per_us": 12.0,
        "total_simulation_time_us": 0.032,
    })
    simultaneous["pulse"] = _gaussian_pulse(
        0.8 * math.pi, 0.003, phase=0.31, drag_beta=0.0012
    )
    simultaneous["secondary_pulse"] = _gaussian_pulse(
        0.55 * math.pi, 0.0025, phase=-0.47, drag_beta=-0.0008
    )
    simultaneous["environment"] = _rates(0.2, 0.03, 0.38, 0.05, 0.09)
    cases.append(PairQutipCase(
        "simultaneous_two_channel_drag",
        "simultaneous_drive",
        simultaneous,
        1.2e-5,
    ))

    leakage = _base_payload()
    leakage.update({
        "anharmonicities_mhz": [-60.0, -72.0],
        "detunings_rad_per_us": [0.0, 8.0],
        "exchange_coupling_rad_per_us": 18.0,
        "total_simulation_time_us": 0.010,
    })
    leakage["pulse"] = _gaussian_pulse(2.0 * math.pi, 0.0008, phase=0.12)
    leakage["secondary_pulse"] = _gaussian_pulse(1.4 * math.pi, 0.0008, phase=0.73)
    cases.append(PairQutipCase(
        "strong_drive_high_leakage",
        "strong_drive_leakage",
        leakage,
        2e-5,
    ))

    quasi_static = _base_payload()
    quasi_static.update({
        "detunings_rad_per_us": [3.0, -5.0],
        "exchange_coupling_rad_per_us": 10.0,
        "quasi_static_detuning_sigmas_rad_per_us": [5.0, 7.0],
        "quasi_static_detuning_correlation": 0.65,
        "quasi_static_quadrature_order": 3,
        "total_simulation_time_us": 0.024,
    })
    quasi_static["pulse"] = _gaussian_pulse(0.65 * math.pi, 0.002)
    quasi_static["environment"] = _rates(0.12, 0.02, 0.22, 0.03, 0.06)
    cases.append(PairQutipCase(
        "correlated_quasi_static_ensemble",
        "quasi_static_noise",
        quasi_static,
        1.2e-5,
    ))
    return tuple(cases)


def run_pair_qutip_audit() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not QUTIP_AVAILABLE:
        raise RuntimeError("QuTiP is unavailable in this validation environment")

    backend = "rust" if is_rust_kernel_available() else "python"
    reports: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for case in pair_qutip_cases():
        report, case_rows = _run_case(case, backend)
        reports.append(report)
        rows.extend(case_rows)

    maximum_errors = {
        key: max(row[key] for row in rows)
        for key in (
            "max_element_difference",
            "frobenius_difference",
            "trace_distance",
            "population_difference",
            "purity_difference",
            "leakage_difference",
        )
    }
    return {
        "audit_id": "coupled_transmon_pair_qutip_audit_v2",
        "pass": all(report["pass"] for report in reports),
        "model_id": "driven_coupled_transmon_pair_rwa_experimental_v1",
        "production_backend": backend,
        "reference_solver": "QuTiP mesolve / DOP853",
        "basis_order": list(PAIR_QUTIP_BASIS),
        "subsystem_dimensions": list(PAIR_QUTIP_SUBSYSTEM_DIMENSIONS),
        "matrix_shape": [9, 9],
        "case_count": len(reports),
        "checkpoint_count": len(rows),
        "cases": reports,
        "maximum_errors": maximum_errors,
        "software_versions": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "qutip": qutip.__version__,
        },
        "qutip_options": dict(DEFAULT_OPTIONS),
        "specification_alignment": specification_alignment(),
        "independence_boundary": (
            "QuTiP reconstructs H(t), c_ops, basis states, Gaussian envelopes, "
            "DRAG quadratures, and correlated quadrature nodes from the public "
            "contract; only request parsing and result comparison are shared."
        ),
        "scope_limitations": [
            "This is a numerical implementation audit, not hardware calibration.",
            "Both production transmons currently share one dissipation-rate profile.",
            "The model remains a three-level local truncation under the RWA.",
        ],
    }, rows


def specification_alignment() -> list[dict[str, str]]:
    return [
        {
            "item": "basis and tensor order",
            "production": "row-major |q0,q1> = 00,01,02,10,...,22",
            "qutip": "tensor(q0, q1), with q1 as the fast matrix index",
            "alignment": "Qobj dims=[[3,3],[3,3]]; no permutation is applied",
        },
        {
            "item": "units",
            "production": "time us, angular frequency rad/us, rates 1/us",
            "qutip": "dimensionless solver time with user-supplied coefficients",
            "alignment": "t is supplied in us and all coefficients retain rad/us or 1/us",
        },
        {
            "item": "rotating-frame detuning",
            "production": "H_i=-Delta_i*n_i+alpha_i*n_i(n_i-1)/2",
            "qutip": "the same operator expression is constructed directly",
            "alignment": "Delta=omega_drive-omega_01; the minus sign is explicit",
        },
        {
            "item": "drive I/Q convention",
            "production": "H_d=[(Omega_x-i Omega_y)a+h.c.]/2",
            "qutip": "Omega_x(a+a.dag())/2-i Omega_y(a-a.dag())/2",
            "alignment": "the algebraic forms are identical, including the Y sign",
        },
        {
            "item": "Gaussian and DRAG",
            "production": "finite support +/-k sigma; Q=beta*dOmega/dt then phase rotation",
            "qutip": "finite Gaussian normalization and analytic derivative rebuilt independently",
            "alignment": "same inclusive support, target area, derivative, beta, and phase rotation",
        },
        {
            "item": "exchange coupling",
            "production": "J(a0.dag()*a1+a0*a1.dag())",
            "qutip": "same excitation-conserving RWA exchange operator",
            "alignment": "J is used directly in rad/us; no 2*pi or factor-of-two conversion",
        },
        {
            "item": "collapse operators",
            "production": "transition-specific jumps and sqrt(2*gamma_phi)*n",
            "qutip": "the five local jumps are independently embedded per subsystem",
            "alignment": "sqrt(rate) amplitudes are used; number noise gives adjacent decay gamma_phi",
        },
        {
            "item": "quasi-static noise",
            "production": "correlated normal detuning with tensor Gauss-Hermite quadrature",
            "qutip": "nodes, weights, and Cholesky transform are independently regenerated",
            "alignment": "the identical probability distribution and quadrature order are compared",
        },
        {
            "item": "solver and vectorization",
            "production": "fixed-step RK4 with checkpoint physicality cleanup",
            "qutip": "adaptive DOP853 mesolve without production cleanup",
            "alignment": "density matrices are compared at identical tlist points; superoperator arrays are not compared",
        },
    ]


def _run_case(case: PairQutipCase, backend: str):
    payload = _deepcopy_payload(case.payload)
    payload["backend"] = backend
    request = CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
    production = run_coupled_transmon_pair_request(request)
    times = [float(value) for value in production["sample_times_us"]]
    reference_states = _qutip_reference_ensemble(request, times)

    case_rows = []
    for point, reference in zip(production["trajectory"], reference_states, strict=True):
        production_state = _response_matrix(point["density_matrix"])
        metrics = _comparison_metrics(production_state, reference)
        case_rows.append({
            "case": case.name,
            "category": case.category,
            "time_us": float(point["time_us"]),
            "segment": point["segment"],
            "tolerance": case.tolerance,
            **metrics,
        })
    maximum = max(row["max_element_difference"] for row in case_rows)
    return {
        "name": case.name,
        "category": case.category,
        "tolerance": case.tolerance,
        "pass": maximum <= case.tolerance,
        "maximum_density_matrix_element_error": maximum,
        "maximum_trace_distance": max(row["trace_distance"] for row in case_rows),
        "maximum_leakage_difference": max(row["leakage_difference"] for row in case_rows),
        "production_internal_steps": production["step_policy"]["estimated_internal_step_count"],
        "production_runtime_ms": production["diagnostics"]["api_runtime_ms"],
        "checkpoint_count": len(case_rows),
        "maximum_recorded_production_leakage": production["leakage"]["maximum_recorded_leakage_probability"],
        "parameters": {
            "initial_state": request.initial_state,
            "anharmonicities_mhz": request.anharmonicities_mhz,
            "detunings_rad_per_us": request.detunings_rad_per_us,
            "exchange_coupling_rad_per_us": request.exchange_coupling_rad_per_us,
            "total_simulation_time_us": request.total_simulation_time_us,
            "simultaneous_drive": request.secondary_pulse is not None,
            "quasi_static_sigmas_rad_per_us": request.quasi_static_detuning_sigmas_rad_per_us,
        },
    }, case_rows


def _qutip_reference_ensemble(request, times: list[float]) -> list[np.ndarray]:
    samples = _independent_correlated_samples(
        tuple(request.quasi_static_detuning_sigmas_rad_per_us),
        request.quasi_static_detuning_correlation,
        request.quasi_static_quadrature_order,
    )
    accumulated = [np.zeros((9, 9), dtype=complex) for _ in times]
    for offsets, weight in samples:
        states = _qutip_reference_single(request, times, offsets)
        for index, state in enumerate(states):
            accumulated[index] += weight * state
    return accumulated


def _qutip_reference_single(request, times: list[float], offsets):
    a = qutip.destroy(3)
    identity = qutip.qeye(3)
    number = a.dag() * a
    embedded_a = (qutip.tensor(a, identity), qutip.tensor(identity, a))
    embedded_n = (qutip.tensor(number, identity), qutip.tensor(identity, number))
    total_identity = qutip.tensor(identity, identity)

    effective_detunings = [
        request.detunings_rad_per_us[index] + offsets[index]
        for index in range(2)
    ]
    effective_detunings[request.drive_target] += request.pulse.detuning_rad_per_us
    if request.secondary_pulse is not None:
        effective_detunings[1 - request.drive_target] += request.secondary_pulse.detuning_rad_per_us
    alphas = [2.0 * math.pi * value for value in request.anharmonicities_mhz]

    static = 0.0 * total_identity
    for index in range(2):
        n_i = embedded_n[index]
        static += -effective_detunings[index] * n_i
        static += 0.5 * alphas[index] * n_i * (n_i - total_identity)
    static += request.exchange_coupling_rad_per_us * (
        embedded_a[0].dag() * embedded_a[1]
        + embedded_a[0] * embedded_a[1].dag()
    )

    # Give QuTiP fixed operators plus scalar coefficient functions.  Returning
    # a newly allocated 9x9 Qobj on every RHS evaluation is equivalent but
    # needlessly dominates the validation runtime.
    hamiltonian = [static]
    drives = [(request.drive_target, request.pulse)]
    if request.secondary_pulse is not None:
        drives.append((1 - request.drive_target, request.secondary_pulse))
    for target, pulse in drives:
        local_a = embedded_a[target]
        x_operator = 0.5 * (local_a + local_a.dag())
        y_operator = -0.5j * (local_a - local_a.dag())

        def x_coefficient(time_us, args=None, *, pulse=pulse):
            del args
            return _independent_quadratures(pulse, float(time_us))[0]

        def y_coefficient(time_us, args=None, *, pulse=pulse):
            del args
            return _independent_quadratures(pulse, float(time_us))[1]

        hamiltonian.extend(
            ([x_operator, x_coefficient], [y_operator, y_coefficient])
        )

    initial_index = PAIR_QUTIP_BASIS.index(request.initial_state)
    rho0 = qutip.basis([3, 3], [initial_index // 3, initial_index % 3]).proj()
    c_ops = _independent_collapse_operators(request.environment, a, identity)
    selected_step = _reference_max_step(request)
    options = {**DEFAULT_OPTIONS, "max_step": selected_step}
    result = qutip.mesolve(hamiltonian, rho0, times, c_ops=c_ops, options=options)
    return [np.asarray(state.full(), dtype=complex) for state in result.states]


def _independent_collapse_operators(environment, a, identity):
    if environment.input_mode != "direct_rates":
        raise ValueError("pair QuTiP audit cases require direct_rates")
    transition_10 = qutip.basis(3, 0) * qutip.basis(3, 1).dag()
    transition_01 = transition_10.dag()
    transition_21 = qutip.basis(3, 1) * qutip.basis(3, 2).dag()
    transition_12 = transition_21.dag()
    number = a.dag() * a
    local = (
        (environment.gamma_10_down_per_us, transition_10),
        (environment.gamma_01_up_per_us, transition_01),
        (environment.gamma_21_down_per_us, transition_21),
        (environment.gamma_12_up_per_us, transition_12),
        (2.0 * environment.gamma_phi_adjacent_per_us, number),
    )
    result = []
    for subsystem in range(2):
        for rate, operator in local:
            if rate <= 0.0:
                continue
            embedded = (
                qutip.tensor(operator, identity)
                if subsystem == 0
                else qutip.tensor(identity, operator)
            )
            result.append(math.sqrt(rate) * embedded)
    return result


def _independent_quadratures(pulse, time_us: float) -> tuple[float, float]:
    duration = pulse.derived_pulse_duration_us
    if time_us < 0.0 or time_us > duration:
        return 0.0, 0.0
    if pulse.shape == "square":
        amplitude = (
            pulse.target_rotation_angle_rad / duration
            if pulse.amplitude_mode == "target_rotation_angle"
            else pulse.peak_amplitude_rad_per_us
        )
        quadrature = 0.0
    else:
        sigma = pulse.sigma_us
        truncation = pulse.truncation_sigma
        area_factor = sigma * math.sqrt(2.0 * math.pi) * math.erf(truncation / math.sqrt(2.0))
        peak = (
            pulse.target_rotation_angle_rad / area_factor
            if pulse.amplitude_mode == "target_rotation_angle"
            else pulse.peak_amplitude_rad_per_us
        )
        normalized = (time_us - truncation * sigma) / sigma
        amplitude = peak * math.exp(-0.5 * normalized * normalized)
        derivative = -normalized * amplitude / sigma
        quadrature = pulse.drag_beta_us * derivative
    cosine = math.cos(pulse.phase_rad)
    sine = math.sin(pulse.phase_rad)
    return (
        amplitude * cosine - quadrature * sine,
        amplitude * sine + quadrature * cosine,
    )


def _independent_correlated_samples(sigmas, correlation, order):
    sigma0, sigma1 = sigmas
    if sigma0 == 0.0 and sigma1 == 0.0:
        return (((0.0, 0.0), 1.0),)
    nodes, raw_weights = np.polynomial.hermite.hermgauss(order)
    standard = [
        (math.sqrt(2.0) * float(node), float(weight) / math.sqrt(math.pi))
        for node, weight in zip(nodes, raw_weights, strict=True)
    ]
    residual = math.sqrt(max(0.0, 1.0 - correlation * correlation))
    if sigma0 == 0.0:
        return tuple(((0.0, sigma1 * z), weight) for z, weight in standard)
    if sigma1 == 0.0:
        return tuple(((sigma0 * z, 0.0), weight) for z, weight in standard)
    return tuple(
        (
            (sigma0 * z0, sigma1 * (correlation * z0 + residual * z1)),
            weight0 * weight1,
        )
        for z0, weight0 in standard
        for z1, weight1 in standard
    )


def _reference_max_step(request) -> float:
    pulse_scales = []
    for pulse in (request.pulse, request.secondary_pulse):
        if pulse is None:
            continue
        if pulse.shape == "gaussian":
            pulse_scales.append(pulse.sigma_us / 64.0)
        else:
            pulse_scales.append(pulse.pulse_duration_us / 128.0)
    spectral_scale = max(
        abs(2.0 * math.pi * value) for value in request.anharmonicities_mhz
    ) + 2.0 * request.exchange_coupling_rad_per_us
    return min(*pulse_scales, 0.015 / max(spectral_scale, 1.0))


def _comparison_metrics(production: np.ndarray, reference: np.ndarray):
    difference = production - reference
    singular_values = np.linalg.svd(difference, compute_uv=False)
    diagonal_difference = np.abs(np.diag(difference))
    production_leakage = 1.0 - sum(production[index, index].real for index in (0, 1, 3, 4))
    reference_leakage = 1.0 - sum(reference[index, index].real for index in (0, 1, 3, 4))
    return {
        "max_element_difference": float(np.max(np.abs(difference))),
        "frobenius_difference": float(np.linalg.norm(difference)),
        "trace_distance": float(0.5 * np.sum(singular_values)),
        "population_difference": float(np.max(diagonal_difference)),
        "purity_difference": float(abs(np.trace(production @ production).real - np.trace(reference @ reference).real)),
        "leakage_difference": float(abs(production_leakage - reference_leakage)),
        "production_trace_error": float(abs(np.trace(production) - 1.0)),
        "qutip_trace_error": float(abs(np.trace(reference) - 1.0)),
        "production_minimum_eigenvalue": float(np.min(np.linalg.eigvalsh(production))),
        "qutip_minimum_eigenvalue": float(np.min(np.linalg.eigvalsh(reference))),
    }


def _response_matrix(matrix) -> np.ndarray:
    return np.asarray([
        [complex(value["real"], value["imag"]) for value in row]
        for row in matrix
    ], dtype=complex)


def _base_payload() -> dict[str, Any]:
    return {
        "model_id": "driven_coupled_transmon_pair_rwa_experimental_v1",
        "initial_state": "00",
        "anharmonicities_mhz": [-100.0, -112.0],
        "detunings_rad_per_us": [0.0, 18.0],
        "exchange_coupling_rad_per_us": 8.0,
        "drive_target": 0,
        "pulse": _gaussian_pulse(0.7 * math.pi, 0.002),
        "quasi_static_detuning_sigmas_rad_per_us": [0.0, 0.0],
        "quasi_static_detuning_correlation": 0.0,
        "quasi_static_quadrature_order": 3,
        "total_simulation_time_us": 0.024,
        "environment": _rates(0.0, 0.0, 0.0, 0.0, 0.0),
        "snapshot_options": {"uniform_count": 13, "custom_times_us": []},
    }


def _gaussian_pulse(angle, sigma, *, phase=0.0, drag_beta=0.0):
    return {
        "shape": "gaussian",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": angle,
        "sigma_us": sigma,
        "truncation_sigma": 4.0,
        "phase_rad": phase,
        "detuning_rad_per_us": 0.0,
        "drag_beta_us": drag_beta,
    }


def _square_pulse(angle, duration, *, phase=0.0):
    return {
        "shape": "square",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": angle,
        "pulse_duration_us": duration,
        "phase_rad": phase,
        "detuning_rad_per_us": 0.0,
        "drag_beta_us": 0.0,
    }


def _rates(g10, g01, g21, g12, gphi):
    return {
        "input_mode": "direct_rates",
        "gamma_10_down_per_us": g10,
        "gamma_01_up_per_us": g01,
        "gamma_21_down_per_us": g21,
        "gamma_12_up_per_us": g12,
        "gamma_phi_adjacent_per_us": gphi,
    }


def _deepcopy_payload(payload):
    import copy
    return copy.deepcopy(payload)
