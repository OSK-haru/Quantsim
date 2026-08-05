"""Numerical audit for the coupled two-transmon Pulse model."""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.pulse_models import CoupledTransmonPairPulseSimulateRequest
from api.pulse_transmon_pair_service import run_coupled_transmon_pair_request
from core.gates import Matrix
from core.pulse_envelopes import SquarePulseEnvelope
from core.pulse_evolution import evolve_time_dependent_segment
from core.pulse_transmon_pair import (
    CoupledTransmonPairHamiltonian,
    pair_initial_density_matrix,
)
from core.quasi_static_noise import correlated_gaussian_detuning_pair_samples
from core.rust_dense_kernel import is_rust_kernel_available


def run_audit() -> dict[str, object]:
    backend = "rust" if is_rust_kernel_available() else "python"
    convergence = _step_convergence(backend)
    exchange = _exchange_analytic_check(backend)
    simultaneous = _simultaneous_drive_check(backend)
    parity = _backend_parity() if is_rust_kernel_available() else None
    cptp_parity = _cptp_backend_parity() if is_rust_kernel_available() else None
    cptp = _cptp_check(backend)
    covariance = _covariance_check()
    checks = {
        "step_refinement_contracts": convergence["fine_vs_reference_frobenius"]
        < convergence["coarse_vs_reference_frobenius"],
        "exchange_matches_sin_squared": exchange["absolute_error"] < 2e-5,
        "simultaneous_drive_product_limit": simultaneous["p11_absolute_error"] < 2e-3,
        "python_rust_parity": parity is None or parity["frobenius_difference"] < 1e-10,
        "python_rust_cptp_parity": cptp_parity is None or cptp_parity["frobenius_difference"] < 1e-9,
        "cptp_all_maps_pass": cptp["all_maps_cptp"],
        "cptp_rk4_agreement": cptp["frobenius_difference"] < 5e-4,
        "gaussian_covariance_reproduced": covariance["maximum_covariance_error"] < 1e-12,
    }
    return {
        "audit_id": "coupled_transmon_pair_numerical_audit_v1",
        "model_id": "driven_coupled_transmon_pair_rwa_experimental_v1",
        "backend_available": backend,
        "checks": checks,
        "all_checks_pass": all(checks.values()),
        "results": {
            "step_convergence": convergence,
            "exchange_analytic": exchange,
            "simultaneous_drive": simultaneous,
            "python_rust_parity": parity,
            "python_rust_cptp_parity": cptp_parity,
            "explicit_cptp": cptp,
            "quasi_static_covariance": covariance,
        },
        "scope": [
            "two transmons with three local levels",
            "short-time bounded fixtures",
            "not a hardware calibration validation",
        ],
    }


def _step_convergence(backend: str) -> dict[str, float]:
    states = {
        label: _closed_pair_state(step, backend)
        for label, step in (
            ("coarse", 1e-4),
            ("fine", 5e-5),
            ("reference", 2.5e-5),
        )
    }
    return {
        "coarse_step_us": 1e-4,
        "fine_step_us": 5e-5,
        "reference_step_us": 2.5e-5,
        "coarse_vs_reference_frobenius": _frobenius_difference(
            states["coarse"], states["reference"]
        ),
        "fine_vs_reference_frobenius": _frobenius_difference(
            states["fine"], states["reference"]
        ),
    }


def _closed_pair_state(step: float, backend: str) -> Matrix:
    duration = 0.002
    hamiltonian = CoupledTransmonPairHamiltonian(
        envelope=SquarePulseEnvelope.from_target_rotation_angle(0.25, duration),
        secondary_envelope=SquarePulseEnvelope.from_target_rotation_angle(0.15, duration),
        anharmonicities_rad_per_us=(-600.0, -650.0),
        detunings_rad_per_us=(0.0, 20.0),
        exchange_coupling_rad_per_us=4.0,
        drive_target=0,
        secondary_phase_rad=0.3,
    )
    return evolve_time_dependent_segment(
        pair_initial_density_matrix("00"),
        hamiltonian,
        (),
        duration,
        step,
        checkpoint_times_us=(0.0, duration),
        backend=backend,
    ).state


def _exchange_analytic_check(backend: str) -> dict[str, float]:
    duration = 0.01
    coupling = 20.0
    hamiltonian = CoupledTransmonPairHamiltonian(
        envelope=SquarePulseEnvelope(0.0, duration),
        anharmonicities_rad_per_us=(-600.0, -650.0),
        detunings_rad_per_us=(0.0, 0.0),
        exchange_coupling_rad_per_us=coupling,
        drive_target=0,
    )
    state = evolve_time_dependent_segment(
        pair_initial_density_matrix("10"),
        hamiltonian,
        (),
        duration,
        2.5e-5,
        checkpoint_times_us=(duration,),
        backend=backend,
    ).state
    simulated = float(state[1][1].real)
    analytic = math.sin(coupling * duration) ** 2
    return {
        "simulated_p01": simulated,
        "analytic_sin2_Jt": analytic,
        "absolute_error": abs(simulated - analytic),
    }


