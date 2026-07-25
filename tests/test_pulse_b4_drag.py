import math
import unittest

from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_qutrit import (
    QutritPulseHamiltonian,
    evolve_closed_qutrit_sequence,
    qutrit_initial_density_matrix,
)
from core.pulse_qutrit_contract import (
    transmon_anharmonicity_rad_per_us,
)
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    evolve_open_qutrit_sequence,
)
from core.pulse_step_policy import recommended_qutrit_step_policy


class PulseB4DragEnvelopeTests(unittest.TestCase):
    def test_analytic_derivative_matches_centered_finite_difference(
        self,
    ) -> None:
        envelope = GaussianPulseEnvelope(
            peak_amplitude_rad_per_us=3.2,
            sigma_us=0.02,
            truncation_sigma=4.0,
        )
        time_us = envelope.center_us - 0.7 * envelope.sigma_us
        delta = 1e-7
        finite_difference = (
            envelope.amplitude_rad_per_us(time_us + delta)
            - envelope.amplitude_rad_per_us(time_us - delta)
        ) / (2.0 * delta)

        self.assertAlmostEqual(
            envelope.derivative_rad_per_us2(time_us),
            finite_difference,
            delta=1e-7,
        )

    def test_derivative_sign_and_hard_cutoff_boundary_are_explicit(
        self,
    ) -> None:
        envelope = GaussianPulseEnvelope(2.0, 0.01, 4.0)

        self.assertGreater(
            envelope.derivative_rad_per_us2(
                envelope.center_us - envelope.sigma_us
            ),
            0.0,
        )
        self.assertLess(
            envelope.derivative_rad_per_us2(
                envelope.center_us + envelope.sigma_us
            ),
            0.0,
        )
        self.assertNotEqual(envelope.derivative_rad_per_us2(0.0), 0.0)
        self.assertNotEqual(
            envelope.derivative_rad_per_us2(envelope.duration_us),
            0.0,
        )
        self.assertEqual(envelope.derivative_rad_per_us2(-1e-12), 0.0)
        self.assertEqual(
            envelope.derivative_rad_per_us2(
                envelope.duration_us + 1e-12
            ),
            0.0,
        )

    def test_positive_and_negative_beta_reverse_quadrature_sign(
        self,
    ) -> None:
        envelope = GaussianPulseEnvelope(2.0, 0.01, 4.0)
        time_us = envelope.center_us - envelope.sigma_us
        positive = QutritPulseHamiltonian(
            envelope,
            anharmonicity_rad_per_us=-10.0,
            drag_beta_us=0.002,
        ).evaluate(time_us)
        negative = QutritPulseHamiltonian(
            envelope,
            anharmonicity_rad_per_us=-10.0,
            drag_beta_us=-0.002,
        ).evaluate(time_us)

        self.assertAlmostEqual(positive[0][1].real, negative[0][1].real)
        self.assertAlmostEqual(positive[0][1].imag, -negative[0][1].imag)
        self.assertLess(positive[0][1].imag, 0.0)

    def test_nonzero_drag_rejects_square_envelope(self) -> None:
        with self.assertRaisesRegex(ValueError, "requires a Gaussian"):
            QutritPulseHamiltonian(
                SquarePulseEnvelope(1.0, 0.1),
                anharmonicity_rad_per_us=-10.0,
                drag_beta_us=0.001,
            )


class PulseB4DragEvolutionTests(unittest.TestCase):
    def test_beta_zero_exactly_reproduces_non_drag_path(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi / 2.0,
            sigma_us=0.002,
            truncation_sigma=4.0,
        )
        alpha = transmon_anharmonicity_rad_per_us(-100.0)
        initial = qutrit_initial_density_matrix("0")
        without_argument = evolve_closed_qutrit_sequence(
            initial,
            envelope,
            alpha,
            envelope.duration_us,
            1e-5,
        )
        explicit_zero = evolve_closed_qutrit_sequence(
            initial,
            envelope,
            alpha,
            envelope.duration_us,
            1e-5,
            drag_beta_us=0.0,
        )

        self.assertEqual(
            without_argument.final_state,
            explicit_zero.final_state,
        )
        self.assertEqual(
            without_argument.pulse_result.diagnostics,
            explicit_zero.pulse_result.diagnostics,
        )

    def test_drag_policy_includes_combined_quadrature_amplitude(
        self,
    ) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.002,
            truncation_sigma=4.0,
        )
        alpha = transmon_anharmonicity_rad_per_us(-100.0)
        rates = _rates()
        baseline = recommended_qutrit_step_policy(
            envelope,
            0.0,
            alpha,
            rates,
            envelope.duration_us,
        )
        drag = recommended_qutrit_step_policy(
            envelope,
            0.0,
            alpha,
            rates,
            envelope.duration_us,
            drag_beta_us=0.004,
        )

        self.assertGreater(
            drag.maximum_drive_magnitude_rad_per_us,
            baseline.maximum_drive_magnitude_rad_per_us,
        )
        self.assertGreater(
            drag.maximum_drag_derivative_rad_per_us2,
            0.0,
        )
        self.assertLess(
            drag.selected_internal_step_cap_us,
            baseline.selected_internal_step_cap_us,
        )

    def test_drag_operates_with_qutrit_dissipation(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi / 2.0,
            sigma_us=0.002,
            truncation_sigma=4.0,
        )
        alpha = transmon_anharmonicity_rad_per_us(-100.0)
        rates = _rates(0.8, 0.2, 1.4, 0.1, 0.5)
        policy = recommended_qutrit_step_policy(
            envelope,
            0.0,
            alpha,
            rates,
            envelope.duration_us,
            drag_beta_us=0.001,
        )
        result = evolve_open_qutrit_sequence(
            qutrit_initial_density_matrix("0"),
            envelope,
            alpha,
            rates,
            envelope.duration_us,
            policy.selected_internal_step_cap_us,
            drag_beta_us=0.001,
        )

        diagnostics = result.pulse_result.diagnostics
        self.assertLessEqual(diagnostics.raw_trace_error, 1e-10)
        self.assertLessEqual(diagnostics.raw_hermiticity_error, 1e-10)
        self.assertGreaterEqual(diagnostics.raw_minimum_eigenvalue, -1e-9)
        self.assertLessEqual(diagnostics.cleanup_correction_norm, 1e-10)


def _rates(
    gamma_10_down_per_us: float = 0.0,
    gamma_01_up_per_us: float = 0.0,
    gamma_21_down_per_us: float = 0.0,
    gamma_12_up_per_us: float = 0.0,
    gamma_phi_adjacent_per_us: float = 0.0,
) -> QutritDissipationRates:
    return QutritDissipationRates(
        "direct_rates",
        gamma_10_down_per_us,
        gamma_01_up_per_us,
        gamma_21_down_per_us,
        gamma_12_up_per_us,
        gamma_phi_adjacent_per_us,
    )


if __name__ == "__main__":
    unittest.main()
