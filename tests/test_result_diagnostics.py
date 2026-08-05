import math
import unittest

from core.results import SimulationConfig, SimulationResult
from core.validation import diagnose_simulation_result, has_blocking_issues


class ResultDiagnosticsTest(unittest.TestCase):
    def test_nan_and_inf_in_result_series_are_detected(self) -> None:
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0],
            fidelity=[1.0, 1.0],
            purity=[1.0, 1.0],
            effective_operation_time_us=1.0,
        )
        # SimulationResult enforces finite values at its public boundary. The
        # diagnostic layer must still handle corruption introduced after that
        # boundary (for example by an external backend adapter).
        result.fidelity[1] = math.nan
        result.purity[1] = math.inf

        issues = diagnose_simulation_result(result)

        self.assertIssueCode(issues, "FIDELITY_VALUE_NOT_FINITE")
        self.assertIssueCode(issues, "PURITY_VALUE_NOT_FINITE")
        self.assertTrue(has_blocking_issues(issues))

    def test_probability_sum_mismatch_is_detected(self) -> None:
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0],
            fidelity=[1.0, 0.95],
            purity=[1.0, 0.99],
            effective_operation_time_us=1.0,
            output_probabilities={"0": 0.8, "1": 0.3},
        )

        issues = diagnose_simulation_result(result)

        self.assertIssueCode(issues, "OUTPUT_PROBABILITY_SUM_MISMATCH")

    def test_negative_probability_below_tolerance_is_detected(self) -> None:
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0],
            fidelity=[1.0, 0.95],
            purity=[1.0, 0.99],
            effective_operation_time_us=1.0,
            output_probabilities={"0": 1.1, "1": -0.1},
        )

        issues = diagnose_simulation_result(result)

        self.assertIssueCode(issues, "NEGATIVE_OUTPUT_PROBABILITY")

    def test_series_length_mismatch_is_detected(self) -> None:
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0],
            fidelity=[1.0],
            purity=[1.0, 0.99],
            effective_operation_time_us=1.0,
        )

        issues = diagnose_simulation_result(result)

        self.assertIssueCode(issues, "SERIES_LENGTH_MISMATCH")
        self.assertTrue(has_blocking_issues(issues))

    def test_fidelity_and_purity_range_issues_are_detected(self) -> None:
        result = SimulationResult(
            config=SimulationConfig(),
            times=[0.0, 1.0],
            fidelity=[1.0, 1.0 + 1e-6],
            purity=[1.0, -1e-6],
            effective_operation_time_us=1.0,
        )

        issues = diagnose_simulation_result(result)

        self.assertIssueCode(issues, "FIDELITY_OUT_OF_RANGE")
        self.assertIssueCode(issues, "PURITY_OUT_OF_RANGE")

    def assertIssueCode(self, issues, code: str) -> None:
        self.assertIn(code, {issue.code for issue in issues})


if __name__ == "__main__":
    unittest.main()
