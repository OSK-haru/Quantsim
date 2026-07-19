from __future__ import annotations

import math
import unittest

from core.backend_boundary import PYTHON_DENSE_BACKEND
from core.gates import (
    SIGMA_MINUS,
    adjoint,
    initial_density_matrix,
    multi_qubit_physical_collapse_operators,
    prepare_collapse_operators,
    scale,
    trace,
    zero_hamiltonian,
)
from core.simulator import (
    _KernelStats,
    _evolve_stable,
)


RATE_CASES = (
    {"name": "V3-1", "gamma_down_per_us": 0.01, "times_us": (0.0, 25.0, 50.0, 100.0, 200.0, 300.0, 500.0)},
    {"name": "V3-2", "gamma_down_per_us": 0.05, "times_us": (0.0, 5.0, 10.0, 20.0, 40.0, 60.0, 100.0)},
    {"name": "V3-3", "gamma_down_per_us": 0.10, "times_us": (0.0, 2.5, 5.0, 10.0, 20.0, 30.0, 50.0)},
)

MAX_ABS_ERROR_P1 = 1e-6
RMSE_P1 = 1e-7
MAX_OFF_DIAGONAL_ABS = 1e-10
MAX_TRACE_ERROR = 1e-10
MAX_HERMITICITY_ERROR = 1e-10
MINIMUM_EIGENVALUE = -1e-10
MAX_RELATIVE_GAMMA_FIT_ERROR = 1e-4
MAX_STEP_REFINEMENT_DIFFERENCE = 1e-8


def run_direct_rate_case(
    gamma_down_per_us: float,
    times_us: tuple[float, ...],
    *,
    integration_step_us: float = 0.5,
) -> list[dict[str, float | None]]:
    """Evolve |1><1| with one known downward collapse operator."""

    collapse_ops = multi_qubit_physical_collapse_operators(
        1,
        gamma_down_per_us,
        0.0,
        0.0,
    )
    cached_collapse_ops = prepare_collapse_operators(collapse_ops)
    hamiltonian = zero_hamiltonian(2)
    kernel_stats = _KernelStats(PYTHON_DENSE_BACKEND)
    state = initial_density_matrix(["1"])
    rows: list[dict[str, float | None]] = []

    for index, requested_time_us in enumerate(times_us):
        if index > 0:
            dt = requested_time_us - times_us[index - 1]
            segment_count = max(1, math.ceil(dt / integration_step_us))
            segment_dt = dt / segment_count
            for _ in range(segment_count):
                state = _evolve_stable(
                    state,
                    hamiltonian,
                    cached_collapse_ops,
                    segment_dt,
                    gamma_down_per_us,
                    kernel_stats,
                    blocked_by_sampling=False,
                )

        rows.append(_snapshot_metrics(
            state,
            requested_time_us=requested_time_us,
            gamma_down_per_us=gamma_down_per_us,
        ))
    return rows


def summarize_case(
    rows: list[dict[str, float | None]],
    gamma_down_per_us: float,
) -> dict[str, float | None]:
    p1_errors = [float(row["absolute_error_p1"]) for row in rows]
    p0_errors = [float(row["absolute_error_p0"]) for row in rows]
    off_diagonal = [float(row["rho01_abs"]) for row in rows] + [
        float(row["rho10_abs"]) for row in rows
    ]
    trace_errors = [float(row["trace_error"]) for row in rows]
    hermiticity_errors = [float(row["hermiticity_error"]) for row in rows]
    minimum_eigenvalues = [float(row["minimum_eigenvalue"]) for row in rows]
    fit_rows = [
        row for row in rows
        if float(row["simulated_p1"]) > 1e-14
    ]
    fitted_gamma = _fit_decay_rate(fit_rows)
    return {
        "max_abs_error_p1": max(p1_errors),
        "rmse_p1": math.sqrt(sum(error * error for error in p1_errors) / len(p1_errors)),
        "max_abs_error_p0": max(p0_errors),
        "max_off_diagonal_abs": max(off_diagonal),
        "max_trace_error": max(trace_errors),
        "max_hermiticity_error": max(hermiticity_errors),
        "minimum_density_eigenvalue": min(minimum_eigenvalues),
        "fitted_gamma_down_per_us": fitted_gamma,
        "relative_gamma_fit_error": (
            None
            if fitted_gamma is None
            else abs(fitted_gamma - gamma_down_per_us) / gamma_down_per_us
        ),
    }


