"""Analytic validation of the production pure-dephasing convention."""

from __future__ import annotations

import math
import unittest

from core.backend_boundary import PYTHON_DENSE_BACKEND
from core.gates import (
    SIGMA_MINUS,
    SIGMA_PLUS,
    Z,
    adjoint,
    multi_qubit_physical_collapse_operators,
    prepare_collapse_operators,
    scale,
    trace,
    zero_hamiltonian,
)
from core.simulator import _KernelStats, _evolve_stable


RATE_CASES = (
    {"name": "V4-1", "gamma_phi_per_us": 0.01},
    {"name": "V4-2", "gamma_phi_per_us": 0.05},
    {"name": "V4-3", "gamma_phi_per_us": 0.10},
)
NORMAL_INTERNAL_STEP_US = 0.5
REFINED_INTERNAL_STEP_US = 0.25
SAMPLE_MULTIPLIERS = (0.0, 0.25, 0.5, 1.0, 2.0, 3.0, 5.0)

MAX_ABS_ERROR_COHERENCE = 1e-6
RMSE_COHERENCE = 1e-7
MAX_POPULATION_DRIFT = 1e-10
MAX_TRACE_ERROR = 1e-10
MAX_HERMITICITY_ERROR = 1e-10
MINIMUM_EIGENVALUE = -1e-10
MAX_IMAGINARY_COHERENCE = 1e-10
MAX_RELATIVE_GAMMA_FIT_ERROR = 1e-4
MAX_STEP_REFINEMENT_DIFFERENCE = 1e-8


def case_times_us(gamma_phi_per_us: float) -> tuple[float, ...]:
    tphi_us = 1.0 / gamma_phi_per_us
    return tuple(multiplier * tphi_us for multiplier in SAMPLE_MULTIPLIERS)


def run_direct_rate_case(
    gamma_phi_per_us: float,
    times_us: tuple[float, ...],
    *,
    integration_step_us: float = NORMAL_INTERNAL_STEP_US,
) -> list[dict[str, float]]:
    """Evolve |+><+| through the production Lindblad solver with only dephasing."""

    collapse_ops = multi_qubit_physical_collapse_operators(
        1,
        0.0,
        0.0,
        gamma_phi_per_us,
    )
    state = [[0.5 + 0.0j, 0.5 + 0.0j], [0.5 + 0.0j, 0.5 + 0.0j]]
    cached_collapse_ops = prepare_collapse_operators(collapse_ops)
    hamiltonian = zero_hamiltonian(2)
    kernel_stats = _KernelStats(PYTHON_DENSE_BACKEND)
    rows: list[dict[str, float]] = []

    for index, requested_time_us in enumerate(times_us):
        if index > 0:
            duration_us = requested_time_us - times_us[index - 1]
            segment_count = max(1, math.ceil(duration_us / integration_step_us))
            segment_duration_us = duration_us / segment_count
            for _ in range(segment_count):
                state = _evolve_stable(
                    state,
                    hamiltonian,
                    cached_collapse_ops,
                    segment_duration_us,
                    gamma_phi_per_us,
                    kernel_stats,
                    blocked_by_sampling=False,
                )
        rows.append(_snapshot_metrics(state, requested_time_us, gamma_phi_per_us))
    return rows


def summarize_case(rows: list[dict[str, float]], gamma_phi_per_us: float) -> dict[str, float]:
    rho01_errors = [row["absolute_error_rho01"] for row in rows]
    rho10_errors = [row["absolute_error_rho10"] for row in rows]
    return {
        "max_abs_error_rho01": max(rho01_errors),
        "rmse_rho01": math.sqrt(sum(error * error for error in rho01_errors) / len(rows)),
        "max_abs_error_rho10": max(rho10_errors),
        "max_population_drift": max(
            max(row["absolute_error_rho00"], row["absolute_error_rho11"])
            for row in rows
        ),
        "max_trace_error": max(row["trace_error"] for row in rows),
        "max_hermiticity_error": max(row["hermiticity_error"] for row in rows),
        "minimum_eigenvalue": min(row["minimum_eigenvalue"] for row in rows),
        "max_imaginary_coherence": max(
            max(abs(row["simulated_rho01_imag"]), abs(row["simulated_rho10_imag"]))
            for row in rows
        ),
        "fitted_gamma_phi_per_us": _fit_dephasing_rate(rows),
        "relative_gamma_fit_error": abs(_fit_dephasing_rate(rows) - gamma_phi_per_us)
        / gamma_phi_per_us,
    }


