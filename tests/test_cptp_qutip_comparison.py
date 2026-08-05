"""Phase 3A tests for the frozen CPTP-to-QuTiP audit."""

from __future__ import annotations

import unittest

from core.rust_dense_kernel import is_rust_kernel_available
from validation_cptp.qutip_audit import (
    EVOLUTION_METHOD_ID,
    FREEZE_ID,
    QUTIP_AVAILABLE,
    cptp_qutip_cases,
    run_cptp_qutip_audit,
)


class CPTPQuTiPContractTests(unittest.TestCase):
    def test_cases_preregister_models_refinement_and_tolerances(self) -> None:
        cases = cptp_qutip_cases()

        self.assertEqual(
            [case.case_id for case in cases],
            [
                "two_level_gaussian_open_pulse",
                "qutrit_drag_open_pulse",
            ],
        )
        self.assertEqual(
            {case.model_id for case in cases},
            {
                "driven_two_level_rwa_experimental_v1",
                "driven_transmon_qutrit_rwa_experimental_v1",
            },
        )
        for case in cases:
            self.assertEqual(len(case.interval_sizes_us), 3)
            self.assertGreater(
                case.interval_sizes_us[0],
                case.interval_sizes_us[1],
            )
            self.assertGreater(
                case.interval_sizes_us[1],
                case.interval_sizes_us[2],
            )
            self.assertGreater(case.finest_trace_distance_tolerance, 0.0)


@unittest.skipUnless(QUTIP_AVAILABLE, "validation-only QuTiP is unavailable")
class CPTPQuTiPPythonTests(unittest.TestCase):
    def test_python_cptp_cases_match_qutip(self) -> None:
        report, rows = run_cptp_qutip_audit(include_rust=False)

        self.assertTrue(report["overall_pass"])
        self.assertEqual(report["frozen_contract"]["freeze_id"], FREEZE_ID)
        self.assertEqual(
            report["frozen_contract"]["evolution_method_id"],
            EVOLUTION_METHOD_ID,
        )
        self.assertTrue(rows)
        self.assertEqual(len(report["cases"]), 2)
        for case in report["cases"]:
            self.assertTrue(case["case_pass"])
            self.assertTrue(case["python_rust_parity_pass"])
            self.assertEqual(
                [backend["backend"] for backend in case["backends"]],
                ["python"],
            )


@unittest.skipUnless(
    QUTIP_AVAILABLE and is_rust_kernel_available(),
    "QuTiP or the Rust kernel is unavailable",
)
class CPTPQuTiPRustTests(unittest.TestCase):
    def test_rust_cptp_cases_match_same_qutip_reference(self) -> None:
        report, _ = run_cptp_qutip_audit(include_rust=True)

        self.assertTrue(report["overall_pass"])
        self.assertTrue(report["rust_requirement_pass"])
        for case in report["cases"]:
            self.assertTrue(case["python_rust_parity_pass"])
            self.assertEqual(
                [backend["backend"] for backend in case["backends"]],
                ["python", "rust"],
            )


if __name__ == "__main__":
    unittest.main()
