"""Validation-only internal-step convergence checks using production RK4 paths."""

from __future__ import annotations

import math
import time
import unittest

from core.backend_boundary import PYTHON_DENSE_BACKEND
from core.circuit_model import GateColumn, GateOperation
from core.dense_numpy import force_numpy_dense_execution, force_python_dense_execution, numpy_dense_available
from core.gates import (
    column_unitary,
    effective_hamiltonian_from_involution,
    initial_density_matrix,
    multi_qubit_physical_collapse_operators,
    prepare_collapse_operators,
    zero_hamiltonian,
)
from core.simulator import _KernelStats, _evolve_stable_with_substeps


STEP_GRID_US = (1.0, 0.5, 0.25, 0.125, 0.0625)
REFERENCE_STEP_US = 0.03125
SAMPLE_TIMES_US = (0.0, 2.5, 5.0, 10.0, 20.0, 30.0, 50.0)
FINE_ANALYTIC_TOLERANCE = 1e-8
GATE_FINE_TOLERANCE = 1e-8
GATE_MEDIUM_TOLERANCE = 1e-7
PHYSICALITY_TOLERANCE = 1e-10
BACKEND_TOLERANCE = 1e-10


def run_idle_case(
    initial_state: str,
    gamma_down_per_us: float,
    gamma_up_per_us: float,
    gamma_phi_per_us: float,
    requested_times_us: tuple[float, ...],
    max_internal_step_us: float,
) -> dict[str, object]:
    """Evolve a zero-H one-qubit trajectory with an explicit maximum RK4 step."""

    state = _initial_state(initial_state, 1)
    collapse_ops = prepare_collapse_operators(
        multi_qubit_physical_collapse_operators(1, gamma_down_per_us, gamma_up_per_us, gamma_phi_per_us)
    )
    snapshots, internal_steps = _evolve_to_times(
        state,
        zero_hamiltonian(2),
        collapse_ops,
        requested_times_us,
        max_internal_step_us,
        gamma_down_per_us + gamma_up_per_us + gamma_phi_per_us,
    )
    return {"snapshots": snapshots, "internal_steps": internal_steps}


def run_gate_case(
    gate_columns: tuple[GateColumn, ...],
    n_qubits: int,
    gamma_down_per_us: float,
    gamma_up_per_us: float,
    gamma_phi_per_us: float,
    max_internal_step_us: float,
    *,
    backend: str = "numpy",
) -> dict[str, object]:
    """Run finite-duration production effective Hamiltonians with a fixed step cap."""

    state = _initial_state("0", n_qubits)
    collapse_ops = prepare_collapse_operators(
        multi_qubit_physical_collapse_operators(n_qubits, gamma_down_per_us, gamma_up_per_us, gamma_phi_per_us)
    )
    max_rate = gamma_down_per_us + gamma_up_per_us + gamma_phi_per_us
    snapshots = []
    internal_steps = 0
    context = force_numpy_dense_execution() if backend == "numpy" else force_python_dense_execution()
    with context:
        for column in gate_columns:
            duration_us = float(column.gates[0].params["duration_us"])
            hamiltonian = effective_hamiltonian_from_involution(column_unitary(column, n_qubits), duration_us)
            substeps = max(1, math.ceil(duration_us / max_internal_step_us))
            state = _evolve_stable_with_substeps(
                state,
                hamiltonian,
                collapse_ops,
                duration_us,
                substeps,
                _KernelStats(PYTHON_DENSE_BACKEND),
                blocked_by_sampling=False,
                blocked_by_boundary=True,
            )
            internal_steps += substeps
            snapshots.append(state)
    return {"snapshots": snapshots, "final_state": state, "internal_steps": internal_steps}


def analytic_downward(time_us: float, gamma_down_per_us: float):
    p1 = math.exp(-gamma_down_per_us * time_us)
    return ((1.0 - p1 + 0j, 0j), (0j, p1 + 0j))


def analytic_dephasing(time_us: float, gamma_phi_per_us: float):
    coherence = 0.5 * math.exp(-gamma_phi_per_us * time_us)
    return ((0.5 + 0j, coherence + 0j), (coherence + 0j, 0.5 + 0j))


