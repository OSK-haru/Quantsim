import unittest

from validation_pulse.qutrit_dissipation import (
    run_qutrit_dissipation_validation,
)


class PulseB2QutritDissipationValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report, cls.rows = run_qutrit_dissipation_validation()

    def test_all_fixed_cases_pass(self) -> None:
        self.assertTrue(self.report["overall_pass"])
        self.assertTrue(all(
            case["pass"] for case in self.report["cases"]
        ))

    def test_required_cases_are_present(self) -> None:
        self.assertEqual(
            {case["name"] for case in self.report["cases"]},
            {
                "zero_temperature_and_detailed_balance",
                "zero_temperature_cascade",
                "pure_dephasing_one_one_four",
                "population_outflow_coherence",
                "three_level_gibbs",
                "dissipative_pulse_and_idle",
                "physical_direct_rate_equivalence",
            },
        )

    def test_dephasing_rows_keep_population_normalization(self) -> None:
        rows = [
            row for row in self.rows
            if row["case"] == "pure_dephasing_one_one_four"
        ]
        self.assertTrue(rows)
        self.assertLessEqual(
            max(row["population_sum_error"] for row in rows),
            1e-10,
        )
        self.assertLess(
            rows[-1]["coherence_02_abs"],
            rows[-1]["coherence_01_abs"],
        )

    def test_scope_keeps_qutrit_http_contract_only(self) -> None:
        self.assertEqual(self.report["capability_status"], "contract_only")
        self.assertIn(
            "public qutrit API readiness",
            self.report["scope_and_limitations"]["does_not_prove"],
        )


if __name__ == "__main__":
    unittest.main()