def _simultaneous_drive_check(backend: str) -> dict[str, float]:
    payload = _short_payload()
    payload["backend"] = backend
    payload["exchange_coupling_rad_per_us"] = 0.0
    payload["detunings_rad_per_us"] = [0.0, 0.0]
    payload["pulse"]["target_rotation_angle_rad"] = 0.2
    payload["secondary_pulse"] = {
        **payload["pulse"],
        "target_rotation_angle_rad": 0.3,
        "phase_rad": 0.4,
    }
    response = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
    )
    simulated = response["final"]["joint_populations"]["11"]
    ideal = math.sin(0.2 / 2) ** 2 * math.sin(0.3 / 2) ** 2
    return {
        "simulated_p11": simulated,
        "ideal_two_level_product_p11": ideal,
        "p11_absolute_error": abs(simulated - ideal),
    }


def _backend_parity() -> dict[str, float]:
    python_payload = _short_payload()
    rust_payload = _short_payload()
    python_payload["backend"] = "python"
    rust_payload["backend"] = "rust"
    python = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(python_payload)
    )
    rust = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(rust_payload)
    )
    return {
        "frobenius_difference": _response_frobenius_difference(python, rust),
    }


def _cptp_check(backend: str) -> dict[str, object]:
    rk4_payload = _short_payload()
    cptp_payload = _short_payload()
    rk4_payload["backend"] = backend
    cptp_payload["backend"] = backend
    cptp_payload["evolution_method"] = "explicit_cptp"
    rk4 = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(rk4_payload)
    )
    cptp = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(cptp_payload)
    )
    audit = cptp["diagnostics"]["evolution"]["open_pulse_audit"]
    return {
        "frobenius_difference": _response_frobenius_difference(rk4, cptp),
        "all_maps_cptp": audit["all_maps_cptp"],
        "minimum_choi_eigenvalue": audit["minimum_choi_eigenvalue"],
        "maximum_tp_frobenius_error": (
            audit["maximum_trace_preservation_frobenius_error"]
        ),
        "interval_count": audit["interval_count"],
    }


def _cptp_backend_parity() -> dict[str, float]:
    python_payload = _short_payload()
    rust_payload = _short_payload()
    python_payload.update({"backend": "python", "evolution_method": "explicit_cptp"})
    rust_payload.update({"backend": "rust", "evolution_method": "explicit_cptp"})
    python = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(python_payload)
    )
    rust = run_coupled_transmon_pair_request(
        CoupledTransmonPairPulseSimulateRequest.model_validate(rust_payload)
    )
    return {"frobenius_difference": _response_frobenius_difference(python, rust)}


def _covariance_check() -> dict[str, object]:
    sigma0, sigma1, correlation = 2.0, 3.0, 0.4
    samples = correlated_gaussian_detuning_pair_samples(
        (sigma0, sigma1), correlation, 5
    )
    covariance = [
        sum(offsets[row] * offsets[column] * weight for offsets, weight in samples)
        for row in range(2) for column in range(2)
    ]
    expected = [
        sigma0 ** 2,
        correlation * sigma0 * sigma1,
        correlation * sigma0 * sigma1,
        sigma1 ** 2,
    ]
    return {
        "sample_count": len(samples),
        "computed_covariance_row_major": covariance,
        "expected_covariance_row_major": expected,
        "maximum_covariance_error": max(
            abs(left - right) for left, right in zip(covariance, expected, strict=True)
        ),
    }


def _short_payload() -> dict[str, object]:
    return {
        "model_id": "driven_coupled_transmon_pair_rwa_experimental_v1",
        "initial_state": "00",
        "anharmonicities_mhz": [-100.0, -110.0],
        "detunings_rad_per_us": [0.0, 20.0],
        "exchange_coupling_rad_per_us": 4.0,
        "drive_target": 0,
        "pulse": {
            "shape": "square",
            "amplitude_mode": "target_rotation_angle",
            "target_rotation_angle_rad": 0.2,
            "pulse_duration_us": 0.002,
            "phase_rad": 0.0,
            "detuning_rad_per_us": 0.0,
            "drag_beta_us": 0.0,
        },
        "total_simulation_time_us": 0.002,
        "environment": {
            "input_mode": "direct_rates",
            "gamma_10_down_per_us": 0.0,
            "gamma_01_up_per_us": 0.0,
            "gamma_21_down_per_us": 0.0,
            "gamma_12_up_per_us": 0.0,
            "gamma_phi_adjacent_per_us": 0.0,
        },
        "snapshot_options": {
            "uniform_count": 3,
            "custom_times_us": [0.002],
        },
    }


def _response_frobenius_difference(left, right) -> float:
    return math.sqrt(sum(
        (left_value["real"] - right_value["real"]) ** 2
        + (left_value["imag"] - right_value["imag"]) ** 2
        for left_row, right_row in zip(
            left["final"]["density_matrix"],
            right["final"]["density_matrix"],
            strict=True,
        )
        for left_value, right_value in zip(left_row, right_row, strict=True)
    ))


def _frobenius_difference(left: Matrix, right: Matrix) -> float:
    return math.sqrt(sum(
        abs(left[row][column] - right[row][column]) ** 2
        for row in range(len(left))
        for column in range(len(left))
    ))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = run_audit()
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if not result["all_checks_pass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
