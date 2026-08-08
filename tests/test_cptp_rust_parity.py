"""C7 Python-Rust parity tests for explicit CPTP evolution."""

from __future__ import annotations

import json
import math
import unittest

import numpy as np

from core.cptp_liouvillian import gksl_exponential_map
from core.cptp_piecewise import piecewise_gksl_exponential_map
from core.cptp_rust import (
    RUST_EXPONENTIAL_METHOD,
    rust_gksl_exponential_map,
    rust_piecewise_gksl_exponential_map,
)
from core.gates import (
    Matrix,
    SIGMA_MINUS,
    X,
    Z,
    scale,
    zero_hamiltonian,
)
from core.pulse_envelopes import (
    GaussianPulseEnvelope,
    TwoLevelPulseHamiltonian,
)
from core.pulse_qutrit import QutritPulseHamiltonian
from core.pulse_qutrit_contract import mhz_to_rad_per_us
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    qutrit_collapse_operator_matrices,
)
from core.rust_dense_kernel import (
    is_rust_kernel_available,
    rust_gksl_exponential_superoperator,
    rust_gksl_piecewise_superoperator,
)


TOLERANCE = 2e-11


class SwitchingHamiltonian:
    def __init__(self, first: Matrix, second: Matrix) -> None:
        self.first = first
        self.second = second

    def evaluate(self, local_time_us: float) -> Matrix:
        return self.first if local_time_us < 0.5 else self.second


@unittest.skipUnless(
    is_rust_kernel_available(),
    "yuragi_strider_rust is not importable",
)
class RustCPTPParityTests(unittest.TestCase):
    def test_qubit_open_system_exponential_matches_python(self) -> None:
        hamiltonian = scale(0.37, X)
        collapses = [
            scale(math.sqrt(0.23), SIGMA_MINUS),
            scale(math.sqrt(0.11 / 2.0), Z),
        ]

        python_map = gksl_exponential_map(
            hamiltonian,
            collapses,
            0.81,
        )
        rust_map = rust_gksl_exponential_map(
            hamiltonian,
            collapses,
            0.81,
        )

        _assert_map_parity(python_map, rust_map, _state_plus())

    def test_qutrit_open_system_exponential_matches_python(self) -> None:
        hamiltonian_array = np.asarray(
            (
                (0.0, 0.21 - 0.04j, 0.0),
                (0.21 + 0.04j, -0.17, 0.29),
                (0.0, 0.29, -1.2),
            ),
            dtype=np.complex128,
        )
        collapse = np.zeros((3, 3), dtype=np.complex128)
        collapse[1, 2] = math.sqrt(0.19)
        hamiltonian = _matrix(hamiltonian_array)
        collapses = [_matrix(collapse)]

        python_map = gksl_exponential_map(
            hamiltonian,
            collapses,
            0.43,
        )
        rust_map = rust_gksl_exponential_map(
            hamiltonian,
            collapses,
            0.43,
        )

        _assert_map_parity(python_map, rust_map, _qutrit_state())

    def test_zero_duration_identity_matches_python(self) -> None:
        hamiltonian = scale(0.52, X)
        collapses = [scale(math.sqrt(0.14), SIGMA_MINUS)]

        python_map = gksl_exponential_map(
            hamiltonian,
            collapses,
            0.0,
        )
        rust_map = rust_gksl_exponential_map(
            hamiltonian,
            collapses,
            0.0,
        )

        _assert_map_parity(python_map, rust_map, _state_plus())

    def test_noncommuting_piecewise_composition_matches_python(self) -> None:
        provider = SwitchingHamiltonian(
            scale(0.5 * math.pi, X),
            scale(0.5 * math.pi, Z),
        )

        python_map = piecewise_gksl_exponential_map(
            provider,
            [],
            duration_us=1.0,
            max_interval_us=0.5,
        )
        rust_map = rust_piecewise_gksl_exponential_map(
            provider,
            [],
            duration_us=1.0,
            max_interval_us=0.5,
        )

        _assert_piecewise_parity(
            python_map,
            rust_map,
            _state_zero(),
        )

    def test_two_level_gaussian_pulse_matches_python(self) -> None:
        provider = TwoLevelPulseHamiltonian(
            envelope=GaussianPulseEnvelope.from_target_rotation_angle(
                target_rotation_angle_rad=1.17,
                sigma_us=0.07,
                truncation_sigma=3.0,
            ),
            phase_rad=0.31,
            detuning_rad_per_us=-0.22,
        )
        collapses = [
            scale(math.sqrt(0.031), SIGMA_MINUS),
            scale(math.sqrt(0.016 / 2.0), Z),
        ]
        duration = provider.envelope.duration_us

        python_map = piecewise_gksl_exponential_map(
            provider,
            collapses,
            duration_us=duration,
            max_interval_us=0.015,
        )
        rust_map = rust_piecewise_gksl_exponential_map(
            provider,
            collapses,
            duration_us=duration,
            max_interval_us=0.015,
        )

        _assert_piecewise_parity(
            python_map,
            rust_map,
            _state_zero(),
        )

    def test_qutrit_drag_pulse_matches_python(self) -> None:
        envelope = GaussianPulseEnvelope.from_target_rotation_angle(
            target_rotation_angle_rad=1.09,
            sigma_us=0.055,
            truncation_sigma=3.0,
        )
        provider = QutritPulseHamiltonian(
            envelope=envelope,
            anharmonicity_rad_per_us=mhz_to_rad_per_us(-215.0),
            phase_rad=-0.27,
            detuning_rad_per_us=0.19,
            drag_beta_us=0.012,
        )
        rates = QutritDissipationRates(
            input_mode="direct_rates",
            gamma_10_down_per_us=0.028,
            gamma_01_up_per_us=0.004,
            gamma_21_down_per_us=0.047,
            gamma_12_up_per_us=0.006,
            gamma_phi_adjacent_per_us=0.018,
        )
        collapses = qutrit_collapse_operator_matrices(rates)

        python_map = piecewise_gksl_exponential_map(
            provider,
            collapses,
            duration_us=envelope.duration_us,
            max_interval_us=0.012,
        )
        rust_map = rust_piecewise_gksl_exponential_map(
            provider,
            collapses,
            duration_us=envelope.duration_us,
            max_interval_us=0.012,
        )

        _assert_piecewise_parity(
            python_map,
            rust_map,
            _qutrit_state(),
        )

    def test_rust_piecewise_kernel_matches_sequential_rust_maps(self) -> None:
        hamiltonians = (
            scale(0.31, X),
            scale(-0.27, Z),
            scale(0.19, X),
        )
        durations = (0.13, 0.21, 0.17)
        collapses = [scale(math.sqrt(0.08), SIGMA_MINUS)]
        composed = rust_gksl_piecewise_superoperator(
            hamiltonians,
            durations,
            collapses,
        )
        expected = np.eye(4, dtype=np.complex128)
        for hamiltonian, duration in zip(hamiltonians, durations):
            interval = rust_gksl_exponential_superoperator(
                hamiltonian,
                collapses,
                duration,
            )
            expected = np.asarray(interval) @ expected

        np.testing.assert_allclose(
            np.asarray(composed),
            expected,
            atol=TOLERANCE,
            rtol=0.0,
        )

    def test_metadata_identifies_rust_exponential_method(self) -> None:
        rust_map = rust_piecewise_gksl_exponential_map(
            SwitchingHamiltonian(
                scale(0.2, X),
                scale(0.3, Z),
            ),
            [],
            duration_us=1.0,
            max_interval_us=0.5,
            name="rust_metadata_fixture",
        )
        metadata = rust_map.to_metadata()

        self.assertTrue(metadata["audit"]["is_cptp"])
        self.assertTrue(
            all(
                interval["exponential_method"]
                == RUST_EXPONENTIAL_METHOD
                for interval in metadata["intervals"]
            )
        )
        json.dumps(metadata)

    def test_invalid_rust_inputs_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            rust_gksl_exponential_superoperator(
                zero_hamiltonian(2),
                [],
                -0.1,
            )
        with self.assertRaises(ValueError):
            rust_gksl_exponential_superoperator(
                _matrix(((0.0, 1.0), (0.0, 0.0))),
                [],
                0.1,
            )
        with self.assertRaises(ValueError):
            rust_gksl_piecewise_superoperator(
                (zero_hamiltonian(2),),
                (),
                [],
            )
        with self.assertRaises(ValueError):
            rust_gksl_piecewise_superoperator(
                (zero_hamiltonian(2), zero_hamiltonian(3)),
                (0.1, 0.1),
                [],
            )