def analytic_thermal(time_us: float, gamma_down_per_us: float, gamma_up_per_us: float):
    total = gamma_down_per_us + gamma_up_per_us
    equilibrium = gamma_up_per_us / total
    p1 = equilibrium + (1.0 - equilibrium) * math.exp(-total * time_us)
    return ((1.0 - p1 + 0j, 0j), (0j, p1 + 0j))


def matrix_metrics(state, reference) -> dict[str, float]:
    difference = [[state[row][column] - reference[row][column] for column in range(len(state))] for row in range(len(state))]
    max_element = max(abs(value) for row in difference for value in row)
    frobenius = math.sqrt(sum(abs(value) ** 2 for row in difference for value in row))
    return {
        "max_element_error": max_element,
        "frobenius_error": frobenius,
        "trace_distance": _trace_distance(difference),
        "population_error": max(abs(state[index][index] - reference[index][index]) for index in range(len(state))),
        "coherence_error": abs(state[0][1] - reference[0][1]) if len(state) > 1 else 0.0,
        **_physicality_metrics(state),
    }


def observed_order(error_h: float, error_half_h: float) -> tuple[float | None, bool]:
    if error_h <= 1e-14 or error_half_h <= 1e-14:
        return None, False
    return math.log(error_h / error_half_h, 2.0), True


class TimeStepConvergenceTest(unittest.TestCase):
    def test_analytic_relaxation_dephasing_and_thermal_cases_converge(self) -> None:
        cases = (
            ("V6-1", "1", 0.1, 0.0, 0.0, analytic_downward),
            ("V6-2", "plus", 0.0, 0.0, 0.1, analytic_dephasing),
            ("V6-3", "1", 0.051, 0.049, 0.0, analytic_thermal),
        )
        for name, initial, down, up, phi, analytic in cases:
            errors = []
            for step in [*STEP_GRID_US, REFERENCE_STEP_US]:
                result = run_idle_case(initial, down, up, phi, SAMPLE_TIMES_US, step)
                error = max(matrix_metrics(state, _analytic_for(analytic, time_us, down, up, phi))["max_element_error"] for state, time_us in zip(result["snapshots"], SAMPLE_TIMES_US))
                errors.append(error)
                with self.subTest(case=name, step=step):
                    self.assertLessEqual(_physicality_metrics(result["snapshots"][-1])["trace_error"], PHYSICALITY_TOLERANCE)
            self.assertLessEqual(errors[-1], FINE_ANALYTIC_TOLERANCE)
            self.assertTrue(_monotonic_tail(errors))

    def test_gate_and_two_qubit_cases_converge_against_fine_reference(self) -> None:
        one_qubit = _one_qubit_gate_columns()
        two_qubit = _two_qubit_gate_columns()
        for name, columns, n_qubits in (("V6-4", one_qubit, 1), ("V6-5", two_qubit, 2)):
            reference = run_gate_case(columns, n_qubits, 0.02, 0.003, 0.015, REFERENCE_STEP_US)["final_state"]
            errors = []
            for step in STEP_GRID_US:
                state = run_gate_case(columns, n_qubits, 0.02, 0.003, 0.015, step)["final_state"]
                metrics = matrix_metrics(state, reference)
                errors.append(metrics["max_element_error"])
                self.assertLessEqual(metrics["trace_error"], PHYSICALITY_TOLERANCE)
                self.assertGreaterEqual(metrics["minimum_eigenvalue"], -PHYSICALITY_TOLERANCE)
            self.assertLessEqual(errors[STEP_GRID_US.index(0.125)], GATE_MEDIUM_TOLERANCE, msg=name)
            self.assertLessEqual(errors[STEP_GRID_US.index(0.0625)], GATE_FINE_TOLERANCE, msg=name)
            self.assertTrue(_monotonic_tail(errors), msg=name)

    def test_snapshot_grid_does_not_change_common_time_states(self) -> None:
        common = (0.0, 5.0, 10.0)
        few = run_idle_case("1", 0.1, 0.0, 0.0, common, 0.125)
        many = run_idle_case("1", 0.1, 0.0, 0.0, (0.0, 1.25, 2.5, 3.75, 5.0, 6.25, 7.5, 8.75, 10.0), 0.125)
        custom = run_idle_case("1", 0.1, 0.0, 0.0, (0.0, 2.5, 5.0, 7.5, 10.0), 0.125)
        many_at_common = [many["snapshots"][index] for index in (0, 4, 8)]
        custom_at_common = [custom["snapshots"][index] for index in (0, 2, 4)]
        differences = [matrix_metrics(left, right)["max_element_error"] for collection in (many_at_common, custom_at_common) for left, right in zip(few["snapshots"], collection)]
        self.assertLessEqual(max(differences), BACKEND_TOLERANCE)

    @unittest.skipUnless(numpy_dense_available(), "NumPy dense execution is unavailable")
    def test_numpy_and_python_dense_are_consistent_under_fixed_refinement(self) -> None:
        idle_numpy = run_idle_case("1", 0.1, 0.0, 0.0, SAMPLE_TIMES_US, 0.125)
        with force_python_dense_execution():
            idle_python = run_idle_case("1", 0.1, 0.0, 0.0, SAMPLE_TIMES_US, 0.125)
        idle_error = matrix_metrics(idle_numpy["snapshots"][-1], idle_python["snapshots"][-1])["max_element_error"]
        columns = _two_qubit_gate_columns()
        numpy_state = run_gate_case(columns, 2, 0.02, 0.003, 0.015, 0.125, backend="numpy")["final_state"]
        python_state = run_gate_case(columns, 2, 0.02, 0.003, 0.015, 0.125, backend="python")["final_state"]
        two_qubit_error = matrix_metrics(numpy_state, python_state)["max_element_error"]
        self.assertLessEqual(idle_error, BACKEND_TOLERANCE)
        self.assertLessEqual(two_qubit_error, BACKEND_TOLERANCE)


