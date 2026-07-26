"""C6 tests for piecewise time-dependent GKSL evolution."""

from __future__ import annotations

import json
import math
import unittest

import numpy as np

from core.cptp_liouvillian import gksl_exponential_map
from core.cptp_piecewise import (
    PIECEWISE_SAMPLING_ID,
    piecewise_gksl_exponential_map,
)
from core.gates import (
    Matrix,
    SIGMA_MINUS,
    X,
    Z,
    scale,
    zero_hamiltonian,
)
from core.pulse_evolution import ConstantHamiltonian


TOLERANCE = 3e-11


class RecordingHamiltonian:
    def __init__(self, matrix: Matrix) -> None:
        self.matrix = matrix
        self.evaluation_times: list[float] = []

    def evaluate(self, local_time_us: float) -> Matrix:
        self.evaluation_times.append(local_time_us)
        return self.matrix


class SwitchingHamiltonian:
    def __init__(self, first: Matrix, second: Matrix) -> None:
        self.first = first
        self.second = second

    def evaluate(self, local_time_us: float) -> Matrix:
        return self.first if local_time_us < 0.5 else self.second


class SinusoidalXHamiltonian:
    def __init__(
        self,
        duration_us: float,
        base_rate: float,
        modulation_rate: float,
    ) -> None:
        self.duration_us = duration_us
        self.base_rate = base_rate
        self.modulation_rate = modulation_rate

    def evaluate(self, local_time_us: float) -> Matrix:
        angular_rate = (
            self.base_rate
            + self.modulation_rate
            * math.sin(math.pi * local_time_us / self.duration_us)
        )
        return scale(0.5 * angular_rate, X)


class ChangingDimensionHamiltonian:
    def evaluate(self, local_time_us: float) -> Matrix:
        if local_time_us < 0.5:
            return zero_hamiltonian(2)
        return zero_hamiltonian(3)


