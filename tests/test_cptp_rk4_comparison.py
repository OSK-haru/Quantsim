"""C8 tests for matched-grid RK4 and CPTP comparison."""

from __future__ import annotations

import json
import math
import unittest

from core.cptp_comparison import compare_rk4_and_cptp
from core.gates import Matrix, SIGMA_MINUS, X, Z, scale, zero_hamiltonian
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_evolution import ConstantHamiltonian
from core.rust_dense_kernel import is_rust_kernel_available


class RK4CPTPComparisonTests(unittest.TestCase):
    def test_constant_generator_converges_to_cptp_exponential(self) -> None:
        provider = ConstantHamiltonian(scale(0.41, X))
        collapses = [
            scale(math.sqrt(0.17), SIGMA_MINUS),
            scale(math.sqrt(0.06 / 2.0), Z),
        ]
        distances = []

        for step in (0.2, 0.1, 0.05):
            comparison = compare_rk4_and_cptp(
                _state_plus(),
                provider,
                collapses,
                duration_us=0.8,
                max_step_us=step,
            )
            distances.append(comparison.trace_distance)
            self.assertEqual(
                comparison.rk4_internal_step_count,
                comparison.cptp_interval_count,
            )
            self.assertTrue(
                comparison.cptp_choi_minimum_eigenvalue >= -1e-12
            )

        self.assertGreater(distances[0], distances[1])
        self.assertGreater(distances[1], distances[2])
        self.assertLess(distances[2], 1e-7)

    def test_time_dependent_midpoint_path_converges_toward_rk4(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            target_rotation_angle_rad=1.1,
            sigma_us=0.07,
            truncation_sigma=3.0,
        )
        provider = TwoLevelPulseHamiltonian(
            envelope=envelope,
            phase_rad=0.27,
            detuning_rad_per_us=-0.19,
        )
        collapses = [scale(math.sqrt(0.025), SIGMA_MINUS)]
        distances = []

        for step in (0.04, 0.02, 0.01):
            comparison = compare_rk4_and_cptp(
                _state_zero(),
                provider,
                collapses,
                duration_us=envelope.duration_us,
                max_step_us=step,
            )
            distances.append(comparison.trace_distance)

        self.assertGreater(distances[0], distances[1])
        self.assertGreater(distances[1], distances[2])
        self.assertLess(distances[2], 0.002)

    def test_comparison_records_physicality_runtime_and_json(self) -> None:
        comparison = compare_rk4_and_cptp(
            _state_plus(),
            ConstantHamiltonian(zero_hamiltonian(2)),
            [scale(math.sqrt(0.11), SIGMA_MINUS)],
            duration_us=0.5,
            max_step_us=0.1,
            timing_repetitions=2,
        )
        payload = comparison.to_dict()

        self.assertEqual(payload["timing_repetitions"], 2)
        self.assertGreaterEqual(payload["rk4_runtime_median_ms"], 0.0)
        self.assertGreaterEqual(payload["cptp_runtime_median_ms"], 0.0)
        self.assertLessEqual(
            payload["cptp_physicality"]["trace_error"],
            1e-12,
        )
        self.assertLessEqual(
            payload["cptp_physicality"]["hermiticity_error"],
            1e-12,
        )
        self.assertGreaterEqual(
            payload["cptp_physicality"]["minimum_eigenvalue"],
            -1e-12,
        )
        json.dumps(payload)

    @unittest.skipUnless(
        is_rust_kernel_available(),
        "quantascope_rust is not importable",
    )
    def test_rust_comparison_matches_python_accuracy(self) -> None:
        provider = ConstantHamiltonian(scale(0.29, X))
        collapses = [scale(math.sqrt(0.13), SIGMA_MINUS)]
        python_result = compare_rk4_and_cptp(
            _state_plus(),
            provider,
            collapses,
            duration_us=0.6,
            max_step_us=0.1,
            backend="python",
        )
        rust_result = compare_rk4_and_cptp(
            _state_plus(),
            provider,
            collapses,
            duration_us=0.6,
            max_step_us=0.1,
            backend="rust",
        )

        self.assertAlmostEqual(
            rust_result.trace_distance,
            python_result.trace_distance,
            delta=1e-12,
        )
        self.assertAlmostEqual(
            rust_result.cptp_choi_minimum_eigenvalue,
            python_result.cptp_choi_minimum_eigenvalue,
            delta=1e-12,
        )

    def test_invalid_backend_and_repetitions_are_rejected(self) -> None:
        arguments = (
            _state_zero(),
            ConstantHamiltonian(zero_hamiltonian(2)),
            (),
            0.1,
            0.1,
        )
        with self.assertRaises(ValueError):
            compare_rk4_and_cptp(
                *arguments,
                backend="invalid",
            )
        with self.assertRaises(ValueError):
            compare_rk4_and_cptp(
                *arguments,
                timing_repetitions=0,
            )


def _state_zero() -> Matrix:
    return (
        (1.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j),
    )


def _state_plus() -> Matrix:
    return (
        (0.5 + 0.0j, 0.5 + 0.0j),
        (0.5 + 0.0j, 0.5 + 0.0j),
    )


if __name__ == "__main__":
    unittest.main()
