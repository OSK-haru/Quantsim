"""C3 tests for the standalone Choi convention and audit."""

from __future__ import annotations

import json
import unittest

import numpy as np

from core.cptp import (
    CHOI_CONVENTION_ID,
    amplitude_damping_channel,
    audit_choi_matrix,
    choi_partial_trace_input,
    choi_partial_trace_output,
    identity_channel_choi_fixture,
    reset_to_zero_channel,
)
from core.cptp_qutrit import qutrit_number_dephasing_channel
from core.gates import Matrix


TOLERANCE = 1e-12


class ChoiAuditTests(unittest.TestCase):
    def test_identity_fixtures_fix_qubit_and_qutrit_convention(self) -> None:
        for dimension in (2, 3):
            with self.subTest(dimension=dimension):
                fixture = identity_channel_choi_fixture(dimension)
                audit = audit_choi_matrix(fixture, dimension)

                self.assertEqual(
                    audit.choi_convention_id,
                    CHOI_CONVENTION_ID,
                )
                self.assertTrue(audit.is_cptp)
                self.assertEqual(audit.choi_numerical_rank, 1)
                self.assertAlmostEqual(
                    audit.choi_trace,
                    float(dimension),
                    delta=TOLERANCE,
                )
                _assert_matrix_close(
                    self,
                    choi_partial_trace_output(fixture, dimension),
                    _identity(dimension),
                )
                _assert_matrix_close(
                    self,
                    choi_partial_trace_input(fixture, dimension),
                    _identity(dimension),
                )

    def test_kraus_and_choi_trace_preservation_audits_agree(self) -> None:
        channels = (
            amplitude_damping_channel(0.43),
            reset_to_zero_channel(),
            qutrit_number_dephasing_channel(0.68),
        )

        for channel in channels:
            with self.subTest(channel=channel.name):
                kraus_audit = channel.audit()
                choi_audit = audit_choi_matrix(
                    channel.choi_matrix(),
                    channel.dimension,
                )
                self.assertTrue(kraus_audit.is_cptp)
                self.assertTrue(choi_audit.is_cptp)
                self.assertAlmostEqual(
                    kraus_audit.trace_preservation_frobenius_error,
                    kraus_audit.choi_trace_preservation_frobenius_error,
                    delta=TOLERANCE,
                )
                self.assertAlmostEqual(
                    kraus_audit.choi_minimum_eigenvalue,
                    choi_audit.choi_minimum_eigenvalue,
                    delta=TOLERANCE,
                )

    def test_reset_channel_is_tp_but_not_unital(self) -> None:
        reset_choi = reset_to_zero_channel().choi_matrix()

        _assert_matrix_close(
            self,
            choi_partial_trace_output(reset_choi, 2),
            _identity(2),
        )
        _assert_matrix_close(
            self,
            choi_partial_trace_input(reset_choi, 2),
            (
                (2.0, 0.0),
                (0.0, 0.0),
            ),
        )

    def test_transpose_map_is_tp_but_not_completely_positive(self) -> None:
        transpose_choi: Matrix = (
            (1.0, 0.0, 0.0, 0.0),
            (0.0, 0.0, 1.0, 0.0),
            (0.0, 1.0, 0.0, 0.0),
            (0.0, 0.0, 0.0, 1.0),
        )

        audit = audit_choi_matrix(transpose_choi, 2)

        self.assertTrue(audit.is_trace_preserving)
        self.assertFalse(audit.is_completely_positive)
        self.assertFalse(audit.is_cptp)
        self.assertAlmostEqual(
            audit.choi_minimum_eigenvalue,
            -1.0,
            delta=TOLERANCE,
        )

    def test_scaled_identity_map_is_cp_but_not_tp(self) -> None:
        scaled_identity = _scale_matrix(
            identity_channel_choi_fixture(2),
            0.5,
        )

        audit = audit_choi_matrix(scaled_identity, 2)

        self.assertTrue(audit.is_completely_positive)
        self.assertFalse(audit.is_trace_preserving)
        self.assertFalse(audit.is_cptp)

    def test_nonhermitian_choi_is_not_classified_as_cp(self) -> None:
        malformed = np.asarray(
            identity_channel_choi_fixture(2),
            dtype=np.complex128,
        )
        malformed[0, 1] = 0.1j

        audit = audit_choi_matrix(_to_matrix(malformed), 2)

        self.assertGreater(audit.choi_hermiticity_error, 0.0)
        self.assertFalse(audit.is_completely_positive)
        self.assertFalse(audit.is_cptp)

    def test_audit_metadata_is_json_serializable(self) -> None:
        channel_audit = amplitude_damping_channel(0.25).audit().to_dict()
        choi_audit = audit_choi_matrix(
            identity_channel_choi_fixture(3),
            3,
        ).to_dict()

        encoded = json.dumps({
            "channel": channel_audit,
            "choi": choi_audit,
        })
        decoded = json.loads(encoded)

        self.assertTrue(decoded["channel"]["is_cptp"])
        self.assertTrue(decoded["choi"]["is_cptp"])
        self.assertEqual(
            decoded["choi"]["choi_convention_id"],
            CHOI_CONVENTION_ID,
        )

    def test_invalid_choi_dimensions_and_tolerances_are_rejected(self) -> None:
        fixture = identity_channel_choi_fixture(2)

        for dimension in (0, -1, True, 1.5):
            with self.subTest(dimension=dimension):
                with self.assertRaises(ValueError):
                    audit_choi_matrix(fixture, dimension)
        with self.assertRaises(ValueError):
            audit_choi_matrix(_identity(3), 2)
        with self.assertRaises(ValueError):
            audit_choi_matrix(fixture, 2, cp_tolerance=-1.0)
        with self.assertRaises(ValueError):
            audit_choi_matrix(fixture, 2, tp_tolerance=-1.0)


def _identity(dimension: int) -> Matrix:
    return _to_matrix(np.eye(dimension, dtype=np.complex128))


def _scale_matrix(matrix: Matrix, scalar: float) -> Matrix:
    return _to_matrix(np.asarray(matrix, dtype=np.complex128) * scalar)


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
