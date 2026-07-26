"""C0/C1 contract tests for explicit qubit Kraus channels."""

from __future__ import annotations

import math
import unittest

import numpy as np

from core.cptp import (
    CHOI_CONVENTION_ID,
    KrausChannel,
    KrausMap,
    amplitude_damping_channel,
    computational_measurement_channel,
    computational_measurement_instrument,
    depolarizing_channel,
    generalized_amplitude_damping_channel,
    phase_damping_channel,
    reset_to_zero_channel,
)
from core.gates import Matrix


TOLERANCE = 1e-12


class QubitKrausChannelTests(unittest.TestCase):
    def test_all_explicit_qubit_channels_are_cptp(self) -> None:
        channels = (
            amplitude_damping_channel(0.37),
            generalized_amplitude_damping_channel(0.42, 0.81),
            phase_damping_channel(0.29),
            depolarizing_channel(0.33),
            reset_to_zero_channel(),
            computational_measurement_channel(),
        )

        for channel in channels:
            with self.subTest(channel=channel.name):
                audit = channel.audit()
                self.assertEqual(
                    audit.choi_convention_id,
                    CHOI_CONVENTION_ID,
                )
                self.assertTrue(audit.is_completely_positive)
                self.assertTrue(audit.is_trace_preserving)
                self.assertTrue(audit.is_trace_nonincreasing)
                self.assertTrue(audit.is_cptp)
                self.assertAlmostEqual(
                    audit.choi_trace,
                    2.0,
                    delta=TOLERANCE,
                )
                self.assertLessEqual(
                    audit.trace_preservation_frobenius_error,
                    TOLERANCE,
                )
                self.assertGreaterEqual(
                    audit.choi_minimum_eigenvalue,
                    -TOLERANCE,
                )

    def test_choi_convention_for_identity_channel_is_fixed(self) -> None:
        identity = amplitude_damping_channel(0.0)

        _assert_matrix_close(
            self,
            identity.choi_matrix(),
            (
                (1.0, 0.0, 0.0, 1.0),
                (0.0, 0.0, 0.0, 0.0),
                (0.0, 0.0, 0.0, 0.0),
                (1.0, 0.0, 0.0, 1.0),
            ),
        )

    def test_amplitude_damping_matches_population_formula(self) -> None:
        probability = 0.36
        evolved = amplitude_damping_channel(probability).apply(_state_one())

        _assert_matrix_close(
            self,
            evolved,
            (
                (probability, 0.0),
                (0.0, 1.0 - probability),
            ),
        )

    def test_generalized_amplitude_damping_full_step_reaches_fixed_state(
        self,
    ) -> None:
        ground_population = 0.73
        channel = generalized_amplitude_damping_channel(
            1.0,
            ground_population,
        )

        for state in (_state_zero(), _state_one(), _state_plus()):
            with self.subTest(state=state):
                _assert_matrix_close(
                    self,
                    channel.apply(state),
                    (
                        (ground_population, 0.0),
                        (0.0, 1.0 - ground_population),
                    ),
                )

    def test_phase_damping_preserves_populations_and_scales_coherence(
        self,
    ) -> None:
        probability = 0.27
        evolved = phase_damping_channel(probability).apply(_state_plus())

        _assert_matrix_close(
            self,
            evolved,
            (
                (0.5, 0.5 * (1.0 - probability)),
                (0.5 * (1.0 - probability), 0.5),
            ),
        )

    def test_depolarizing_channel_matches_mixture_definition(self) -> None:
        probability = 0.4
        evolved = depolarizing_channel(probability).apply(_state_zero())

        _assert_matrix_close(
            self,
            evolved,
            (
                (1.0 - 0.5 * probability, 0.0),
                (0.0, 0.5 * probability),
            ),
        )

    def test_reset_channel_maps_every_normalized_state_to_zero(self) -> None:
        channel = reset_to_zero_channel()

        for state in (_state_zero(), _state_one(), _state_plus(), _mixed()):
            with self.subTest(state=state):
                _assert_matrix_close(self, channel.apply(state), _state_zero())

    def test_measurement_channel_and_instrument_are_classified_separately(
        self,
    ) -> None:
        state = _state_plus()
        outcome_zero, outcome_one = computational_measurement_instrument()
        zero_state = outcome_zero.apply(state)
        one_state = outcome_one.apply(state)
        discarded = computational_measurement_channel().apply(state)

        self.assertFalse(outcome_zero.audit().is_trace_preserving)
        self.assertFalse(outcome_one.audit().is_trace_preserving)
        self.assertTrue(outcome_zero.audit().is_completely_positive)
        self.assertTrue(outcome_one.audit().is_completely_positive)
        self.assertTrue(outcome_zero.audit().is_trace_nonincreasing)
        self.assertTrue(outcome_one.audit().is_trace_nonincreasing)
        self.assertAlmostEqual(_trace(zero_state), 0.5, delta=TOLERANCE)
        self.assertAlmostEqual(_trace(one_state), 0.5, delta=TOLERANCE)
        _assert_matrix_close(
            self,
            discarded,
            _matrix_sum(zero_state, one_state),
        )
        _assert_matrix_close(
            self,
            discarded,
            (
                (0.5, 0.0),
                (0.0, 0.5),
            ),
        )

    def test_channels_preserve_density_matrix_physicality(self) -> None:
        channels = (
            amplitude_damping_channel(0.61),
            generalized_amplitude_damping_channel(0.58, 0.76),
            phase_damping_channel(0.43),
            depolarizing_channel(0.52),
            reset_to_zero_channel(),
            computational_measurement_channel(),
        )
        states = (_state_zero(), _state_one(), _state_plus(), _mixed())

        for channel in channels:
            for state in states:
                with self.subTest(channel=channel.name, state=state):
                    _assert_density_matrix_physical(
                        self,
                        channel.apply(state),
                    )

    def test_invalid_probabilities_are_rejected(self) -> None:
        constructors = (
            lambda value: amplitude_damping_channel(value),
            lambda value: phase_damping_channel(value),
            lambda value: depolarizing_channel(value),
        )
        for constructor in constructors:
            for value in (-0.1, 1.1, math.nan, math.inf):
                with self.subTest(constructor=constructor, value=value):
                    with self.assertRaises(ValueError):
                        constructor(value)

    def test_non_trace_preserving_map_cannot_be_declared_a_channel(self) -> None:
        projector_zero: Matrix = (
            (1.0 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 0.0 + 0.0j),
        )

        with self.assertRaises(ValueError):
            KrausChannel(
                name="invalid_projector_channel",
                operators=(projector_zero,),
            )

        cp_map = KrausMap(
            name="valid_outcome_map",
            operators=(projector_zero,),
        )
        self.assertTrue(cp_map.audit().is_completely_positive)
        self.assertTrue(cp_map.audit().is_trace_nonincreasing)


