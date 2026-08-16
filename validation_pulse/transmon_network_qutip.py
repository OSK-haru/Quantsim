"""Independent QuTiP audit for the coupled transmon-network Pulse model.

The QuTiP side rebuilds the Hamiltonian, the scheduled drive envelopes and the
collapse operators from the public request contract.  It never calls the
production Hamiltonian provider or the production dissipator, so a shared
construction bug stays detectable.  This matters more for the network than for
the pair: the network applies jump operators through a per-transmon kernel and
folds the relaxation term into a non-Hermitian effective Hamiltonian, and both
shortcuts must reproduce the plain Lindblad equation that QuTiP integrates.
"""

from __future__ import annotations

import copy
import math
import platform
from dataclasses import dataclass
from itertools import product
from typing import Any

import numpy as np

from api.pulse_models import CoupledTransmonNetworkPulseSimulateRequest
from api.pulse_transmon_network_service import (
    run_coupled_transmon_network_request,
)
from validation_pulse.qutip_adapter import DEFAULT_OPTIONS, QUTIP_AVAILABLE, qutip


NETWORK_QUTIP_LOCAL_DIMENSION = 3
NETWORK_QUTIP_AUDIT_ID = "coupled_transmon_network_qutip_audit_v1"
NETWORK_QUTIP_MODEL_ID = "driven_coupled_transmon_network_rwa_experimental_v1"


@dataclass(frozen=True)
class NetworkQutipCase:
    name: str
    category: str
    payload: dict[str, Any]
    tolerance: float


def network_basis_labels(transmon_count: int) -> tuple[str, ...]:
    """Return q0-most-significant labels, rebuilt from the documented order."""

    return tuple(
        "".join(str(level) for level in levels)
        for levels in product(
            range(NETWORK_QUTIP_LOCAL_DIMENSION),
            repeat=transmon_count,
        )
    )


