import unittest

from validation_pulse.qutrit_closed import run_closed_qutrit_validation


class PulseB1ClosedQutritValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report, cls.rows = run_closed_qutrit_validation()

    def test_all_fixed_cases_pass(self) -> None:
        self.assertTrue(self.report["overall_pass"])
        self.assertTrue(all(
            case["pass"] for case in self.report["cases"]
        ))

    def test_required_cases_are_present(self) -> None:
        self.assertEqual(
            {case["name"] for case in self.report["cases"]},
            {
                "zero_drive_basis_2",
                "free_coherence_0_2",
                "weak_selective_pi_over_2",
                "fixed_gaussian_anharmonicity_comparison",
                "closed_pulse_then_free_idle",
            },
        )

    def test_leakage_rows_are_unrenormalized(self) -> None:
        alpha_rows = [
            row for row in self.rows if row["case"] == "alpha_-100_mhz"
        ]
        self.assertTrue(alpha_rows)
        self.assertGreater(
            max(row["population_2"] for row in alpha_rows),
            1e-4,
        )
        self.assertLessEqual(
            max(row["population_sum_error"] for row in alpha_rows),
            1e-10,
        )

    def test_scope_keeps_qutrit_execution_contract_only(self) -> None:
        self.assertEqual(self.report["capability_status"], "contract_only")
        self.assertIn(
            "qutrit dissipation or finite-temperature behavior",
            self.report["scope_and_limitations"]["does_not_prove"],
        )


if __name__ == "__main__":
    unittest.main()
