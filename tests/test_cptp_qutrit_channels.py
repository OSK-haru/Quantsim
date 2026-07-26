"""C2 contract tests for explicit qutrit Kraus channels."""

from __future__ import annotations

import math
import unittest

import numpy as np

from core.cptp_qutrit import (
    QUTRIT_DEPHASING_CONVENTION,
    QUTRIT_LEAKAGE_EVENT,
    qutrit_computational_measurement_channel,
    qutrit_computational_measurement_instrument,
    qutrit_downward_transition_channel,
    qutrit_leakage_channel,
    qutrit_number_dephasing_channel,
    qutrit_upward_transition_channel,
)
from core.gates import Matrix


TOLERANCE = 1e-12


class QutritKrausChannelTests(unittest.TestCase):
    def test_qutrit_convention_identifiers_are_fixed(self) -> None:
        self.assertEqual(
            QUTRIT_DEPHASING_CONVENTION,
            "number_operator_adjacent_factor_v1",
        )
        self.assertEqual(
            QUTRIT_LEAKAGE_EVENT,
            "incoherent_1_to_2_event_v1",
        )

    def test_all_explicit_qutrit_channels_are_cptp(self) -> None:
        channels = (
            qutrit_downward_transition_channel(1, 0.31),
            qutrit_downward_transition_channel(2, 0.47),
            qutrit_upward_transition_channel(0, 0.22),
            qutrit_upward_transition_channel(1, 0.38),
            qutrit_number_dephasing_channel(0.71),
            qutrit_leakage_channel(0.26),
            qutrit_computational_measurement_channel(),
        )

        for channel in channels:
            with self.subTest(channel=channel.name):
                audit = channel.audit()
                self.assertEqual(audit.dimension, 3)
                self.assertTrue(audit.is_completely_positive)
                self.assertTrue(audit.is_trace_preserving)
                self.assertTrue(audit.is_cptp)
                self.assertAlmostEqual(
                    audit.choi_trace,
                    3.0,
                    delta=TOLERANCE,
                )
                self.assertGreaterEqual(
                    audit.choi_minimum_eigenvalue,
                    -TOLERANCE,
                )

    def test_adjacent_transition_channels_move_only_source_population(
        self,
    ) -> None:
        cases = (
            (
                qutrit_downward_transition_channel(1, 0.35),
                1,
                0,
                0.35,
            ),
            (
                qutrit_downward_transition_channel(2, 0.42),
                2,
                1,
                0.42,
            ),
            (
                qutrit_upward_transition_channel(0, 0.28),
                0,
                1,
                0.28,
            ),
            (
                qutrit_upward_transition_channel(1, 0.54),
                1,
                2,
                0.54,
            ),
        )

        for channel, source, target, probability in cases:
            with self.subTest(channel=channel.name):
                evolved = channel.apply(_basis_state(source))
                expected = np.zeros((3, 3), dtype=np.complex128)
                expected[source, source] = 1.0 - probability
                expected[target, target] = probability
                _assert_matrix_close(self, evolved, _to_matrix(expected))

                untouched = next(
                    level
                    for level in range(3)
                    if level not in (source, target)
                )
                _assert_matrix_close(
                    self,
                    channel.apply(_basis_state(untouched)),
                    _basis_state(untouched),
                )

    def test_number_dephasing_matches_frozen_one_one_four_relation(
        self,
    ) -> None:
        eta = 0.64
        state = _equal_superposition_state()
        evolved = qutrit_number_dephasing_channel(eta).apply(state)

        for level in range(3):
            self.assertAlmostEqual(
                evolved[level][level].real,
                1.0 / 3.0,
                delta=TOLERANCE,
            )
        self.assertAlmostEqual(
            evolved[0][1].real,
            eta / 3.0,
            delta=TOLERANCE,
        )
        self.assertAlmostEqual(
            evolved[1][2].real,
            eta / 3.0,
            delta=TOLERANCE,
        )
        self.assertAlmostEqual(
            evolved[0][2].real,
            eta**4 / 3.0,
            delta=TOLERANCE,
        )

    def test_dephasing_endpoint_channels_have_expected_behavior(self) -> None:
        state = _equal_superposition_state()

        _assert_matrix_close(
            self,
            qutrit_number_dephasing_channel(1.0).apply(state),
            state,
        )
        _assert_matrix_close(
            self,
            qutrit_number_dephasing_channel(0.0).apply(state),
            (
                (1.0 / 3.0, 0.0, 0.0),
                (0.0, 1.0 / 3.0, 0.0),
                (0.0, 0.0, 1.0 / 3.0),
            ),
        )

    def test_leakage_channel_is_explicit_incoherent_one_to_two_event(
        self,
    ) -> None:
        probability = 0.37
        evolved = qutrit_leakage_channel(probability).apply(
            _basis_state(1)
        )

        _assert_matrix_close(
            self,
            evolved,
            (
                (0.0, 0.0, 0.0),
                (0.0, 1.0 - probability, 0.0),
                (0.0, 0.0, probability),
            ),
        )
        _assert_matrix_close(
            self,
            qutrit_leakage_channel(probability).apply(_basis_state(0)),
            _basis_state(0),
        )

    def test_qutrit_measurement_channel_and_instrument_are_separate(
        self,
    ) -> None:
        state = _equal_superposition_state()
        outcome_maps = qutrit_computational_measurement_instrument()
        outcome_states = tuple(
            outcome_map.apply(state) for outcome_map in outcome_maps
        )
        discarded = qutrit_computational_measurement_channel().apply(state)

        self.assertEqual(len(outcome_maps), 3)
        for outcome_map, outcome_state in zip(
            outcome_maps,
            outcome_states,
        ):
            audit = outcome_map.audit()
            self.assertTrue(audit.is_completely_positive)
            self.assertTrue(audit.is_trace_nonincreasing)
            self.assertFalse(audit.is_trace_preserving)
            self.assertAlmostEqual(
                _trace(outcome_state),
                1.0 / 3.0,
                delta=TOLERANCE,
            )

        _assert_matrix_close(
            self,
            discarded,
            _matrix_sum(outcome_states),
        )
        _assert_matrix_close(
            self,
            discarded,
            (
                (1.0 / 3.0, 0.0, 0.0),
                (0.0, 1.0 / 3.0, 0.0),
                (0.0, 0.0, 1.0 / 3.0),
            ),
        )

    def test_qutrit_channels_preserve_density_matrix_physicality(
        self,
    ) -> None:
        channels = (
            qutrit_downward_transition_channel(2, 0.63),
            qutrit_upward_transition_channel(1, 0.44),
            qutrit_number_dephasing_channel(0.52),
            qutrit_leakage_channel(0.36),
            qutrit_computational_measurement_channel(),
        )
        states = (
            _basis_state(0),
            _basis_state(1),
            _basis_state(2),
            _equal_superposition_state(),
            _mixed_state(),
        )

        for channel in channels:
            for state in states:
                with self.subTest(channel=channel.name, state=state):
                    _assert_density_matrix_physical(
                        self,
                        channel.apply(state),
                    )

    def test_invalid_qutrit_channel_parameters_are_rejected(self) -> None:
        for upper in (0, 3, -1, True, 1.5):
            with self.subTest(upper=upper):
                with self.assertRaises(ValueError):
                    qutrit_downward_transition_channel(upper, 0.2)
        for lower in (-1, 2, 3, False, 0.5):
            with self.subTest(lower=lower):
                with self.assertRaises(ValueError):
                    qutrit_upward_transition_channel(lower, 0.2)
        for probability in (-0.1, 1.1, math.nan, math.inf):
            with self.subTest(probability=probability):
                with self.assertRaises(ValueError):
                    qutrit_leakage_channel(probability)
        for eta in (-0.1, 1.1, math.nan, math.inf):
            with self.subTest(eta=eta):
                with self.assertRaises(ValueError):
                    qutrit_number_dephasing_channel(eta)