def network_qutip_cases() -> tuple[NetworkQutipCase, ...]:
    """Return the preregistered network audit cases."""

    cases: list[NetworkQutipCase] = []

    uncoupled = _base_payload(2)
    uncoupled.update({
        "couplings": [],
        "detunings_rad_per_us": [0.0, 12.0],
        "drives": [
            _drive(0, 0.0, _gaussian_pulse(0.7 * math.pi, 0.002)),
            _drive(1, 0.0, _gaussian_pulse(0.4 * math.pi, 0.002, phase=0.6)),
        ],
        "total_simulation_time_us": 0.016,
    })
    cases.append(NetworkQutipCase(
        "two_transmon_uncoupled_simultaneous",
        "coupling_sweep",
        uncoupled,
        1e-7,
    ))

    chain = _base_payload(3)
    chain.update({
        "detunings_rad_per_us": [0.0, 14.0, -9.0],
        "couplings": [
            {"left": 0, "right": 1, "exchange_coupling_rad_per_us": 9.0},
            {"left": 1, "right": 2, "exchange_coupling_rad_per_us": 13.0},
        ],
        "drives": [
            _drive(0, 0.0, _gaussian_pulse(0.8 * math.pi, 0.002, drag_beta=0.0011)),
            _drive(2, 0.0, _gaussian_pulse(0.5 * math.pi, 0.002, phase=-0.4)),
        ],
        "total_simulation_time_us": 0.016,
    })
    cases.append(NetworkQutipCase(
        "three_transmon_chain_drag",
        "multi_edge_coupling",
        chain,
        1e-7,
    ))

    scheduled = _base_payload(3)
    scheduled.update({
        "detunings_rad_per_us": [4.0, -7.0, 2.0],
        "couplings": [
            {"left": 0, "right": 1, "exchange_coupling_rad_per_us": 11.0},
            {"left": 0, "right": 2, "exchange_coupling_rad_per_us": 6.0},
        ],
        "drives": [
            _drive(0, 0.0, _gaussian_pulse(0.5 * math.pi, 0.0015)),
            _drive(0, 0.013, _gaussian_pulse(0.5 * math.pi, 0.0015, phase=math.pi / 2)),
            _drive(1, 0.004, _square_pulse(0.35 * math.pi, 0.006, phase=0.25)),
            _drive(2, 0.007, _gaussian_pulse(0.6 * math.pi, 0.0015, detuning=40.0)),
        ],
        "environment": _rates(0.18, 0.03, 0.34, 0.05, 0.07),
        "total_simulation_time_us": 0.026,
    })
    cases.append(NetworkQutipCase(
        "three_transmon_staggered_schedule",
        "drive_schedule",
        scheduled,
        5e-7,
    ))

    layer = _base_payload(4)
    layer.update({
        "detunings_rad_per_us": [0.0, 9.0, -6.0, 3.0],
        "couplings": [
            {"left": left, "right": left + 1, "exchange_coupling_rad_per_us": 7.0}
            for left in range(3)
        ],
        "drives": [
            _drive(
                target,
                0.0,
                _gaussian_pulse(
                    0.5 * math.pi,
                    0.001,
                    phase=0.3 * target,
                    drag_beta=0.0009,
                ),
            )
            for target in range(4)
        ],
        "total_simulation_time_us": 0.008,
    })
    cases.append(NetworkQutipCase(
        "four_transmon_simultaneous_layer",
        "four_transmon_register",
        layer,
        1e-7,
    ))

    dissipative = _base_payload(4)
    dissipative.update({
        "initial_state": "1010",
        "anharmonicities_mhz": [-60.0, -72.0, -66.0, -80.0],
        "detunings_rad_per_us": [0.0, 5.0, -4.0, 8.0],
        "couplings": [
            {"left": left, "right": left + 1, "exchange_coupling_rad_per_us": 14.0}
            for left in range(3)
        ],
        "drives": [
            _drive(0, 0.0, _gaussian_pulse(1.6 * math.pi, 0.0008)),
            _drive(3, 0.0015, _gaussian_pulse(1.2 * math.pi, 0.0008, phase=0.9)),
        ],
        "environment": _rates(0.6, 0.09, 1.1, 0.14, 0.28),
        "total_simulation_time_us": 0.008,
    })
    cases.append(NetworkQutipCase(
        "four_transmon_dissipative_leakage",
        "dissipation_leakage",
        dissipative,
        5e-7,
    ))

    physical = _base_payload(3)
    physical.update({
        "frequencies_ghz": [5.0, 5.4, 4.7],
        "anharmonicities_mhz": [-100.0, -128.0, -92.0],
        "detunings_rad_per_us": [0.0, 6.0, -3.0],
        "couplings": [
            {"left": 0, "right": 1, "exchange_coupling_rad_per_us": 8.0},
            {"left": 1, "right": 2, "exchange_coupling_rad_per_us": 8.0},
        ],
        "drives": [
            _drive(1, 0.0, _gaussian_pulse(0.75 * math.pi, 0.002, drag_beta=0.001)),
        ],
        "environment": {
            "input_mode": "physical",
            "device_quality": 0.55,
            "temperature_mk": 40.0,
            "flux_noise_phi0": 3e-06,
            "qubit_frequency_ghz": 5.0,
            "t1_max_us": 60.0,
            "tphi_max_us": 40.0,
        },
        "total_simulation_time_us": 0.02,
    })
    cases.append(NetworkQutipCase(
        "three_transmon_per_transmon_physical_rates",
        "per_transmon_rates",
        physical,
        1e-7,
    ))
    return tuple(cases)