def validate_case(rows: list[dict[str, float | None]], summary: dict[str, float | None]) -> None:
    first = rows[0]
    t1_row = next(row for row in rows if math.isclose(float(row["t_over_t1"]), 1.0))
    last = rows[-1]
    assert float(first["simulated_p1"]) == 1.0
    assert float(first["simulated_p0"]) == 0.0
    assert all(
        float(left["simulated_p1"]) >= float(right["simulated_p1"]) - 1e-12
        for left, right in zip(rows, rows[1:])
    )
    assert all(
        float(left["simulated_p0"]) <= float(right["simulated_p0"]) + 1e-12
        for left, right in zip(rows, rows[1:])
    )
    assert abs(float(t1_row["simulated_p1"]) - math.exp(-1.0)) <= MAX_ABS_ERROR_P1
    assert abs(float(last["simulated_p1"]) - math.exp(-5.0)) <= MAX_ABS_ERROR_P1
    assert float(summary["max_abs_error_p1"]) <= MAX_ABS_ERROR_P1
    assert float(summary["rmse_p1"]) <= RMSE_P1
    assert float(summary["max_abs_error_p0"]) <= MAX_ABS_ERROR_P1
    assert float(summary["max_off_diagonal_abs"]) <= MAX_OFF_DIAGONAL_ABS
    assert float(summary["max_trace_error"]) <= MAX_TRACE_ERROR
    assert float(summary["max_hermiticity_error"]) <= MAX_HERMITICITY_ERROR
    assert float(summary["minimum_density_eigenvalue"]) >= MINIMUM_EIGENVALUE
    assert float(summary["relative_gamma_fit_error"]) <= MAX_RELATIVE_GAMMA_FIT_ERROR


class ExcitedStateExponentialDecayTest(unittest.TestCase):
    def test_direct_rate_cases_match_exponential_decay(self) -> None:
        for case in RATE_CASES:
            with self.subTest(case=case["name"]):
                gamma = float(case["gamma_down_per_us"])
                rows = run_direct_rate_case(gamma, case["times_us"])
                validate_case(rows, summarize_case(rows, gamma))

    def test_collapse_operator_is_only_downward_sigma_minus(self) -> None:
        gamma = 0.05
        operators = multi_qubit_physical_collapse_operators(1, gamma, 0.0, 0.0)
        expected = scale(math.sqrt(gamma), SIGMA_MINUS)

        self.assertEqual(len(operators), 1)
        self.assertEqual(operators[0], expected)
        self.assertEqual(operators[0], adjoint(adjoint(operators[0])))

    def test_finer_internal_substeps_do_not_change_representative_case(self) -> None:
        case = RATE_CASES[0]
        gamma = float(case["gamma_down_per_us"])
        normal = run_direct_rate_case(gamma, case["times_us"])
        refined = run_direct_rate_case(
            gamma,
            case["times_us"],
            integration_step_us=0.25,
        )
        maximum_difference = max(
            abs(float(left["simulated_p1"]) - float(right["simulated_p1"]))
            for left, right in zip(normal, refined)
        )
        self.assertLessEqual(maximum_difference, MAX_STEP_REFINEMENT_DIFFERENCE)


def _snapshot_metrics(
    state,
    *,
    requested_time_us: float,
    gamma_down_per_us: float,
) -> dict[str, float | None]:
    simulated_p1 = float(state[1][1].real)
    simulated_p0 = float(state[0][0].real)
    analytic_p1 = math.exp(-gamma_down_per_us * requested_time_us)
    analytic_p0 = 1.0 - analytic_p1
    p1_error = abs(simulated_p1 - analytic_p1)
    p0_error = abs(simulated_p0 - analytic_p0)
    eigenvalues = _two_by_two_eigenvalues(state)
    return {
        "time_us": requested_time_us,
        "requested_time_us": requested_time_us,
        "t_over_t1": gamma_down_per_us * requested_time_us,
        "simulated_p1": simulated_p1,
        "analytic_p1": analytic_p1,
        "absolute_error_p1": p1_error,
        "relative_error_p1": p1_error / analytic_p1 if analytic_p1 > 1e-14 else None,
        "simulated_p0": simulated_p0,
        "analytic_p0": analytic_p0,
        "absolute_error_p0": p0_error,
        "rho01_abs": abs(state[0][1]),
        "rho10_abs": abs(state[1][0]),
        "trace_error": abs(trace(state) - 1.0),
        "hermiticity_error": max(
            abs(state[row][column] - state[column][row].conjugate())
            for row in range(2)
            for column in range(2)
        ),
        "minimum_eigenvalue": min(eigenvalues),
    }


def _two_by_two_eigenvalues(matrix) -> tuple[float, float]:
    center = 0.5 * (matrix[0][0].real + matrix[1][1].real)
    radius = math.sqrt(
        (0.5 * (matrix[0][0].real - matrix[1][1].real)) ** 2
        + abs(matrix[0][1]) ** 2
    )
    return center - radius, center + radius


def _fit_decay_rate(rows: list[dict[str, float | None]]) -> float | None:
    if len(rows) < 2:
        return None
    times = [float(row["time_us"]) for row in rows]
    log_p1 = [math.log(float(row["simulated_p1"])) for row in rows]
    mean_time = sum(times) / len(times)
    mean_log = sum(log_p1) / len(log_p1)
    denominator = sum((time - mean_time) ** 2 for time in times)
    if denominator == 0.0:
        return None
    slope = sum(
        (time - mean_time) * (log_value - mean_log)
        for time, log_value in zip(times, log_p1)
    ) / denominator
    return -slope


if __name__ == "__main__":
    unittest.main()
