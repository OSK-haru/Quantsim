import math
import unittest

from core.gates import (
    initial_density_matrix,
    multi_qubit_physical_collapse_operators,
    zero_hamiltonian,
)
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    SquarePulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_open_system import (
    PulseDissipationRates,
    evolve_open_pulse_sequence,
)
from validation_pulse.pulse_analytic import matrix_error_metrics, observed_order
from validation_pulse.pulse_step_policy import (
    pulse_step_controls,
    recommended_max_step_us,
)
from validation_pulse.qutip_adapter import (
    QUTIP_AVAILABLE,
    compare_density_matrices,
    run_qutip_constant_segment,
    run_qutip_time_dependent_segment,
)


QUTIP_TOLERANCE = 5e-7


class PulseBA5ConvergenceTests(unittest.TestCase):
    def test_dimensionless_controls_use_combined_rates(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            0.2,
            4.0,
        )
        rates = PulseDissipationRates("direct_rates", 0.2, 0.1, 0.3)
        controls = pulse_step_controls(
            envelope,
            0.75 * math.pi,
            rates,
            0.01,
        )

        self.assertAlmostEqual(
            controls.dissipative_scale_per_us,
            0.6,
        )
        self.assertAlmostEqual(
            controls.h_times_dissipative_scale,
            0.006,
        )
        self.assertAlmostEqual(controls.h_over_sigma, 0.05)
        self.assertAlmostEqual(
            controls.hamiltonian_gap_rad_per_us,
            math.hypot(
                envelope.peak_amplitude_rad_per_us,
                0.75 * math.pi,
            ),
        )

    def test_recommended_step_uses_most_restrictive_control(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            0.2,
            4.0,
        )
        rates = PulseDissipationRates("direct_rates", 0.2, 0.1, 0.3)
        step = recommended_max_step_us(
            envelope,
            0.0,
            rates,
            epsilon_h=1.0,
            epsilon_d=1.0,
            samples_per_sigma=20,
        )

        self.assertAlmostEqual(step, envelope.sigma_us / 20)

    def test_gaussian_error_shows_fourth_order_refinement(self) -> None:
        initial = initial_density_matrix(["0"])
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            0.2,
            4.0,
        )
        rates = PulseDissipationRates("direct_rates", 0.0, 0.0, 0.0)
        reference = evolve_open_pulse_sequence(
            initial,
            envelope,
            rates,
            envelope.duration_us,
            0.00125,
        ).final_state
        errors = []
        for step in (0.04, 0.02, 0.01):
            state = evolve_open_pulse_sequence(
                initial,
                envelope,
                rates,
                envelope.duration_us,
                step,
            ).final_state
            errors.append(
                matrix_error_metrics(
                    state,
                    reference,
                )["max_element_error"]
            )

        self.assertGreater(errors[0], errors[1])
        self.assertGreater(errors[1], errors[2])
        order = observed_order(errors[1], errors[2])
        self.assertIsNotNone(order)
        self.assertGreater(order, 3.5)

    def test_extreme_coarse_dissipative_step_exposes_raw_negativity(
        self,
    ) -> None:
        envelope = SquarePulseEnvelope(0.0, 0.4)
        rates = PulseDissipationRates("direct_rates", 10.0, 0.0, 0.0)
        initial = initial_density_matrix(["1"])
        coarse = evolve_open_pulse_sequence(
            initial,
            envelope,
            rates,
            0.4,
            0.4,
        )
        fine = evolve_open_pulse_sequence(
            initial,
            envelope,
            rates,
            0.4,
            0.005,
        )

        self.assertAlmostEqual(
            pulse_step_controls(envelope, 0.0, rates, 0.4)
            .h_times_dissipative_scale,
            4.0,
        )
        self.assertLess(
            coarse.pulse_result.diagnostics.raw_minimum_eigenvalue,
            -0.1,
        )
        self.assertGreaterEqual(
            fine.pulse_result.diagnostics.raw_minimum_eigenvalue,
            -1e-10,
        )