def run_network_qutip_audit() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    if not QUTIP_AVAILABLE:
        raise RuntimeError("QuTiP is unavailable in this validation environment")

    reports: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []
    for case in network_qutip_cases():
        report, case_rows = _run_case(case)
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
        "audit_id": NETWORK_QUTIP_AUDIT_ID,
        "pass": all(report["pass"] for report in reports),
        "model_id": NETWORK_QUTIP_MODEL_ID,
        "production_kernel": "numpy_dense",
        "reference_solver": "QuTiP mesolve / DOP853",
        "transmon_counts_covered": sorted({
            report["transmon_count"] for report in reports
        }),
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
            "QuTiP reconstructs H(t), the scheduled envelopes, DRAG quadratures, "
            "the pulse-detuning phase ramp, the tensor basis and every collapse "
            "operator from the public contract, and applies them as plain dense "
            "Lindblad terms. The production site-local jump kernel and effective "
            "Hamiltonian are never reused. For the physical-environment case the "
            "per-transmon rate values are read from the production response, "
            "because the thermal rate model is validated separately; the "
            "operator construction stays independent."
        ),
        "scope_limitations": [
            "This is a numerical implementation audit, not hardware calibration.",
            "The model remains a three-level local truncation under the RWA.",
            "Registers above four transmons are outside the contract.",
        ],
    }, rows


def specification_alignment() -> list[dict[str, str]]:
    return [
        {
            "item": "basis and tensor order",
            "production": "q0-most-significant labels 00..22 for N transmons",
            "qutip": "tensor(q0, q1, ...) with the last transmon as fast index",
            "alignment": "Qobj dims=[[3]*N,[3]*N]; no permutation is applied",
        },
        {
            "item": "units",
            "production": "time us, angular frequency rad/us, rates 1/us",
            "qutip": "solver time supplied in us with rad/us coefficients",
            "alignment": "no 2*pi rescaling is applied on either side",
        },
        {
            "item": "rotating-frame detuning",
            "production": "H_i=-Delta_i*n_i+alpha_i*n_i(n_i-1)/2 per transmon",
            "qutip": "the same operator expression is constructed directly",
            "alignment": "base detunings only; pulse detuning stays in the drive",
        },
        {
            "item": "pulse detuning",
            "production": "phase ramp phase_rad+detuning*local_time in the local frame",
            "qutip": "the same ramp is rebuilt inside the coefficient function",
            "alignment": "the ramp uses drive-local time, not absolute time",
        },
        {
            "item": "drive schedule",
            "production": "each drive is zero outside [start, start+duration]",
            "qutip": "coefficients rebuild the same inclusive finite support",
            "alignment": "overlapping drives on one transmon add in I and Q",
        },
        {
            "item": "drive I/Q convention",
            "production": "H_d=[(Omega_x-i Omega_y)a+h.c.]/2 on the target",
            "qutip": "Omega_x(a+a.dag())/2-i Omega_y(a-a.dag())/2",
            "alignment": "the algebraic forms are identical, including the Y sign",
        },
        {
            "item": "exchange coupling",
            "production": "sum over edges J_ij(a_i.dag()*a_j+a_i*a_j.dag())",
            "qutip": "same excitation-conserving RWA exchange on each edge",
            "alignment": "edges are read from the request; J is used in rad/us",
        },
        {
            "item": "collapse operators",
            "production": "site-local kernel sum_j l_j (x) conj(l_j) per transmon",
            "qutip": "each embedded jump operator is applied densely and separately",
            "alignment": "same five local jumps per transmon with sqrt(rate) amplitudes",
        },
        {
            "item": "relaxation term",
            "production": "folded into H-0.5j*sum_j l_j.dag()*l_j",
            "qutip": "standard mesolve anticommutator, never folded",
            "alignment": "the two forms are algebraically identical",
        },
        {
            "item": "solver and cleanup",
            "production": "fixed-step RK4 with per-step trace and Hermiticity cleanup",
            "qutip": "adaptive DOP853 mesolve without cleanup",
            "alignment": "density matrices are compared at identical sample times",
        },
    ]


