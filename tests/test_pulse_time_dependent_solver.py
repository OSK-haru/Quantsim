import math
import unittest

from core.gates import (
    Matrix,
    SIGMA_MINUS,
    clean_density_matrix,
    initial_density_matrix,
    prepare_collapse_operators,
    rk4_step_cached,
    scale,
    zero_hamiltonian,
)
from core.pulse_contract import SIGMA_X
from core.pulse_evolution import (
    ConstantHamiltonian,
    evolve_time_dependent_segment,
)


MATRIX_TOLERANCE = 1e-12


class RecordingHamiltonian:
    def __init__(self, matrix: Matrix) -> None:
        self.matrix = matrix
        self.evaluation_times: list[float] = []

    def evaluate(self, local_time_us: float) -> Matrix:
        self.evaluation_times.append(local_time_us)
        return self.matrix


class PulseTimeDependentSolverTests(unittest.TestCase):
    def test_rk4_evaluates_all_stage_times(self) -> None:
        provider = RecordingHamiltonian(zero_hamiltonian(2))

        result = evolve_time_dependent_segment(
            initial_density_matrix(["0"]),
            provider,
            (),
            duration_us=0.2,
            max_step_us=0.1,
        )

        _assert_float_sequences_close(
            self,
            provider.evaluation_times,
            [0.0, 0.05, 0.05, 0.1, 0.1, 0.15, 0.15, 0.2],
        )
        self.assertEqual(result.diagnostics.internal_step_count, 2)
        self.assertEqual(result.diagnostics.rhs_evaluation_count, 8)
        self.assertEqual(
            result.diagnostics.hamiltonian_evaluation_count,
            8,
        )

    def test_final_partial_step_reaches_exact_duration(self) -> None:
        provider = RecordingHamiltonian(zero_hamiltonian(2))

        result = evolve_time_dependent_segment(
            initial_density_matrix(["0"]),
            provider,
            (),
            duration_us=0.25,
            max_step_us=0.1,
        )

        self.assertEqual(result.diagnostics.internal_step_count, 3)
        self.assertAlmostEqual(
            result.diagnostics.minimum_internal_step_us,
            0.05,
            delta=1e-14,
        )
        self.assertAlmostEqual(
            result.diagnostics.maximum_internal_step_us,
            0.1,
            delta=1e-14,
        )
        self.assertEqual(result.diagnostics.actual_duration_us, 0.25)
        self.assertAlmostEqual(
            provider.evaluation_times[-1],
            0.25,
            delta=1e-14,
        )

    def test_constant_provider_matches_existing_constant_rk4(self) -> None:
        state = initial_density_matrix(["1"])
        hamiltonian = scale(0.5 * math.pi, SIGMA_X)
        collapse_ops = prepare_collapse_operators([
            scale(math.sqrt(0.2), SIGMA_MINUS),
        ])

        expected = state
        for step in (0.1, 0.1, 0.05):
            expected = clean_density_matrix(
                rk4_step_cached(
                    expected,
                    hamiltonian,
                    collapse_ops,
                    step,
                )
            )

        result = evolve_time_dependent_segment(
            state,
            ConstantHamiltonian(hamiltonian),
            collapse_ops,
            duration_us=0.25,
            max_step_us=0.1,
        )

        _assert_matrices_close(self, result.state, expected)

    def test_zero_hamiltonian_preserves_state_without_dissipation(self) -> None:
        state = initial_density_matrix(["1"])

        result = evolve_time_dependent_segment(
            state,
            ConstantHamiltonian(zero_hamiltonian(2)),
            (),
            duration_us=1.0,
            max_step_us=0.3,
        )

        _assert_matrices_close(self, result.state, state)
        _assert_matrices_close(self, result.raw_final_state, state)

    def test_checkpoints_keep_raw_and_cleaned_states(self) -> None:
        unnormalized_state: Matrix = (
            (2.0 + 0.0j, 0.0 + 0.0j),
            (0.0 + 0.0j, 0.0 + 0.0j),
        )

        result = evolve_time_dependent_segment(
            unnormalized_state,
            ConstantHamiltonian(zero_hamiltonian(2)),
            (),
            duration_us=0.2,
            max_step_us=0.1,
            checkpoint_times_us=(0.1,),
        )

        self.assertEqual(
            [checkpoint.time_us for checkpoint in result.checkpoints],
            [0.1, 0.2],
        )
        first = result.checkpoints[0]
        self.assertAlmostEqual(first.raw_physicality.trace_error, 1.0)
        self.assertGreater(first.cleanup_correction_norm, 0.0)
        self.assertAlmostEqual(
            sum(
                first.cleaned_state[index][index]
                for index in range(2)
            ).real,
            1.0,
        )
        self.assertGreater(result.diagnostics.cleanup_correction_norm, 0.0)
        self.assertEqual(
            result.diagnostics.to_dict()["internal_step_count"],
            2,
        )

    def test_requested_initial_checkpoint_is_recorded(self) -> None:
        state = initial_density_matrix(["0"])

        result = evolve_time_dependent_segment(
            state,
            ConstantHamiltonian(zero_hamiltonian(2)),
            (),
            duration_us=0.1,
            max_step_us=0.1,
            checkpoint_times_us=(0.0, 0.05),
        )

        self.assertEqual(
            [checkpoint.time_us for checkpoint in result.checkpoints],
            [0.0, 0.05, 0.1],
        )
        _assert_matrices_close(self, result.checkpoints[0].raw_state, state)

    def test_invalid_duration_and_step_are_rejected(self) -> None:
        state = initial_density_matrix(["0"])
        provider = ConstantHamiltonian(zero_hamiltonian(2))

        for duration, max_step in (
            (0.0, 0.1),
            (-0.1, 0.1),
            (math.nan, 0.1),
            (0.1, 0.0),
            (0.1, -0.1),
            (0.1, math.inf),
        ):
            with self.subTest(duration=duration, max_step=max_step):
                with self.assertRaises(ValueError):
                    evolve_time_dependent_segment(
                        state,
                        provider,
                        (),
                        duration_us=duration,
                        max_step_us=max_step,
                    )

    def test_invalid_checkpoint_order_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            evolve_time_dependent_segment(
                initial_density_matrix(["0"]),
                ConstantHamiltonian(zero_hamiltonian(2)),
                (),
                duration_us=0.2,
                max_step_us=0.1,
                checkpoint_times_us=(0.15, 0.1),
            )

    def test_hamiltonian_dimension_must_match_state(self) -> None:
        with self.assertRaises(ValueError):
            evolve_time_dependent_segment(
                initial_density_matrix(["0"]),
                ConstantHamiltonian(zero_hamiltonian(3)),
                (),
                duration_us=0.1,
                max_step_us=0.1,
            )


def _assert_matrices_close(
    test_case: unittest.TestCase,
    actual: Matrix,
    expected: Matrix,
) -> None:
    test_case.assertEqual(len(actual), len(expected))
    for row in range(len(expected)):
        for column in range(len(expected)):
            test_case.assertAlmostEqual(
                actual[row][column].real,
                expected[row][column].real,
                delta=MATRIX_TOLERANCE,
            )
            test_case.assertAlmostEqual(
                actual[row][column].imag,
                expected[row][column].imag,
                delta=MATRIX_TOLERANCE,
            )


def _assert_float_sequences_close(
    test_case: unittest.TestCase,
    actual: list[float],
    expected: list[float],
) -> None:
    test_case.assertEqual(len(actual), len(expected))
    for actual_value, expected_value in zip(actual, expected):
        test_case.assertAlmostEqual(
            actual_value,
            expected_value,
            delta=1e-14,
        )


if __name__ == "__main__":
    unittest.main()
