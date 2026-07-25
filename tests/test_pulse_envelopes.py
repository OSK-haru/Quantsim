import math
import unittest

from core.pulse_contract import SIGMA_X
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    SquarePulseEnvelope,
    TwoLevelPulseHamiltonian,
    finite_gaussian_area_factor,
)


class PulseEnvelopeTests(unittest.TestCase):
    def test_square_target_angle_sets_peak_and_area(self) -> None:
        envelope = SquarePulseEnvelope.from_target_rotation_angle(
            math.pi,
            duration_us=2.0,
        )

        self.assertAlmostEqual(
            envelope.peak_amplitude_rad_per_us,
            math.pi / 2.0,
        )
        self.assertAlmostEqual(envelope.pulse_area_rad, math.pi)
        self.assertAlmostEqual(
            envelope.integrated_area_rad(1.0),
            math.pi / 2.0,
        )
        self.assertEqual(envelope.amplitude_rad_per_us(-0.1), 0.0)
        self.assertEqual(envelope.amplitude_rad_per_us(2.1), 0.0)

    def test_gaussian_duration_center_and_finite_area(self) -> None:
        envelope = GaussianPulseEnvelope(
            peak_amplitude_rad_per_us=2.0,
            sigma_us=0.8,
            truncation_sigma=4.0,
        )

        self.assertAlmostEqual(envelope.duration_us, 6.4)
        self.assertAlmostEqual(envelope.center_us, 3.2)
        self.assertAlmostEqual(
            envelope.pulse_area_rad,
            2.0 * finite_gaussian_area_factor(0.8, 4.0),
        )
        self.assertAlmostEqual(
            envelope.amplitude_rad_per_us(envelope.center_us),
            2.0,
        )

    def test_gaussian_target_angle_uses_finite_support(self) -> None:
        for truncation in (3.0, 4.0, 5.0):
            with self.subTest(truncation=truncation):
                envelope = GaussianPulseEnvelope.from_target_rotation_angle(
                    math.pi,
                    sigma_us=0.5,
                    truncation_sigma=truncation,
                )

                self.assertAlmostEqual(
                    envelope.pulse_area_rad,
                    math.pi,
                    delta=1e-14,
                )
                self.assertAlmostEqual(
                    envelope.integrated_area_rad(envelope.duration_us),
                    math.pi,
                    delta=1e-14,
                )

    def test_gaussian_integrated_area_is_symmetric(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            math.pi,
            sigma_us=0.5,
            truncation_sigma=4.0,
        )

        self.assertAlmostEqual(
            envelope.integrated_area_rad(envelope.center_us),
            math.pi / 2.0,
            delta=1e-14,
        )

    def test_two_level_provider_builds_expected_resonant_hamiltonian(self) -> None:
        envelope = SquarePulseEnvelope(
            peak_amplitude_rad_per_us=2.0,
            duration_us=1.0,
        )
        provider = TwoLevelPulseHamiltonian(envelope)

        self.assertEqual(provider.evaluate(0.5), SIGMA_X)

    def test_invalid_envelope_values_are_rejected(self) -> None:
        invalid_factories = (
            lambda: SquarePulseEnvelope(1.0, 0.0),
            lambda: SquarePulseEnvelope(math.inf, 1.0),
            lambda: GaussianPulseEnvelope(1.0, 0.0, 4.0),
            lambda: GaussianPulseEnvelope(1.0, 0.5, -1.0),
            lambda: GaussianPulseEnvelope(math.nan, 0.5, 4.0),
        )
        for factory in invalid_factories:
            with self.subTest(factory=factory):
                with self.assertRaises(ValueError):
                    factory()


if __name__ == "__main__":
    unittest.main()