def _run_case(case: NetworkQutipCase) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    request = CoupledTransmonNetworkPulseSimulateRequest.model_validate(
        copy.deepcopy(case.payload)
    )
    production = run_coupled_transmon_network_request(request)
    count = request.transmon_count
    dimension = NETWORK_QUTIP_LOCAL_DIMENSION ** count
    times = [float(value) for value in production["sample_times_us"]]
    rates = _case_rates(request, production)
    reference_states = _qutip_reference(request, times, rates)
    labels = network_basis_labels(count)
    computational = tuple(
        labels.index(label)
        for label in ("".join(bits) for bits in product("01", repeat=count))
    )

    case_rows = []
    for point, reference in zip(
        production["trajectory"],
        reference_states,
        strict=True,
    ):
        production_state = _response_matrix(point["density_matrix"])
        case_rows.append({
            "case": case.name,
            "category": case.category,
            "transmon_count": count,
            "hilbert_dimension": dimension,
            "time_us": float(point["time_us"]),
            "segment": point["segment"],
            "tolerance": case.tolerance,
            **_comparison_metrics(production_state, reference, computational),
        })

    maximum = max(row["max_element_difference"] for row in case_rows)
    return {
        "name": case.name,
        "category": case.category,
        "transmon_count": count,
        "hilbert_dimension": dimension,
        "tolerance": case.tolerance,
        "pass": maximum <= case.tolerance,
        "maximum_density_matrix_element_error": maximum,
        "maximum_trace_distance": max(row["trace_distance"] for row in case_rows),
        "maximum_leakage_difference": max(
            row["leakage_difference"] for row in case_rows
        ),
        "production_internal_steps": production["step_policy"][
            "estimated_internal_step_count"
        ],
        "production_runtime_ms": production["diagnostics"]["api_runtime_ms"],
        "checkpoint_count": len(case_rows),
        "maximum_recorded_production_leakage": production["leakage"][
            "maximum_recorded_leakage_probability"
        ],
        "parameters": {
            "initial_state": request.initial_state,
            "anharmonicities_mhz": request.anharmonicities_mhz,
            "detunings_rad_per_us": request.detunings_rad_per_us,
            "couplings": [item.model_dump() for item in request.couplings],
            "drive_count": len(request.drives),
            "drive_targets": [item.target for item in request.drives],
            "drive_start_times_us": [item.start_time_us for item in request.drives],
            "environment_input_mode": request.environment.input_mode,
            "total_simulation_time_us": request.total_simulation_time_us,
        },
    }, case_rows


def _case_rates(request, production) -> tuple[dict[str, float], ...]:
    """Return per-transmon rates for the QuTiP side.

    Direct-rate requests carry the rates in the contract, so they are read
    straight from the request. Physical requests derive them from the thermal
    model that has its own validation, so the audit reuses the production
    values and keeps only the operator construction independent.
    """

    if request.environment.input_mode == "direct_rates":
        return tuple(
            {
                "gamma_10_down_per_us": request.environment.gamma_10_down_per_us,
                "gamma_01_up_per_us": request.environment.gamma_01_up_per_us,
                "gamma_21_down_per_us": request.environment.gamma_21_down_per_us,
                "gamma_12_up_per_us": request.environment.gamma_12_up_per_us,
                "gamma_phi_adjacent_per_us": (
                    request.environment.gamma_phi_adjacent_per_us
                ),
            }
            for _ in range(request.transmon_count)
        )
    return tuple(
        {
            key: float(entry[key])
            for key in (
                "gamma_10_down_per_us",
                "gamma_01_up_per_us",
                "gamma_21_down_per_us",
                "gamma_12_up_per_us",
                "gamma_phi_adjacent_per_us",
            )
        }
        for entry in production["rates"]
    )


