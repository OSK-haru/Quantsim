import unittest

from validation_pulse.qutrit_drag import (
    SELECTED_DRAG_BETA_US,
    run_qutrit_drag_validation,
)


class PulseB4QutritDragValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report, cls.rows = run_qutrit_drag_validation()

    def test_all_fixed_cases_pass(self) -> None:
        self.assertTrue(self.report["overall_pass"])
        self.assertTrue(all(
            case["pass"] for case in self.report["cases"]
        ))

    def test_required_cases_are_present(self) -> None:
        self.assertEqual(
            {case["name"] for case in self.report["cases"]},
            {
                "analytic_gaussian_derivative",
                "truncated_gaussian_boundary",
                "positive_negative_beta_sign",
                "beta_zero_exact_compatibility",
                "positive_zero_negative_beta_sweep",
                "fixed_pi_leakage_and_fidelity_improvement",
                "pi_over_two_fidelity_phase_guard",
                "dissipative_drag_compatibility",
                "drag_on_off_refinement",
            },
        )

    def test_selected_beta_improves_pi_leakage_and_fidelity(self) -> None:
        case = self._case("fixed_pi_leakage_and_fidelity_improvement")
        self.assertEqual(case["selected_beta_us"], SELECTED_DRAG_BETA_US)
        self.assertLess(
            case["drag"]["end_leakage"],
            case["baseline"]["end_leakage"],
        )
        self.assertGreater(
            case["drag"]["target_fidelity"],
            case["baseline"]["target_fidelity"],
        )

    def test_pi_over_two_guard_includes_phase_and_population(self) -> None:
        case = self._case("pi_over_two_fidelity_phase_guard")
        self.assertLess(
            case["drag"]["phase_error_rad"],
            case["baseline"]["phase_error_rad"],
        )
        self.assertGreaterEqual(
            case["drag"]["computational_population"],
            0.99,
        )

    def test_drag_on_off_converge_under_policy(self) -> None:
        case = self._case("drag_on_off_refinement")
        self.assertEqual(
            {mode["mode"] for mode in case["modes"]},
            {"drag_off", "drag_on"},
        )
        self.assertTrue(all(
            mode["convergence_pass"] and mode["policy_pass"]
            for mode in case["modes"]
        ))

    def test_boundary_and_scope_are_explicit(self) -> None:
        self.assertEqual(
            self.report["boundary_rule"]["cutoff"],
            "hard truncated Gaussian; no smoothing added",
        )
        self.assertEqual(self.report["capability_status"], "contract_only")
        self.assertIn(
            "public qutrit API readiness",
            self.report["scope_and_limitations"]["does_not_prove"],
        )

    def _case(self, name):
        return next(
            case for case in self.report["cases"]
            if case["name"] == name
        )


if __name__ == "__main__":
    unittest.main()