def _basis_state(level: int) -> Matrix:
    state = np.zeros((3, 3), dtype=np.complex128)
    state[level, level] = 1.0
    return _to_matrix(state)


def _equal_superposition_state() -> Matrix:
    return tuple(
        tuple(1.0 / 3.0 + 0.0j for _ in range(3))
        for _ in range(3)
    )


def _mixed_state() -> Matrix:
    return (
        (0.5 + 0.0j, 0.08 + 0.03j, 0.02 - 0.01j),
        (0.08 - 0.03j, 0.3 + 0.0j, 0.04 + 0.02j),
        (0.02 + 0.01j, 0.04 - 0.02j, 0.2 + 0.0j),
    )


def _trace(matrix: Matrix) -> float:
    return float(sum(matrix[index][index] for index in range(3)).real)


def _matrix_sum(matrices: tuple[Matrix, ...]) -> Matrix:
    total = np.zeros((3, 3), dtype=np.complex128)
    for matrix in matrices:
        total += np.asarray(matrix, dtype=np.complex128)
    return _to_matrix(total)


def _to_matrix(array: np.ndarray) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
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
    test_case.assertTrue(
        np.allclose(
            np.asarray(actual, dtype=np.complex128),
            np.asarray(expected, dtype=np.complex128),
            atol=TOLERANCE,
            rtol=0.0,
        )
    )


if __name__ == "__main__":
    unittest.main()