def _qutip_reference(request, times, rates) -> list[np.ndarray]:
    count = request.transmon_count
    local_dimensions = [NETWORK_QUTIP_LOCAL_DIMENSION] * count
    annihilation = qutip.destroy(NETWORK_QUTIP_LOCAL_DIMENSION)
    identity = qutip.qeye(NETWORK_QUTIP_LOCAL_DIMENSION)
    number = annihilation.dag() * annihilation

    def embed(operator, subsystem):
        factors = [identity] * count
        factors[subsystem] = operator
        return qutip.tensor(factors)

    embedded_a = [embed(annihilation, index) for index in range(count)]
    embedded_n = [embed(number, index) for index in range(count)]
    total_identity = qutip.tensor([identity] * count)

    static = 0.0 * total_identity
    for index in range(count):
        alpha = 2.0 * math.pi * request.anharmonicities_mhz[index]
        static += -request.detunings_rad_per_us[index] * embedded_n[index]
        static += 0.5 * alpha * embedded_n[index] * (
            embedded_n[index] - total_identity
        )
    for coupling in request.couplings:
        static += coupling.exchange_coupling_rad_per_us * (
            embedded_a[coupling.left].dag() * embedded_a[coupling.right]
            + embedded_a[coupling.left] * embedded_a[coupling.right].dag()
        )

    hamiltonian: list[Any] = [static]
    for drive in request.drives:
        local_a = embedded_a[drive.target]
        x_operator = 0.5 * (local_a + local_a.dag())
        y_operator = -0.5j * (local_a - local_a.dag())

        def x_coefficient(time_us, args=None, *, drive=drive):
            del args
            return _independent_quadratures(drive, float(time_us))[0]

        def y_coefficient(time_us, args=None, *, drive=drive):
            del args
            return _independent_quadratures(drive, float(time_us))[1]

        hamiltonian.extend(
            ([x_operator, x_coefficient], [y_operator, y_coefficient])
        )

    rho0 = qutip.basis(
        local_dimensions,
        [int(level) for level in request.initial_state],
    ).proj()
    c_ops = _independent_collapse_operators(rates, embed, annihilation, number)
    options = {**DEFAULT_OPTIONS, "max_step": _reference_max_step(request)}
    result = qutip.mesolve(hamiltonian, rho0, times, c_ops=c_ops, options=options)
    return [np.asarray(state.full(), dtype=complex) for state in result.states]


def _independent_collapse_operators(rates, embed, annihilation, number):
    del annihilation
    ground = qutip.basis(NETWORK_QUTIP_LOCAL_DIMENSION, 0)
    first = qutip.basis(NETWORK_QUTIP_LOCAL_DIMENSION, 1)
    second = qutip.basis(NETWORK_QUTIP_LOCAL_DIMENSION, 2)
    transition_10 = ground * first.dag()
    transition_21 = first * second.dag()
    operators = []
    for subsystem, local_rates in enumerate(rates):
        for rate, operator in (
            (local_rates["gamma_10_down_per_us"], transition_10),
            (local_rates["gamma_01_up_per_us"], transition_10.dag()),
            (local_rates["gamma_21_down_per_us"], transition_21),
            (local_rates["gamma_12_up_per_us"], transition_21.dag()),
            (2.0 * local_rates["gamma_phi_adjacent_per_us"], number),
        ):
            if rate <= 0.0:
                continue
            operators.append(math.sqrt(rate) * embed(operator, subsystem))
    return operators


def _independent_quadratures(drive, time_us: float) -> tuple[float, float]:
    pulse = drive.pulse
    local_time = time_us - drive.start_time_us
    duration = pulse.derived_pulse_duration_us
    tolerance = 1e-14
    if local_time < -tolerance or local_time > duration + tolerance:
        return 0.0, 0.0
    local_time = min(duration, max(0.0, local_time))
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
        area_factor = (
            sigma
            * math.sqrt(2.0 * math.pi)
            * math.erf(truncation / math.sqrt(2.0))
        )
        peak = (
            pulse.target_rotation_angle_rad / area_factor
            if pulse.amplitude_mode == "target_rotation_angle"
            else pulse.peak_amplitude_rad_per_us
        )
        normalized = (local_time - truncation * sigma) / sigma
        amplitude = peak * math.exp(-0.5 * normalized * normalized)
        quadrature = pulse.drag_beta_us * (-normalized * amplitude / sigma)
    phase = pulse.phase_rad + pulse.detuning_rad_per_us * local_time
    cosine = math.cos(phase)
    sine = math.sin(phase)
    return (
        amplitude * cosine - quadrature * sine,
        amplitude * sine + quadrature * cosine,
    )