def _state_zero() -> Matrix:
    return (
        (1.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 0.0 + 0.0j),
    )


def _state_one() -> Matrix:
    return (
        (0.0 + 0.0j, 0.0 + 0.0j),
        (0.0 + 0.0j, 1.0 + 0.0j),
    )


def _state_plus() -> Matrix:
    return (
        (0.5 + 0.0j, 0.5 + 0.0j),
        (0.5 + 0.0j, 0.5 + 0.0j),
    )


def _mixed() -> Matrix:
    return (
        (0.65 + 0.0j, 0.0 + 0.12j),
        (0.0 - 0.12j, 0.35 + 0.0j),
    )


def _trace(matrix: Matrix) -> float:
    return float(sum(matrix[index][index] for index in range(len(matrix))).real)


def _matrix_sum(left: Matrix, right: Matrix) -> Matrix:
    return tuple(
        tuple(
            left[row][column] + right[row][column]
            for column in range(len(left))
        )
        for row in range(len(left))
    )


def _assert_density_matrix_physical(
    test_case: unittest.TestCase,
    state: Matrix,
) -> None:
    array = np.asarray(state, dtype=np.complex128)
    test_case.assertTrue(
        np.allclose(array, array.conj().T, atol=TOLERANCE, rtol=0.0)
    )
    test_case.assertAlmostEqual(
        float(np.trace(array).real),
        1.0,
        delta=TOLERANCE,
    )
    test_case.assertGreaterEqual(
        float(np.min(np.linalg.eigvalsh(array))),
        -TOLERANCE,
    )


def _assert_matrix_close(
    test_case: unittest.TestCase,
    actual: Matrix,
    expected: Matrix,
) -> None:
    test_case.assertEqual(len(actual), len(expected))
    for row in range(len(expected)):
        for column in range(len(expected)):
            test_case.assertAlmostEqual(
                actual[row][column].real,
                complex(expected[row][column]).real,
                delta=TOLERANCE,
            )
            test_case.assertAlmostEqual(
                actual[row][column].imag,
                complex(expected[row][column]).imag,
                delta=TOLERANCE,
            )


if __name__ == "__main__":
    unittest.main()
