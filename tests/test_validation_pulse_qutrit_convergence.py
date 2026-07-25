import unittest

from validation_pulse.qutrit_convergence import (
    PULSE_QUTRIT_MAX_INTERNAL_STEPS,
    REFERENCE_FACTOR,
    REFINEMENT_FACTORS,
    run_qutrit_convergence_validation,
)


class PulseB3QutritConvergenceValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report, cls.rows = run_qutrit_convergence_validation()

    def test_all_fixed_cases_pass(self) -> None:
        self.assertTrue(self.report["overall_pass"])
        self.assertTrue(all(
            case["pass"] for case in self.report["cases"]
        ))

    def test_required_cases_are_present(self) -> None:
        self.assertEqual(
            {case["name"] for case in self.report["cases"]},
            {
                "free_qutrit_phase_large_anharmonicity",
                "closed_resonant_gaussian_leakage",
                "detuned_gaussian",
                "dissipative_gaussian",
                "pulse_then_idle",
                "deliberately_coarse_unsafe_guard",
            },
        )

    def test_each_standard_case_has_four_refinements_and_reference(
        self,
    ) -> None:
        standard_names = {
            case["name"]
            for case in self.report["cases"]
            if case["name"] != "deliberately_coarse_unsafe_guard"
        }
        for name in standard_names:
            case_rows = [row for row in self.rows if row["case"] == name]
            self.assertEqual(
                {
                    row["step_factor"]
                    for row in case_rows
                    if not row["is_reference"]
                },
                set(REFINEMENT_FACTORS),
            )
            references = [
                row for row in case_rows if row["is_reference"]
            ]
            self.assertEqual(len(references), 1)
            self.assertEqual(
                references[0]["step_factor"],
                REFERENCE_FACTOR,
            )

    def test_required_diagnostics_are_recorded(self) -> None:
        required = {
            "hamiltonian_scale_max_rad_per_us",
            "dissipation_scale_per_us",
            "envelope_step_limit_us",
            "selected_internal_step_cap_us",
            "actual_internal_step_min_us",
            "actual_internal_step_max_us",
            "actual_internal_step_count",
            "step_limit_reason",
            "runtime_ms",
            "raw_trace_error",
            "raw_hermiticity_error",
            "raw_minimum_eigenvalue",
            "cleanup_correction_norm",
        }
        self.assertTrue(self.rows)
        self.assertTrue(all(required <= row.keys() for row in self.rows))

    def test_unsafe_case_is_detected_without_cleanup_masking(self) -> None:
        case = next(
            case for case in self.report["cases"]
            if case["name"] == "deliberately_coarse_unsafe_guard"
        )
        self.assertTrue(case["coarse_breakdown_detected"])
        self.assertTrue(case["safe_policy_pass"])
        self.assertLess(case["coarse_raw_minimum_eigenvalue"], -1e-5)
        self.assertGreaterEqual(case["safe_raw_minimum_eigenvalue"], -1e-9)

    def test_work_budget_and_scope_remain_bounded(self) -> None:
        self.assertEqual(
            self.report["performance"]["work_budget_recommendation"],
            PULSE_QUTRIT_MAX_INTERNAL_STEPS,
        )
        self.assertEqual(self.report["capability_status"], "contract_only")
        self.assertIn(
            "public qutrit API readiness",
            self.report["scope_and_limitations"]["does_not_prove"],
        )


if __name__ == "__main__":
    unittest.main()