class PiecewiseGKSLMapTests(unittest.TestCase):
    def test_constant_hamiltonian_matches_single_c5_exponential(self) -> None:
        hamiltonian = scale(0.39, X)
        collapses = [
            scale(math.sqrt(0.17), SIGMA_MINUS),
            scale(math.sqrt(0.06 / 2.0), Z),
        ]
        piecewise = piecewise_gksl_exponential_map(
            ConstantHamiltonian(hamiltonian),
            collapses,
            duration_us=0.83,
            max_interval_us=0.2,
        )
        constant = gksl_exponential_map(
            hamiltonian,
            collapses,
            duration_us=0.83,
        )

        _assert_matrix_close(
            piecewise.superoperator,
            constant.superoperator,
        )
        _assert_matrix_close(
            piecewise.apply(_state_plus()),
            constant.apply(_state_plus()),
        )

    def test_intervals_use_midpoints_and_reach_exact_duration(self) -> None:
        provider = RecordingHamiltonian(zero_hamiltonian(2))

        channel = piecewise_gksl_exponential_map(
            provider,
            [],
            duration_us=0.25,
            max_interval_us=0.1,
        )

        np.testing.assert_allclose(
            provider.evaluation_times,
            (0.05, 0.15, 0.225),
            atol=1e-15,
            rtol=0.0,
        )
        self.assertEqual(len(channel.intervals), 3)
        self.assertEqual(channel.intervals[0].start_time_us, 0.0)
        self.assertEqual(channel.intervals[-1].end_time_us, 0.25)
        self.assertAlmostEqual(
            sum(interval.duration_us for interval in channel.intervals),
            0.25,
            delta=1e-15,
        )
        self.assertTrue(
            all(
                interval.duration_us <= 0.1 + 1e-15
                for interval in channel.intervals
            )
        )

    def test_noncommuting_intervals_are_composed_in_time_order(self) -> None:
        first_hamiltonian = scale(0.5 * math.pi, X)
        second_hamiltonian = scale(0.5 * math.pi, Z)
        piecewise = piecewise_gksl_exponential_map(
            SwitchingHamiltonian(
                first_hamiltonian,
                second_hamiltonian,
            ),
            [],
            duration_us=1.0,
            max_interval_us=0.5,
        )
        first = gksl_exponential_map(first_hamiltonian, [], 0.5)
        second = gksl_exponential_map(second_hamiltonian, [], 0.5)
        expected = second.apply(first.apply(_state_zero()))

        _assert_matrix_close(
            piecewise.apply(_state_zero()),
            expected,
        )

        reversed_order = piecewise_gksl_exponential_map(
            SwitchingHamiltonian(
                second_hamiltonian,
                first_hamiltonian,
            ),
            [],
            duration_us=1.0,
            max_interval_us=0.5,
        )
        difference = np.linalg.norm(
            np.asarray(piecewise.apply(_state_zero()))
            - np.asarray(reversed_order.apply(_state_zero())),
            ord="fro",
        )
        self.assertGreater(float(difference), 0.1)

    def test_each_interval_and_composed_map_are_cptp(self) -> None:
        channel = piecewise_gksl_exponential_map(
            SinusoidalXHamiltonian(1.0, 0.7, 0.4),
            [scale(math.sqrt(0.13), SIGMA_MINUS)],
            duration_us=1.0,
            max_interval_us=0.125,
        )

        self.assertTrue(channel.audit.is_cptp)
        self.assertTrue(
            all(
                interval.channel.audit.is_cptp
                for interval in channel.intervals
            )
        )

    def test_midpoint_refinement_converges_for_commuting_drive(self) -> None:
        duration = 1.0
        base_rate = 0.6
        modulation_rate = 0.8
        provider = SinusoidalXHamiltonian(
            duration,
            base_rate,
            modulation_rate,
        )
        exact_angle = (
            base_rate * duration
            + 2.0 * modulation_rate * duration / math.pi
        )
        unitary = (
            math.cos(exact_angle / 2.0) * np.eye(2)
            - 1.0j * math.sin(exact_angle / 2.0) * np.asarray(X)
        )
        initial = np.asarray(_state_zero())
        exact = unitary @ initial @ unitary.conj().T
        errors = []

        for max_interval in (0.5, 0.25, 0.125, 0.0625):
            channel = piecewise_gksl_exponential_map(
                provider,
                [],
                duration_us=duration,
                max_interval_us=max_interval,
            )
            errors.append(float(np.linalg.norm(
                np.asarray(channel.apply(_state_zero())) - exact,
                ord="fro",
            )))

        self.assertGreater(errors[0], errors[1])
        self.assertGreater(errors[1], errors[2])
        self.assertGreater(errors[2], errors[3])
        self.assertLess(errors[3], 0.0006)

    def test_qutrit_piecewise_map_preserves_physicality_without_cleanup(
        self,
    ) -> None:
        collapse = np.zeros((3, 3), dtype=np.complex128)
        collapse[1, 2] = math.sqrt(0.18)
        drive = np.zeros((3, 3), dtype=np.complex128)
        drive[0, 1] = 0.24
        drive[1, 0] = 0.24
        drive[2, 2] = -0.31
        channel = piecewise_gksl_exponential_map(
            ConstantHamiltonian(_matrix(drive)),
            [_matrix(collapse)],
            duration_us=0.7,
            max_interval_us=0.16,
        )
        evolved = np.asarray(channel.apply(_qutrit_state()))
        hermitian = 0.5 * (evolved + evolved.conj().T)

        self.assertEqual(channel.dimension, 3)
        self.assertTrue(channel.audit.is_cptp)
        self.assertAlmostEqual(float(np.trace(evolved).real), 1.0, delta=TOLERANCE)
        self.assertLessEqual(
            float(np.max(np.abs(evolved - evolved.conj().T))),
            TOLERANCE,
        )
        self.assertGreaterEqual(
            float(np.min(np.linalg.eigvalsh(hermitian))),
            -TOLERANCE,
        )

    def test_metadata_records_interval_audits_and_is_json_safe(self) -> None:
        channel = piecewise_gksl_exponential_map(
            ConstantHamiltonian(zero_hamiltonian(2)),
            [],
            duration_us=0.3,
            max_interval_us=0.1,
            name="metadata_fixture",
        )
        metadata = channel.to_metadata()

        self.assertEqual(metadata["name"], "metadata_fixture")
        self.assertEqual(metadata["sampling_id"], PIECEWISE_SAMPLING_ID)
        self.assertEqual(metadata["interval_count"], 3)
        self.assertTrue(metadata["audit"]["is_cptp"])
        self.assertTrue(
            all(
                interval["audit"]["is_cptp"]
                for interval in metadata["intervals"]
            )
        )
        json.dumps(metadata)

    def test_invalid_duration_interval_and_dimension_are_rejected(
        self,
    ) -> None:
        provider = ConstantHamiltonian(zero_hamiltonian(2))
        for duration, max_interval in (
            (0.0, 0.1),
            (-0.1, 0.1),
            (math.nan, 0.1),
            (0.1, 0.0),
            (0.1, -0.1),
            (0.1, math.inf),
        ):
            with self.subTest(
                duration=duration,
                max_interval=max_interval,
            ):
                with self.assertRaises(ValueError):
                    piecewise_gksl_exponential_map(
                        provider,
                        [],
                        duration,
                        max_interval,
                    )

        with self.assertRaises(ValueError):
            piecewise_gksl_exponential_map(
                ChangingDimensionHamiltonian(),
                [],
                duration_us=1.0,
                max_interval_us=0.5,
            )


def _state_zero() -> Matrix:
    return _matrix(((1.0, 0.0), (0.0, 0.0)))


def _state_plus() -> Matrix:
    return _matrix(((0.5, 0.5), (0.5, 0.5)))


def _qutrit_state() -> Matrix:
    return _matrix(
        (
            (0.55, 0.15, 0.0),
            (0.15, 0.35, 0.0),
            (0.0, 0.0, 0.1),
        )
    )


def _matrix(values: object) -> Matrix:
    array = np.asarray(values, dtype=np.complex128)
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
    )


def _assert_matrix_close(actual: Matrix, expected: Matrix) -> None:
    np.testing.assert_allclose(
        np.asarray(actual),
        np.asarray(expected),
        atol=TOLERANCE,
        rtol=0.0,
    )


if __name__ == "__main__":
    unittest.main()
