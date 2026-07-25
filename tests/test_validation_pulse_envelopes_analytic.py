import math
import unittest

from core.gates import zero_hamiltonian
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_evolution import (
    ConstantHamiltonian,
    evolve_time_dependent_segment,
)
from validation_pulse.pulse_analytic import (
    analytic_resonant_x_density,
    matrix_error_metrics,
    observed_order,
    pulse_end_target_fidelity,
    pure_target_fidelity,
    run_resonant_closed_trajectory,
)


TRAJECTORY_TOLERANCE = 2e-8
AREA_TOLERANCE = 1e-13
CLEANUP_TOLERANCE = 1e-12


class PulseEnvelopeAnalyticValidationTests(unittest.TestCase):
    def test_square_x_pi_and_x_pi_over_two(self) -> None:
        for angle, expected_population in (
            (math.pi, 1.0),
            (math.pi / 2.0, 0.5),
        ):
            with self.subTest(angle=angle):
                envelope = SquarePulseEnvelope.from_target_rotation_angle(
                    angle,
                    duration_us=1.0,
                )
                times = _uniform_times(envelope.duration_us, 101)
                result = run_resonant_closed_trajectory(
                    envelope,
                    times,
                    max_step_us=0.01,
                )
                maximum_error = _maximum_trajectory_error(
                    envelope,
                    result,
                )

                self.assertLessEqual(
                    maximum_error,
                    TRAJECTORY_TOLERANCE,
                )
                self.assertAlmostEqual(
                    result.state[1][1].real,
                    expected_population,
                    delta=TRAJECTORY_TOLERANCE,
                )

    def test_square_two_complete_rabi_periods(self) -> None:
        envelope = SquarePulseEnvelope(
            peak_amplitude_rad_per_us=2.0 * math.pi,
            duration_us=2.0,
        )
        result = run_resonant_closed_trajectory(
            envelope,
            _uniform_times(envelope.duration_us, 201),
            max_step_us=0.0025,
        )

        self.assertLessEqual(
            _maximum_trajectory_error(envelope, result),
            TRAJECTORY_TOLERANCE,
        )
        self.assertAlmostEqual(result.state[0][0].real, 1.0, delta=1e-7)

    def test_gaussian_x_pi_and_x_pi_over_two_full_trajectory(self) -> None:
        for angle, target in (
            (math.pi, "1"),
            (math.pi / 2.0, None),
        ):
            with self.subTest(angle=angle):
                envelope = GaussianPulseEnvelope.from_target_rotation_angle(
                    angle,
                    sigma_us=0.2,
                    truncation_sigma=4.0,
                )
                result = run_resonant_closed_trajectory(
                    envelope,
                    _uniform_times(envelope.duration_us, 161),
                    max_step_us=0.005,
                )

                self.assertLessEqual(
                    _maximum_trajectory_error(envelope, result),
                    TRAJECTORY_TOLERANCE,
                )
                self.assertAlmostEqual(
                    envelope.pulse_area_rad,
                    angle,
                    delta=AREA_TOLERANCE,
                )
                if target is not None:
                    self.assertAlmostEqual(
                        pulse_end_target_fidelity(result.state, target),
                        1.0,
                        delta=TRAJECTORY_TOLERANCE,
                    )

    def test_gaussian_truncation_uses_finite_normalization(self) -> None:
        for truncation in (3.0, 4.0, 5.0):
            with self.subTest(truncation=truncation):
                envelope = GaussianPulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    sigma_us=0.2,
                    truncation_sigma=truncation,
                )
                self.assertLessEqual(
                    abs(envelope.pulse_area_rad - math.pi),
                    AREA_TOLERANCE,
                )

    def test_closed_idle_preserves_pulse_end_state(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.2,
            truncation_sigma=4.0,
        )
        pulse_result = run_resonant_closed_trajectory(
            envelope,
            (0.0, envelope.duration_us),
            max_step_us=0.005,
        )

        idle_result = evolve_time_dependent_segment(
            pulse_result.state,
            ConstantHamiltonian(zero_hamiltonian(2)),
            (),
            duration_us=1.0,
            max_step_us=0.1,
        )

        metrics = matrix_error_metrics(idle_result.state, pulse_result.state)
        self.assertLessEqual(metrics["max_element_error"], 1e-14)

    def test_pure_target_fidelity_supports_superposition_targets(self) -> None:
        envelope = SquarePulseEnvelope.from_target_rotation_angle(
            math.pi / 2.0,
            1.0,
        )
        result = run_resonant_closed_trajectory(
            envelope,
            (0.0, envelope.duration_us),
            max_step_us=0.005,
        )
        target = analytic_resonant_x_density(
            envelope,
            envelope.duration_us,
        )

        self.assertAlmostEqual(
            pure_target_fidelity(result.state, target),
            1.0,
            places=9,
        )

    def test_gaussian_error_decreases_with_step_refinement(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.2,
            truncation_sigma=4.0,
        )
        exact = analytic_resonant_x_density(
            envelope,
            envelope.duration_us,
        )
        errors = []
        for max_step in (0.08, 0.04, 0.02):
            result = run_resonant_closed_trajectory(
                envelope,
                (0.0, envelope.duration_us),
                max_step_us=max_step,
            )
            errors.append(
                matrix_error_metrics(
                    result.state,
                    exact,
                )["max_element_error"]
            )
            self.assertLessEqual(
                result.diagnostics.cleanup_correction_norm,
                CLEANUP_TOLERANCE,
            )

        self.assertGreater(errors[0], errors[1])
        self.assertGreater(errors[1], errors[2])
        order = observed_order(errors[1], errors[2])
        self.assertIsNotNone(order)
        self.assertGreater(order, 3.0)


def _uniform_times(duration_us: float, count: int) -> tuple[float, ...]:
    return tuple(
        duration_us * index / (count - 1)
        for index in range(count)
    )


def _maximum_trajectory_error(envelope, result) -> float:
    return max(
        matrix_error_metrics(
            checkpoint.cleaned_state,
            analytic_resonant_x_density(envelope, checkpoint.time_us),
        )["max_element_error"]
        for checkpoint in result.checkpoints
    )


if __name__ == "__main__":
    unittest.main()
