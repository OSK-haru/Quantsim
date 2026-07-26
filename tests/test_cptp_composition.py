"""C4 tests for ordered Kraus-map and CPTP-channel composition."""

from __future__ import annotations

import unittest

import numpy as np

from core.cptp import (
    KrausChannel,
    amplitude_damping_channel,
    audit_choi_matrix,
    compose_kraus_channels,
    compose_kraus_maps,
    computational_measurement_instrument,
    depolarizing_channel,
    phase_damping_channel,
    reset_to_zero_channel,
)
from core.cptp_qutrit import (
    qutrit_downward_transition_channel,
    qutrit_number_dephasing_channel,
)
from core.gates import Matrix


TOLERANCE = 1e-12


class KrausCompositionTests(unittest.TestCase):
    def test_composed_channel_matches_listed_sequential_execution(self) -> None:
        channels = (
            amplitude_damping_channel(0.31),
            phase_damping_channel(0.27),
            depolarizing_channel(0.18),
        )
        state = _qubit_state()

        composed = compose_kraus_channels(channels)
        expected = _apply_sequence(state, channels)

        _assert_matrix_close(self, composed.apply(state), expected)
        self.assertEqual(
            len(composed.operators),
            np.prod([len(channel.operators) for channel in channels]),
        )
        self.assertIn(channels[0].name, composed.name)
        self.assertIn(channels[-1].name, composed.name)

    def test_qubit_noncommuting_order_is_explicit(self) -> None:
        bit_flip = KrausChannel(
            name="qubit_x",
            operators=((
                (0.0 + 0.0j, 1.0 + 0.0j),
                (1.0 + 0.0j, 0.0 + 0.0j),
            ),),
        )
        damping = amplitude_damping_channel(0.4)
        state_one: Matrix = (
            (0.0 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 1.0 + 0.0j),
        )

        damping_then_flip = compose_kraus_channels((damping, bit_flip))
        flip_then_damping = compose_kraus_channels((bit_flip, damping))

        _assert_matrix_close(
            self,
            damping_then_flip.apply(state_one),
            _apply_sequence(state_one, (damping, bit_flip)),
        )
        _assert_matrix_close(
            self,
            flip_then_damping.apply(state_one),
            _apply_sequence(state_one, (bit_flip, damping)),
        )
        self.assertFalse(
            np.allclose(
                damping_then_flip.apply(state_one),
                flip_then_damping.apply(state_one),
                atol=TOLERANCE,
                rtol=0.0,
            )
        )

    def test_qutrit_transition_order_changes_cascade_result(self) -> None:
        down_21 = qutrit_downward_transition_channel(2, 0.6)
        down_10 = qutrit_downward_transition_channel(1, 0.7)
        state_two = _qutrit_basis_state(2)

        cascade = compose_kraus_channels((down_21, down_10))
        reverse = compose_kraus_channels((down_10, down_21))

        _assert_matrix_close(
            self,
            cascade.apply(state_two),
            (
                (0.42, 0.0, 0.0),
                (0.0, 0.18, 0.0),
                (0.0, 0.0, 0.4),
            ),
        )
        self.assertAlmostEqual(
            reverse.apply(state_two)[0][0].real,
            0.0,
            delta=TOLERANCE,
        )

    def test_composed_qubit_and_qutrit_channels_remain_cptp(self) -> None:
        composed_channels = (
            compose_kraus_channels((
                amplitude_damping_channel(0.23),
                phase_damping_channel(0.41),
            )),
            compose_kraus_channels((
                qutrit_downward_transition_channel(2, 0.37),
                qutrit_number_dephasing_channel(0.72),
            )),
        )

        for channel in composed_channels:
            with self.subTest(channel=channel.name):
                self.assertTrue(channel.audit().is_cptp)
                self.assertTrue(
                    audit_choi_matrix(
                        channel.choi_matrix(),
                        channel.dimension,
                    ).is_cptp
                )

    def test_trace_nonincreasing_instrument_composition_stays_separate(
        self,
    ) -> None:
        _, outcome_one = computational_measurement_instrument()
        composed_map = compose_kraus_maps((
            outcome_one,
            reset_to_zero_channel(),
        ))
        state = _qubit_state()

        audit = composed_map.audit()
        self.assertTrue(audit.is_completely_positive)
        self.assertTrue(audit.is_trace_nonincreasing)
        self.assertFalse(audit.is_trace_preserving)
        self.assertAlmostEqual(
            _trace(composed_map.apply(state)),
            state[1][1].real,
            delta=TOLERANCE,
        )

    def test_custom_composition_name_is_preserved(self) -> None:
        composed = compose_kraus_channels(
            (
                amplitude_damping_channel(0.1),
                phase_damping_channel(0.2),
            ),
            name="custom_qubit_sequence",
        )

        self.assertEqual(composed.name, "custom_qubit_sequence")

    def test_invalid_compositions_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            compose_kraus_maps(())
        with self.assertRaises(ValueError):
            compose_kraus_channels(())
        with self.assertRaises(ValueError):
            compose_kraus_maps((
                amplitude_damping_channel(0.2),
                qutrit_downward_transition_channel(1, 0.2),
            ))
        with self.assertRaises(ValueError):
            compose_kraus_channels((
                computational_measurement_instrument()[0],
                reset_to_zero_channel(),
            ))


def _apply_sequence(state: Matrix, maps) -> Matrix:
    evolved = state
    for kraus_map in maps:
        evolved = kraus_map.apply(evolved)
    return evolved


def _qubit_state() -> Matrix:
    return (
        (0.58 + 0.0j, 0.14 + 0.06j),
        (0.14 - 0.06j, 0.42 + 0.0j),
    )


def _qutrit_basis_state(level: int) -> Matrix:
    state = np.zeros((3, 3), dtype=np.complex128)
    state[level, level] = 1.0
    return _to_matrix(state)


def _trace(matrix: Matrix) -> float:
    return float(
        sum(matrix[index][index] for index in range(len(matrix))).real
    )


def _to_matrix(array: np.ndarray) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
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