def validate_case(rows: list[dict[str, float]], summary: dict[str, float]) -> None:
    assert all(row["requested_time_us"] == row["time_us"] for row in rows)
    assert all(math.isfinite(value) for row in rows for value in row.values())
    assert all(abs(row["simulated_rho01_imag"]) <= MAX_IMAGINARY_COHERENCE for row in rows)
    assert all(abs(row["simulated_rho10_imag"]) <= MAX_IMAGINARY_COHERENCE for row in rows)
    assert all(row["simulated_rho01_real"] >= -MAX_IMAGINARY_COHERENCE for row in rows)
    assert all(row["simulated_rho10_real"] >= -MAX_IMAGINARY_COHERENCE for row in rows)
    assert all(
        abs(row["bloch_x"] - row["analytic_bloch_x"]) <= MAX_ABS_ERROR_COHERENCE
        and abs(row["bloch_y"]) <= MAX_IMAGINARY_COHERENCE
        and abs(row["bloch_z"]) <= MAX_POPULATION_DRIFT
        for row in rows
    )
    assert all(0.5 - 1e-12 <= row["purity"] <= 1.0 + 1e-12 for row in rows)
    assert all(left["purity"] >= right["purity"] - 1e-12 for left, right in zip(rows, rows[1:]))
    assert summary["max_abs_error_rho01"] <= MAX_ABS_ERROR_COHERENCE
    assert summary["rmse_rho01"] <= RMSE_COHERENCE
    assert summary["max_abs_error_rho10"] <= MAX_ABS_ERROR_COHERENCE
    assert summary["max_population_drift"] <= MAX_POPULATION_DRIFT
    assert summary["max_trace_error"] <= MAX_TRACE_ERROR
    assert summary["max_hermiticity_error"] <= MAX_HERMITICITY_ERROR
    assert summary["minimum_eigenvalue"] >= MINIMUM_EIGENVALUE
    assert summary["max_imaginary_coherence"] <= MAX_IMAGINARY_COHERENCE
    assert summary["relative_gamma_fit_error"] <= MAX_RELATIVE_GAMMA_FIT_ERROR


class PureDephasingValidationTest(unittest.TestCase):
    def test_collapse_operator_uses_half_rate_sigma_z_coefficient(self) -> None:
        gamma_phi_per_us = 0.05
        operators = multi_qubit_physical_collapse_operators(1, 0.0, 0.0, gamma_phi_per_us)

        self.assertEqual([scale(math.sqrt(gamma_phi_per_us / 2.0), Z)], operators)
        self.assertNotEqual(operators[0], scale(math.sqrt(gamma_phi_per_us), Z))
        self.assertNotEqual(operators[0], scale(math.sqrt(gamma_phi_per_us), SIGMA_MINUS))
        self.assertNotEqual(operators[0], scale(math.sqrt(gamma_phi_per_us), SIGMA_PLUS))
        self.assertEqual(operators[0], adjoint(adjoint(operators[0])))

    def test_direct_rate_cases_match_pure_dephasing_analytic_solution(self) -> None:
        for case in RATE_CASES:
            with self.subTest(case=case["name"]):
                gamma_phi_per_us = float(case["gamma_phi_per_us"])
                rows = run_direct_rate_case(gamma_phi_per_us, case_times_us(gamma_phi_per_us))
                validate_case(rows, summarize_case(rows, gamma_phi_per_us))

    def test_refined_internal_step_matches_normal_policy(self) -> None:
        gamma_phi_per_us = float(RATE_CASES[1]["gamma_phi_per_us"])
        times_us = case_times_us(gamma_phi_per_us)
        normal = run_direct_rate_case(gamma_phi_per_us, times_us)
        refined = run_direct_rate_case(
            gamma_phi_per_us,
            times_us,
            integration_step_us=REFINED_INTERNAL_STEP_US,
        )
        max_difference = max(
            max(
                abs(left[key] - right[key])
                for key in ("simulated_rho00", "simulated_rho01_real", "simulated_rho11")
            )
            for left, right in zip(normal, refined)
        )
        self.assertLessEqual(max_difference, MAX_STEP_REFINEMENT_DIFFERENCE)