def _reference_max_step(request) -> float:
    pulse_scales = []
    for drive in request.drives:
        pulse = drive.pulse
        if pulse.shape == "gaussian":
            pulse_scales.append(pulse.sigma_us / 64.0)
        else:
            pulse_scales.append(pulse.pulse_duration_us / 128.0)
    spectral_scale = max(
        abs(2.0 * math.pi * value) for value in request.anharmonicities_mhz
    ) + 2.0 * max(
        (item.exchange_coupling_rad_per_us for item in request.couplings),
        default=0.0,
    )
    return min(*pulse_scales, 0.015 / max(spectral_scale, 1.0))


def _comparison_metrics(production, reference, computational_indices):
    difference = production - reference
    singular_values = np.linalg.svd(difference, compute_uv=False)
    production_leakage = 1.0 - sum(
        production[index, index].real for index in computational_indices
    )
    reference_leakage = 1.0 - sum(
        reference[index, index].real for index in computational_indices
    )
    return {
        "max_element_difference": float(np.max(np.abs(difference))),
        "frobenius_difference": float(np.linalg.norm(difference)),
        "trace_distance": float(0.5 * np.sum(singular_values)),
        "population_difference": float(np.max(np.abs(np.diag(difference)))),
        "purity_difference": float(abs(
            np.trace(production @ production).real
            - np.trace(reference @ reference).real
        )),
        "leakage_difference": float(abs(production_leakage - reference_leakage)),
        "production_trace_error": float(abs(np.trace(production) - 1.0)),
        "qutip_trace_error": float(abs(np.trace(reference) - 1.0)),
        "production_minimum_eigenvalue": float(
            np.min(np.linalg.eigvalsh(production))
        ),
        "qutip_minimum_eigenvalue": float(np.min(np.linalg.eigvalsh(reference))),
    }


def _response_matrix(matrix) -> np.ndarray:
    return np.asarray([
        [complex(value["real"], value["imag"]) for value in row]
        for row in matrix
    ], dtype=complex)


def _base_payload(transmon_count: int) -> dict[str, Any]:
    return {
        "model_id": NETWORK_QUTIP_MODEL_ID,
        "transmon_count": transmon_count,
        "initial_state": "0" * transmon_count,
        "frequencies_ghz": [5.0 + 0.1 * index for index in range(transmon_count)],
        "anharmonicities_mhz": [
            -100.0 - 6.0 * index for index in range(transmon_count)
        ],
        "detunings_rad_per_us": [0.0] * transmon_count,
        "couplings": [],
        "drives": [],
        "total_simulation_time_us": 0.016,
        "backend": "python",
        "evolution_method": "fixed_step_rk4",
        "environment": _rates(0.0, 0.0, 0.0, 0.0, 0.0),
        "snapshot_options": {"uniform_count": 9, "custom_times_us": []},
    }


def _drive(target: int, start_time_us: float, pulse: dict[str, Any]):
    return {"target": target, "start_time_us": start_time_us, "pulse": pulse}


def _gaussian_pulse(angle, sigma, *, phase=0.0, drag_beta=0.0, detuning=0.0):
    return {
        "shape": "gaussian",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": angle,
        "sigma_us": sigma,
        "truncation_sigma": 4.0,
        "phase_rad": phase,
        "detuning_rad_per_us": detuning,
        "drag_beta_us": drag_beta,
    }


def _square_pulse(angle, duration, *, phase=0.0, detuning=0.0):
    return {
        "shape": "square",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": angle,
        "pulse_duration_us": duration,
        "phase_rad": phase,
        "detuning_rad_per_us": detuning,
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
