"""Noisy one-qubit state evolution helpers for the Quantum-Sim MVP."""

from __future__ import annotations

import math

from core.circuit import (
    H_GATE_DURATION_US,
    Matrix2,
    QuantumCircuitModel,
    h_gate_hamiltonian,
    initial_zero_density_matrix,
)
from core.environment import (
    EnvironmentProfile,
    map_environment_to_t1_t2,
    t1_t2_to_gammas,
)


DEFAULT_TIME_STEPS = 101


def estimate_decay(circuit: QuantumCircuitModel, environment: EnvironmentProfile) -> float:
    """Return a simple placeholder degradation estimate."""

    complexity = max(len(circuit.gates), 1)
    return complexity * (environment.noise_level + environment.temperature_kelvin)


def simulate_once(
    temperature_kelvin: float,
    magnetic_field_tesla: float,
    noise_level: float,
) -> tuple[list[float], list[Matrix2]]:
    """Run one noisy 1-qubit H-gate trajectory and return times and states."""

    times = _time_grid(H_GATE_DURATION_US, DEFAULT_TIME_STEPS)
    t1_us, t2_us = map_environment_to_t1_t2(
        temperature_kelvin,
        magnetic_field_tesla,
        noise_level,
    )
    gamma1, gammaphi = t1_t2_to_gammas(t1_us, t2_us)

    hamiltonian = h_gate_hamiltonian()
    collapse_ops = _collapse_operators(gamma1, gammaphi)

    states = [initial_zero_density_matrix()]
    for start_time, end_time in zip(times, times[1:]):
        dt = end_time - start_time
        next_state = _rk4_step(states[-1], hamiltonian, collapse_ops, dt)
        states.append(_clean_density_matrix(next_state))

    return times, states


def _time_grid(duration_us: float, step_count: int) -> list[float]:
    if duration_us <= 0.0:
        raise ValueError("duration_us must be positive")
    if step_count < 2:
        raise ValueError("step_count must be at least 2")
    return [
        duration_us * step_index / (step_count - 1)
        for step_index in range(step_count)
    ]


def _collapse_operators(gamma1: float, gammaphi: float) -> list[Matrix2]:
    collapse_ops: list[Matrix2] = []

    if gamma1 > 0.0:
        relaxation = math.sqrt(gamma1)
        collapse_ops.append(
            (
                (0.0 + 0.0j, complex(relaxation)),
                (0.0 + 0.0j, 0.0 + 0.0j),
            )
        )
    if gammaphi > 0.0:
        dephasing = math.sqrt(gammaphi / 2.0)
        collapse_ops.append(
            (
                (complex(dephasing), 0.0 + 0.0j),
                (0.0 + 0.0j, complex(-dephasing)),
            )
        )

    return collapse_ops


def _rk4_step(
    state: Matrix2,
    hamiltonian: Matrix2,
    collapse_ops: list[Matrix2],
    dt: float,
) -> Matrix2:
    k1 = _lindblad_rhs(state, hamiltonian, collapse_ops)
    k2 = _lindblad_rhs(_add(state, _scale(0.5 * dt, k1)), hamiltonian, collapse_ops)
    k3 = _lindblad_rhs(_add(state, _scale(0.5 * dt, k2)), hamiltonian, collapse_ops)
    k4 = _lindblad_rhs(_add(state, _scale(dt, k3)), hamiltonian, collapse_ops)
    return _add(
        state,
        _scale(
            dt / 6.0,
            _add(k1, _scale(2.0, k2), _scale(2.0, k3), k4),
        ),
    )


def _lindblad_rhs(
    state: Matrix2,
    hamiltonian: Matrix2,
    collapse_ops: list[Matrix2],
) -> Matrix2:
    commutator = _subtract(
        _matmul(hamiltonian, state),
        _matmul(state, hamiltonian),
    )
    derivative = _scale(-1j, commutator)

    for collapse_op in collapse_ops:
        adjoint = _adjoint(collapse_op)
        rate_op = _matmul(adjoint, collapse_op)
        dissipator = _subtract(
            _matmul(_matmul(collapse_op, state), adjoint),
            _scale(
                0.5,
                _add(
                    _matmul(rate_op, state),
                    _matmul(state, rate_op),
                ),
            ),
        )
        derivative = _add(derivative, dissipator)

    return derivative


def _clean_density_matrix(state: Matrix2) -> Matrix2:
    state = _scale(0.5, _add(state, _adjoint(state)))
    trace = _trace(state)
    if abs(trace) == 0.0:
        raise ValueError("density matrix trace vanished during evolution")
    return _scale(1.0 / trace, state)


def _matmul(left: Matrix2, right: Matrix2) -> Matrix2:
    return (
        (
            left[0][0] * right[0][0] + left[0][1] * right[1][0],
            left[0][0] * right[0][1] + left[0][1] * right[1][1],
        ),
        (
            left[1][0] * right[0][0] + left[1][1] * right[1][0],
            left[1][0] * right[0][1] + left[1][1] * right[1][1],
        ),
    )


def _add(*matrices: Matrix2) -> Matrix2:
    return (
        (
            sum(matrix[0][0] for matrix in matrices),
            sum(matrix[0][1] for matrix in matrices),
        ),
        (
            sum(matrix[1][0] for matrix in matrices),
            sum(matrix[1][1] for matrix in matrices),
        ),
    )


def _subtract(left: Matrix2, right: Matrix2) -> Matrix2:
    return _add(left, _scale(-1.0, right))


def _scale(value: complex, matrix: Matrix2) -> Matrix2:
    return (
        (value * matrix[0][0], value * matrix[0][1]),
        (value * matrix[1][0], value * matrix[1][1]),
    )


def _adjoint(matrix: Matrix2) -> Matrix2:
    return (
        (matrix[0][0].conjugate(), matrix[1][0].conjugate()),
        (matrix[0][1].conjugate(), matrix[1][1].conjugate()),
    )


def _trace(matrix: Matrix2) -> complex:
    return matrix[0][0] + matrix[1][1]