def _snapshot_metrics(state, time_us: float, gamma_phi_per_us: float) -> dict[str, float]:
    rho00 = float(state[0][0].real)
    rho01 = state[0][1]
    rho10 = state[1][0]
    rho11 = float(state[1][1].real)
    analytic_coherence = 0.5 * math.exp(-gamma_phi_per_us * time_us)
    bloch_x = float((rho01 + rho10).real)
    bloch_y = float((rho10 - rho01).imag)
    eigenvalues = _two_by_two_eigenvalues(state)
    return {
        "time_us": time_us,
        "requested_time_us": time_us,
        "t_over_tphi": gamma_phi_per_us * time_us,
        "simulated_rho00": rho00,
        "analytic_rho00": 0.5,
        "absolute_error_rho00": abs(rho00 - 0.5),
        "simulated_rho11": rho11,
        "analytic_rho11": 0.5,
        "absolute_error_rho11": abs(rho11 - 0.5),
        "simulated_rho01_real": float(rho01.real),
        "simulated_rho01_imag": float(rho01.imag),
        "simulated_rho01_abs": abs(rho01),
        "analytic_rho01_real": analytic_coherence,
        "analytic_rho01_abs": analytic_coherence,
        "absolute_error_rho01": abs(rho01 - analytic_coherence),
        "simulated_rho10_real": float(rho10.real),
        "simulated_rho10_imag": float(rho10.imag),
        "simulated_rho10_abs": abs(rho10),
        "analytic_rho10_real": analytic_coherence,
        "analytic_rho10_abs": analytic_coherence,
        "absolute_error_rho10": abs(rho10 - analytic_coherence),
        "bloch_x": bloch_x,
        "bloch_y": bloch_y,
        "bloch_z": rho00 - rho11,
        "analytic_bloch_x": math.exp(-gamma_phi_per_us * time_us),
        "trace_error": abs(trace(state) - 1.0),
        "hermiticity_error": max(
            abs(state[row][column] - state[column][row].conjugate())
            for row in range(2)
            for column in range(2)
        ),
        "minimum_eigenvalue": min(eigenvalues),
        "purity": float(sum(abs(state[row][column]) ** 2 for row in range(2) for column in range(2))),
    }


def _two_by_two_eigenvalues(matrix) -> tuple[float, float]:
    center = 0.5 * (matrix[0][0].real + matrix[1][1].real)
    radius = math.sqrt((0.5 * (matrix[0][0].real - matrix[1][1].real)) ** 2 + abs(matrix[0][1]) ** 2)
    return center - radius, center + radius


def _fit_dephasing_rate(rows: list[dict[str, float]]) -> float:
    filtered = [row for row in rows if row["simulated_rho01_abs"] > 1e-12]
    times = [row["time_us"] for row in filtered]
    log_coherence = [math.log(2.0 * row["simulated_rho01_abs"]) for row in filtered]
    mean_time = sum(times) / len(times)
    mean_log = sum(log_coherence) / len(log_coherence)
    denominator = sum((time - mean_time) ** 2 for time in times)
    slope = sum((time - mean_time) * (value - mean_log) for time, value in zip(times, log_coherence)) / denominator
    return -slope


if __name__ == "__main__":
    unittest.main()