@unittest.skipUnless(QUTIP_AVAILABLE, "validation-only QuTiP is unavailable")
class PulseBA5QuTiPTests(unittest.TestCase):
    def test_required_time_dependent_cases_match_qutip(self) -> None:
        specifications = (
            (
                "resonant_gaussian",
                GaussianPulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    0.2,
                    4.0,
                ),
                0.0,
                0.0,
                PulseDissipationRates("direct_rates", 0.0, 0.0, 0.0),
                0.0,
            ),
            (
                "nonzero_phase",
                SquarePulseEnvelope.from_target_rotation_angle(
                    math.pi / 2.0,
                    1.0,
                ),
                math.pi / 3.0,
                0.0,
                PulseDissipationRates("direct_rates", 0.0, 0.0, 0.0),
                0.0,
            ),
            (
                "positive_detuning",
                SquarePulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    1.0,
                ),
                0.0,
                0.75 * math.pi,
                PulseDissipationRates("direct_rates", 0.0, 0.0, 0.0),
                0.0,
            ),
            (
                "negative_detuning",
                SquarePulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    1.0,
                ),
                0.0,
                -0.75 * math.pi,
                PulseDissipationRates("direct_rates", 0.0, 0.0, 0.0),
                0.0,
            ),
            (
                "dissipative_gaussian",
                GaussianPulseEnvelope.from_target_rotation_angle(
                    math.pi / 2.0,
                    0.2,
                    4.0,
                ),
                math.pi / 4.0,
                0.25 * math.pi,
                PulseDissipationRates(
                    "direct_rates",
                    0.2,
                    0.05,
                    0.3,
                ),
                0.0,
            ),
            (
                "pulse_then_idle",
                SquarePulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    0.2,
                ),
                0.0,
                0.0,
                PulseDissipationRates(
                    "direct_rates",
                    0.1,
                    0.02,
                    0.05,
                ),
                1.0,
            ),
        )
        for (
            name,
            envelope,
            phase,
            detuning,
            rates,
            idle_duration,
        ) in specifications:
            with self.subTest(case=name):
                self._assert_case_matches(
                    envelope,
                    phase,
                    detuning,
                    rates,
                    idle_duration,
                )

    def _assert_case_matches(
        self,
        envelope,
        phase,
        detuning,
        rates,
        idle_duration,
    ) -> None:
        initial = initial_density_matrix(["0"])
        pulse_times = _uniform_times(envelope.duration_us, 21)
        idle_times = (
            _uniform_times(idle_duration, 21)
            if idle_duration > 0.0
            else ()
        )
        total_duration = envelope.duration_us + idle_duration
        quanta = evolve_open_pulse_sequence(
            initial,
            envelope,
            rates,
            total_duration,
            0.0025,
            phase_rad=phase,
            detuning_rad_per_us=detuning,
            pulse_checkpoint_times_us=pulse_times,
            idle_checkpoint_times_us=idle_times,
        )
        collapse_ops = multi_qubit_physical_collapse_operators(
            1,
            rates.gamma_down_per_us,
            rates.gamma_up_per_us,
            rates.gamma_phi_per_us,
        )
        qutip_pulse = run_qutip_time_dependent_segment(
            initial,
            TwoLevelPulseHamiltonian(
                envelope,
                phase,
                detuning,
            ),
            collapse_ops,
            1,
            envelope.duration_us,
            pulse_times,
            max_step_us=0.00125,
        )
        for checkpoint, qutip_state in zip(
            quanta.pulse_result.checkpoints,
            qutip_pulse,
            strict=True,
        ):
            self.assertLessEqual(
                compare_density_matrices(
                    checkpoint.cleaned_state,
                    qutip_state,
                )["max_element_difference"],
                QUTIP_TOLERANCE,
            )

        if idle_duration > 0.0:
            assert quanta.idle_result is not None
            qutip_idle = run_qutip_constant_segment(
                qutip_pulse[-1],
                zero_hamiltonian(2),
                collapse_ops,
                1,
                idle_duration,
                idle_times,
                max_step_us=0.00125,
            )
            for checkpoint, qutip_state in zip(
                quanta.idle_result.checkpoints,
                qutip_idle,
                strict=True,
            ):
                self.assertLessEqual(
                    compare_density_matrices(
                        checkpoint.cleaned_state,
                        qutip_state,
                    )["max_element_difference"],
                    QUTIP_TOLERANCE,
                )


def _uniform_times(duration_us: float, count: int) -> tuple[float, ...]:
    return tuple(
        duration_us * index / (count - 1)
        for index in range(count)
    )


if __name__ == "__main__":
    unittest.main()