def _evolve_to_times(state, hamiltonian, collapse_ops, requested_times, max_step, max_rate):
    snapshots = [state]
    total_steps = 0
    current = requested_times[0]
    for target in requested_times[1:]:
        duration = target - current
        substeps = max(1, math.ceil(duration / max_step))
        state = _evolve_stable_with_substeps(state, hamiltonian, collapse_ops, duration, substeps, _KernelStats(PYTHON_DENSE_BACKEND), blocked_by_sampling=False)
        snapshots.append(state)
        total_steps += substeps
        current = target
    return snapshots, total_steps


def _initial_state(name: str, n_qubits: int):
    if name in {"0", "1"}:
        return initial_density_matrix([name] * n_qubits)
    if name == "plus":
        return [[0.5 + 0j, 0.5 + 0j], [0.5 + 0j, 0.5 + 0j]]
    raise ValueError(name)


def _one_qubit_gate_columns() -> tuple[GateColumn, ...]:
    return (GateColumn(step=0, gates=[GateOperation(type="H", targets=[0], params={"duration_us": 8.0})]),)


def _two_qubit_gate_columns() -> tuple[GateColumn, ...]:
    return (
        GateColumn(step=0, gates=[GateOperation(type="H", targets=[0], params={"duration_us": 8.0})]),
        GateColumn(step=1, gates=[GateOperation(type="CNOT", controls=[0], targets=[1], params={"duration_us": 16.0})]),
    )


def _analytic_for(function, time_us, down, up, phi):
    if function is analytic_downward:
        return function(time_us, down)
    if function is analytic_dephasing:
        return function(time_us, phi)
    return function(time_us, down, up)


def _physicality_metrics(state) -> dict[str, float]:
    trace_value = sum(state[index][index] for index in range(len(state)))
    hermiticity = max(abs(state[row][column] - state[column][row].conjugate()) for row in range(len(state)) for column in range(len(state)))
    eigenvalues = _eigenvalues(state)
    return {"trace_error": abs(trace_value - 1.0), "hermiticity_error": hermiticity, "minimum_eigenvalue": min(eigenvalues)}


def _trace_distance(matrix) -> float:
    return 0.5 * sum(abs(value) for value in _eigenvalues(matrix))


def _eigenvalues(matrix):
    import numpy as np

    return [float(value) for value in np.linalg.eigvalsh(np.asarray(matrix, dtype=complex))]


def _monotonic_tail(errors) -> bool:
    return all(left >= right - 1e-14 for left, right in zip(errors[-4:-1], errors[-3:]))


if __name__ == "__main__":
    unittest.main()
