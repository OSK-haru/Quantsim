"""C5 tests for time-independent GKSL exponential maps."""

from __future__ import annotations

import json
import math
import unittest

import numpy as np

from core.cptp import (
    amplitude_damping_channel,
    identity_channel_choi_fixture,
    phase_damping_channel,
)
from core.cptp_liouvillian import (
    LIOUVILLIAN_VECTORIZATION_ID,
    MATRIX_EXPONENTIAL_METHOD,
    apply_superoperator,
    dense_matrix_exponential,
    gksl_exponential_map,
    gksl_liouvillian_superoperator,
    superoperator_to_choi,
)
from core.cptp_qutrit import qutrit_downward_transition_channel
from core.gates import (
    Matrix,
    SIGMA_MINUS,
    X,
    Z,
    lindblad_rhs,
    scale,
    zero_hamiltonian,
)


TOLERANCE = 2e-11


class GKSLExponentialMapTests(unittest.TestCase):
    def test_liouvillian_matches_existing_lindblad_rhs(self) -> None:
        hamiltonian = scale(0.37, X)
        collapse_operators = [
            scale(math.sqrt(0.23), SIGMA_MINUS),
            scale(math.sqrt(0.11 / 2.0), Z),
        ]
        state = _matrix(
            (
                (0.62, 0.17 - 0.09j),
                (0.17 + 0.09j, 0.38),
            )
        )
        generator = np.asarray(
            gksl_liouvillian_superoperator(
                hamiltonian,
                collapse_operators,
            )
        )

        actual = (
            generator
            @ np.asarray(state).reshape(4, order="F")
        ).reshape((2, 2), order="F")
        expected = np.asarray(
            lindblad_rhs(
                state,
                hamiltonian,
                collapse_operators,
            )
        )

        np.testing.assert_allclose(actual, expected, atol=TOLERANCE, rtol=0.0)

    def test_dense_exponential_matches_diagonal_analytic_result(self) -> None:
        diagonal = np.diag((0.0, -0.3, 0.2j)).astype(np.complex128)

        actual = dense_matrix_exponential(diagonal)
        expected = np.diag(np.exp(np.diag(diagonal)))

        np.testing.assert_allclose(actual, expected, atol=TOLERANCE, rtol=0.0)

    def test_zero_duration_is_identity_channel(self) -> None:
        channel = gksl_exponential_map(
            scale(0.4, X),
            [scale(math.sqrt(0.2), SIGMA_MINUS)],
            0.0,
        )

        _assert_matrix_close(
            channel.choi_matrix,
            identity_channel_choi_fixture(2),
        )
        _assert_matrix_close(channel.apply(_state_plus()), _state_plus())
        self.assertTrue(channel.audit.is_cptp)

    def test_hamiltonian_only_map_matches_analytic_unitary(self) -> None:
        angular_rate = 1.3
        duration = 0.41
        channel = gksl_exponential_map(
            scale(0.5 * angular_rate, X),
            [],
            duration,
        )
        angle = angular_rate * duration
        unitary = (
            math.cos(angle / 2.0) * np.eye(2)
            - 1.0j * math.sin(angle / 2.0) * np.asarray(X)
        )
        state = np.asarray(_state_zero())
        expected = unitary @ state @ unitary.conj().T

        np.testing.assert_allclose(
            np.asarray(channel.apply(_state_zero())),
            expected,
            atol=TOLERANCE,
            rtol=0.0,
        )
        self.assertTrue(channel.audit.is_cptp)

    def test_relaxation_exponential_matches_amplitude_damping(self) -> None:
        rate = 0.37
        duration = 1.2
        transition_probability = 1.0 - math.exp(-rate * duration)
        exponential = gksl_exponential_map(
            zero_hamiltonian(2),
            [scale(math.sqrt(rate), SIGMA_MINUS)],
            duration,
        )
        kraus = amplitude_damping_channel(transition_probability)

        for state in (_state_zero(), _state_one(), _state_plus()):
            with self.subTest(state=state):
                _assert_matrix_close(
                    exponential.apply(state),
                    kraus.apply(state),
                )

    def test_dephasing_exponential_matches_phase_damping(self) -> None:
        rate = 0.29
        duration = 0.83
        coherence_loss = 1.0 - math.exp(-rate * duration)
        exponential = gksl_exponential_map(
            zero_hamiltonian(2),
            [scale(math.sqrt(rate / 2.0), Z)],
            duration,
        )
        kraus = phase_damping_channel(coherence_loss)

        _assert_matrix_close(
            exponential.apply(_state_plus()),
            kraus.apply(_state_plus()),
        )

    def test_qutrit_downward_exponential_matches_kraus_channel(self) -> None:
        rate = 0.21
        duration = 0.74
        transition_probability = 1.0 - math.exp(-rate * duration)
        collapse = np.zeros((3, 3), dtype=np.complex128)
        collapse[1, 2] = math.sqrt(rate)
        exponential = gksl_exponential_map(
            zero_hamiltonian(3),
            [_matrix(collapse)],
            duration,
        )
        kraus = qutrit_downward_transition_channel(
            2,
            transition_probability,
        )
        state = _matrix(
            (
                (0.1, 0.0, 0.0),
                (0.0, 0.2, 0.12),
                (0.0, 0.12, 0.7),
            )
        )

        _assert_matrix_close(
            exponential.apply(state),
            kraus.apply(state),
        )
        self.assertTrue(exponential.audit.is_cptp)

    def test_mixed_gksl_map_preserves_density_matrix_without_cleanup(
        self,
    ) -> None:
        channel = gksl_exponential_map(
            scale(0.43, X),
            [
                scale(math.sqrt(0.19), SIGMA_MINUS),
                scale(math.sqrt(0.07 / 2.0), Z),
            ],
            0.91,
        )
        evolved = np.asarray(channel.apply(_state_plus()))
        hermitian = 0.5 * (evolved + evolved.conj().T)

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

    def test_time_independent_map_obeys_semigroup_property(self) -> None:
        hamiltonian = scale(0.31, X)
        collapses = [
            scale(math.sqrt(0.17), SIGMA_MINUS),
            scale(math.sqrt(0.05 / 2.0), Z),
        ]
        first = gksl_exponential_map(hamiltonian, collapses, 0.37)
        second = gksl_exponential_map(hamiltonian, collapses, 0.52)
        combined = gksl_exponential_map(hamiltonian, collapses, 0.89)

        sequential = second.apply(first.apply(_state_plus()))
        _assert_matrix_close(
            combined.apply(_state_plus()),
            sequential,
        )
        np.testing.assert_allclose(
            np.asarray(combined.superoperator),
            np.asarray(second.superoperator) @ np.asarray(first.superoperator),
            atol=TOLERANCE,
            rtol=0.0,
        )

    def test_metadata_identifies_conventions_and_is_json_safe(self) -> None:
        channel = gksl_exponential_map(
            zero_hamiltonian(2),
            [],
            0.2,
            name="idle_fixture",
        )
        metadata = channel.to_metadata()

        self.assertEqual(metadata["name"], "idle_fixture")
        self.assertEqual(
            metadata["vectorization_id"],
            LIOUVILLIAN_VECTORIZATION_ID,
        )
        self.assertEqual(
            metadata["exponential_method"],
            MATRIX_EXPONENTIAL_METHOD,
        )
        self.assertTrue(metadata["audit"]["is_cptp"])
        json.dumps(metadata)

    def test_invalid_inputs_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            gksl_liouvillian_superoperator(
                _matrix(((0.0, 1.0), (0.0, 0.0))),
                [],
            )
        with self.assertRaises(ValueError):
            gksl_liouvillian_superoperator(
                zero_hamiltonian(2),
                [zero_hamiltonian(3)],
            )
        for duration in (-0.1, math.nan, math.inf):
            with self.subTest(duration=duration):
                with self.assertRaises(ValueError):
                    gksl_exponential_map(
                        zero_hamiltonian(2),
                        [],
                        duration,
                    )
        with self.assertRaises(ValueError):
            apply_superoperator(
                _matrix(np.eye(3)),
                _state_zero(),
                2,
            )
        with self.assertRaises(ValueError):
            superoperator_to_choi(
                _matrix(np.eye(4)),
                0,
            )


def _state_zero() -> Matrix:
    return _matrix(((1.0, 0.0), (0.0, 0.0)))


def _state_one() -> Matrix:
    return _matrix(((0.0, 0.0), (0.0, 1.0)))


def _state_plus() -> Matrix:
    return _matrix(((0.5, 0.5), (0.5, 0.5)))


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
