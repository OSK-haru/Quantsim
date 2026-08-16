"""Contract checks for the generated C8 comparison artifact."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from core.rust_dense_kernel import is_rust_kernel_available


ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "validation_results" / "cptp_rk4_comparison.json"
MARKDOWN_PATH = (
    ROOT / "docs_for_develop" / "validation" / "cptp-rk4-comparison.md"
)


class CPTPRK4ArtifactTests(unittest.TestCase):
    def test_c8_artifact_records_passing_refinement_cases(self) -> None:
        report = json.loads(JSON_PATH.read_text(encoding="utf-8"))

        self.assertEqual(
            report["schema_version"],
            "cptp-rk4-comparison-v1",
        )
        self.assertTrue(report["summary"]["all_cases_pass"])
        self.assertEqual(len(report["cases"]), 3)
        for case in report["cases"]:
            self.assertTrue(case["case_pass"])
            for backend in case["backends"]:
                self.assertTrue(backend["backend_pass"])
                self.assertTrue(backend["convergence_monotonic"])
                self.assertTrue(backend["physicality_pass"])
                self.assertEqual(len(backend["comparisons"]), 3)

    def test_artifact_covers_python_and_available_rust_backend(self) -> None:
        report = json.loads(JSON_PATH.read_text(encoding="utf-8"))
        backends = {
            backend["backend"]
            for case in report["cases"]
            for backend in case["backends"]
        }

        self.assertIn("python", backends)
        if is_rust_kernel_available():
            self.assertIn("rust", backends)

    def test_coarse_qutrit_stress_is_separate_and_detects_instability(
        self,
    ) -> None:
        report = json.loads(JSON_PATH.read_text(encoding="utf-8"))
        stress = report["non_acceptance_stress_observation"]

        self.assertFalse(stress["included_in_acceptance"])
        self.assertTrue(stress["rk4_instability_observed"])
        self.assertTrue(stress["cptp_physicality_preserved"])

    def test_markdown_report_records_pass_and_scope(self) -> None:
        markdown = MARKDOWN_PATH.read_text(encoding="utf-8")

        self.assertIn("**PASS**", markdown)
        self.assertIn("Non-acceptance Stress Observation", markdown)
        self.assertIn("not universal performance guarantees", markdown)


if __name__ == "__main__":
    unittest.main()