def _assert_map_parity(
    python_map: object,
    rust_map: object,
    state: Matrix,
) -> None:
    np.testing.assert_allclose(
        np.asarray(rust_map.superoperator),
        np.asarray(python_map.superoperator),
        atol=TOLERANCE,
        rtol=0.0,
    )
    np.testing.assert_allclose(
        np.asarray(rust_map.choi_matrix),
        np.asarray(python_map.choi_matrix),
        atol=TOLERANCE,
        rtol=0.0,
    )
    np.testing.assert_allclose(
        np.asarray(rust_map.apply(state)),
        np.asarray(python_map.apply(state)),
        atol=TOLERANCE,
        rtol=0.0,
    )
    if not rust_map.audit.is_cptp:
        raise AssertionError("Rust map failed the frozen CPTP audit")


def _assert_piecewise_parity(
    python_map: object,
    rust_map: object,
    state: Matrix,
) -> None:
    _assert_map_parity(python_map, rust_map, state)
    if len(rust_map.intervals) != len(python_map.intervals):
        raise AssertionError("Python and Rust interval counts differ")
    for python_interval, rust_interval in zip(
        python_map.intervals,
        rust_map.intervals,
    ):
        np.testing.assert_allclose(
            np.asarray(rust_interval.channel.superoperator),
            np.asarray(python_interval.channel.superoperator),
            atol=TOLERANCE,
            rtol=0.0,
        )


def _state_zero() -> Matrix:
    return _matrix(((1.0, 0.0), (0.0, 0.0)))


def _state_plus() -> Matrix:
    return _matrix(((0.5, 0.5), (0.5, 0.5)))


def _qutrit_state() -> Matrix:
    return _matrix(
        (
            (0.58, 0.13, 0.0),
            (0.13, 0.32, 0.0),
            (0.0, 0.0, 0.1),
        )
    )


def _matrix(values: object) -> Matrix:
    array = np.asarray(values, dtype=np.complex128)
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
    )


if __name__ == "__main__":
    unittest.main()
