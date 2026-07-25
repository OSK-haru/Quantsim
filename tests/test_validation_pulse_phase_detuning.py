import math
import unittest

from core.circuit_model import GateOperation
from core.gates import (
    X,
    apply_gate_operation,
    effective_hamiltonian_from_involution,
    initial_density_matrix,
)
from core.pulse_evolution import (
    ConstantHamiltonian,
    evolve_time_dependent_segment,
)
from validation_pulse.pulse_analytic import bloch_vector, matrix_error_metrics
from validation_pulse.pulse_phase_detuning import (
    analytic_constant_drive_density,
    evolve_density_with_unitary,
    run_constant_closed_trajectory,
    target_rotation_unitary,
)


TOLERANCE = 2e-8


class PulsePhaseDetuningValidationTests(unittest.TestCase):
    def test_four_phase_axes_match_full_analytic_trajectories(self) -> None:
        initial = initial_density_matrix(["0"])
        expected_final_bloch = {
            0.0: (0.0, -1.0, 0.0),
            math.pi / 2.0: (1.0, 0.0, 0.0),
            math.pi: (0.0, 1.0, 0.0),
            -math.pi / 2.0: (-1.0, 0.0, 0.0),
        }
        amplitude = math.pi / 2.0
        duration = 1.0
        times = _uniform_times(duration, 101)

        for phase, expected_bloch in expected_final_bloch.items():
            with self.subTest(phase=phase):
                result = run_constant_closed_trajectory(
                    initial,
                    amplitude,
                    phase,
                    0.0,
                    duration,
                    times,
                    0.005,
                )
                maximum_error = max(
                    matrix_error_metrics(
                        checkpoint.cleaned_state,
                        analytic_constant_drive_density(
                            initial,
                            amplitude,
                            phase,
                            0.0,
                            checkpoint.time_us,
                        ),
                    )["max_element_error"]
                    for checkpoint in result.checkpoints
                )

                self.assertLessEqual(maximum_error, TOLERANCE)
                actual_bloch = bloch_vector(result.state)
                for actual, expected in zip(
                    actual_bloch,
                    expected_bloch,
                    strict=True,
                ):
                    self.assertAlmostEqual(actual, expected, delta=TOLERANCE)

    def test_positive_and_negative_detuning_match_analytic_signs(self) -> None:
        initial = initial_density_matrix(["0"])
        amplitude = math.pi
        detuning_magnitude = 0.75 * math.pi
        duration = 1.0
        times = _uniform_times(duration, 101)
        results = {}

        for detuning in (detuning_magnitude, -detuning_magnitude):
            result = run_constant_closed_trajectory(
                initial,
                amplitude,
                0.0,
                detuning,
                duration,
                times,
                0.005,
            )
            maximum_error = max(
                matrix_error_metrics(
                    checkpoint.cleaned_state,
                    analytic_constant_drive_density(
                        initial,
                        amplitude,
                        0.0,
                        detuning,
                        checkpoint.time_us,
                    ),
                )["max_element_error"]
                for checkpoint in result.checkpoints
            )
            self.assertLessEqual(maximum_error, TOLERANCE)
            results[detuning] = result

        positive = results[detuning_magnitude].state
        negative = results[-detuning_magnitude].state
        self.assertAlmostEqual(
            positive[1][1].real,
            negative[1][1].real,
            delta=TOLERANCE,
        )
        self.assertGreater(positive[0][1].real, 0.05)
        self.assertLess(negative[0][1].real, -0.05)
        self.assertAlmostEqual(
            positive[0][1].real,
            -negative[0][1].real,
            delta=TOLERANCE,
        )
        self.assertAlmostEqual(
            positive[0][1].imag,
            negative[0][1].imag,
            delta=TOLERANCE,
        )

    def test_x_pi_matches_pulse_existing_gate_and_effective_hamiltonian(
        self,
    ) -> None:
        duration = 1.0
        gate_hamiltonian = effective_hamiltonian_from_involution(X, duration)
        target = target_rotation_unitary("x", math.pi)
        x_gate = GateOperation(type="X", targets=[0])

        for name, initial in _probe_states().items():
            with self.subTest(initial=name):
                pulse = run_constant_closed_trajectory(
                    initial,
                    math.pi,
                    0.0,
                    0.0,
                    duration,
                    (0.0, duration),
                    0.005,
                ).state
                gate_effective = evolve_time_dependent_segment(
                    initial,
                    ConstantHamiltonian(gate_hamiltonian),
                    (),
                    duration_us=duration,
                    max_step_us=0.005,
                ).state
                existing_gate = apply_gate_operation(initial, x_gate, 1)
                independent = evolve_density_with_unitary(initial, target)

                for actual in (pulse, gate_effective, existing_gate):
                    self.assertLessEqual(
                        matrix_error_metrics(
                            actual,
                            independent,
                        )["max_element_error"],
                        TOLERANCE,
                    )

    def test_fractional_x_and_y_match_independent_targets(self) -> None:
        cases = (
            ("x", math.pi / 2.0, 0.0),
            ("y", math.pi, math.pi / 2.0),
            ("y", math.pi / 2.0, math.pi / 2.0),
        )
        duration = 1.0
        for axis, angle, phase in cases:
            target = target_rotation_unitary(axis, angle)
            for name, initial in _probe_states().items():
                with self.subTest(axis=axis, angle=angle, initial=name):
                    pulse = run_constant_closed_trajectory(
                        initial,
                        angle,
                        phase,
                        0.0,
                        duration,
                        (0.0, duration),
                        0.005,
                    ).state
                    independent = evolve_density_with_unitary(
                        initial,
                        target,
                    )
                    self.assertLessEqual(
                        matrix_error_metrics(
                            pulse,
                            independent,
                        )["max_element_error"],
                        TOLERANCE,
                    )


def _uniform_times(duration_us: float, count: int) -> tuple[float, ...]:
    return tuple(
        duration_us * index / (count - 1)
        for index in range(count)
    )


def _probe_states():
    return {
        "zero": initial_density_matrix(["0"]),
        "one": initial_density_matrix(["1"]),
        "plus_x": (
            (0.5 + 0.0j, 0.5 + 0.0j),
            (0.5 + 0.0j, 0.5 + 0.0j),
        ),
        "plus_y": (
            (0.5 + 0.0j, 0.0 - 0.5j),
            (0.0 + 0.5j, 0.5 + 0.0j),
        ),
    }


if __name__ == "__main__":
    unittest.main()
