import math
import unittest

from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    SquarePulseEnvelope,
)
from core.pulse_open_system import PulseDissipationRates
from core.pulse_qutrit_open_system import QutritDissipationRates
from core.pulse_step_policy import (
    PULSE_BASELINE_A_EPSILON_D,
    PULSE_BASELINE_A_EPSILON_H,
    PULSE_BASELINE_A_SAMPLES_PER_SIGMA,
    PULSE_QUTRIT_EPSILON_D,
    PULSE_QUTRIT_EPSILON_H,
    PULSE_QUTRIT_SAMPLES_PER_SIGMA,
    qutrit_dissipative_scale_per_us,
    qutrit_hamiltonian_spectral_diameter_rad_per_us,
    recommended_max_step_us,
    recommended_qutrit_step_policy,
)


class PulseB3QutritStepPolicyTests(unittest.TestCase):
    def test_qutrit_thresholds_are_independent_from_baseline_a(self) -> None:
        self.assertEqual(PULSE_BASELINE_A_EPSILON_H, 0.05)
        self.assertEqual(PULSE_BASELINE_A_EPSILON_D, 0.05)
        self.assertEqual(PULSE_BASELINE_A_SAMPLES_PER_SIGMA, 20)
        self.assertEqual(PULSE_QUTRIT_EPSILON_H, 0.02)
        self.assertEqual(PULSE_QUTRIT_EPSILON_D, 0.02)
        self.assertEqual(PULSE_QUTRIT_SAMPLES_PER_SIGMA, 32)

    def test_anharmonicity_is_included_in_hamiltonian_scale(self) -> None:
        envelope = SquarePulseEnvelope(0.0, 0.01)
        weak_alpha = qutrit_hamiltonian_spectral_diameter_rad_per_us(
            envelope,
            detuning_rad_per_us=0.0,
            anharmonicity_rad_per_us=-100.0,
        )
        strong_alpha = qutrit_hamiltonian_spectral_diameter_rad_per_us(
            envelope,
            detuning_rad_per_us=0.0,
            anharmonicity_rad_per_us=-1000.0,
        )

        self.assertAlmostEqual(weak_alpha, 100.0)
        self.assertAlmostEqual(strong_alpha, 1000.0)
        self.assertGreater(strong_alpha, weak_alpha)

    def test_dissipative_scale_uses_all_qutrit_channels(self) -> None:
        rates = _rates(0.1, 0.2, 0.3, 0.4, 0.5)

        self.assertAlmostEqual(
            qutrit_dissipative_scale_per_us(rates),
            0.1 + 0.2 + 0.3 + 0.4 + 4.0 * 0.5,
        )

    def test_gaussian_policy_records_each_limit(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.004,
            truncation_sigma=4.0,
        )
        policy = recommended_qutrit_step_policy(
            envelope,
            detuning_rad_per_us=10.0,
            anharmonicity_rad_per_us=-500.0,
            rates=_rates(0.2, 0.1, 0.4, 0.05, 0.3),
            total_simulation_time_us=0.05,
        )

        self.assertIsNotNone(policy.hamiltonian_step_limit_us)
        self.assertIsNotNone(policy.dissipation_step_limit_us)
        self.assertAlmostEqual(
            policy.envelope_step_limit_us,
            envelope.sigma_us / PULSE_QUTRIT_SAMPLES_PER_SIGMA,
        )
        self.assertEqual(
            policy.step_limit_reason,
            "hamiltonian_spectral_diameter",
        )
        self.assertLessEqual(
            policy.h_times_hamiltonian_scale,
            PULSE_QUTRIT_EPSILON_H * (1.0 + 1e-12),
        )
        self.assertLessEqual(
            policy.h_times_dissipation_scale,
            PULSE_QUTRIT_EPSILON_D,
        )
        self.assertTrue(policy.within_work_budget)

    def test_work_budget_is_reported_without_changing_step(self) -> None:
        envelope = SquarePulseEnvelope(0.0, 0.01)
        policy = recommended_qutrit_step_policy(
            envelope,
            detuning_rad_per_us=0.0,
            anharmonicity_rad_per_us=-2000.0,
            rates=_rates(),
            total_simulation_time_us=1.0,
            maximum_internal_step_count=10,
        )

        self.assertFalse(policy.within_work_budget)
        self.assertGreater(policy.estimated_internal_step_count, 10)
        self.assertAlmostEqual(
            policy.selected_internal_step_cap_us,
            PULSE_QUTRIT_EPSILON_H / 2000.0,
        )

    def test_baseline_a_step_selection_is_unchanged(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.02,
            truncation_sigma=4.0,
        )
        rates = PulseDissipationRates(
            input_mode="direct_rates",
            gamma_down_per_us=0.2,
            gamma_up_per_us=0.1,
            gamma_phi_per_us=0.3,
        )
        expected = min(
            envelope.duration_us,
            PULSE_BASELINE_A_EPSILON_H
            / math.hypot(envelope.peak_amplitude_rad_per_us, 3.0),
            PULSE_BASELINE_A_EPSILON_D / 0.6,
            envelope.sigma_us / PULSE_BASELINE_A_SAMPLES_PER_SIGMA,
        )

        self.assertAlmostEqual(
            recommended_max_step_us(envelope, 3.0, rates),
            expected,
        )


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
