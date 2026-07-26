import json
from pathlib import Path
import unittest

from core.cptp import (
    CHOI_CONVENTION_ID,
    DEFAULT_CP_TOLERANCE,
    DEFAULT_TP_TOLERANCE,
)
from core.cptp_evolution import EXPLICIT_CPTP_EVOLUTION_ID
from validation_cptp.model_freeze import (
    CPTP_MODEL_FREEZE_ID,
    CRITICAL_SOURCE_FILES,
    REQUIRED_EVIDENCE_FILES,
    build_freeze_report,
)


class CPTPModelFreezeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = build_freeze_report()
        artifact_path = (
            Path(__file__).resolve().parents[1]
            / "validation_results"
            / "cptp_model_freeze.json"
        )
        cls.artifact = json.loads(
            artifact_path.read_text(encoding="utf-8")
        )

    def test_contract_ids_and_tolerances_are_frozen(self) -> None:
        contract = self.report["frozen_contract"]
        self.assertEqual(contract["freeze_id"], CPTP_MODEL_FREEZE_ID)
        self.assertEqual(
            contract["evolution_method_id"],
            EXPLICIT_CPTP_EVOLUTION_ID,
        )
        self.assertEqual(
            contract["choi_convention_id"],
            CHOI_CONVENTION_ID,
        )
        self.assertEqual(contract["cp_tolerance"], DEFAULT_CP_TOLERANCE)
        self.assertEqual(contract["tp_tolerance"], DEFAULT_TP_TOLERANCE)
        self.assertFalse(contract["cleanup_applied"])

    def test_critical_sources_and_evidence_are_hashed(self) -> None:
        sources = self.report["source_revision"]["files"]
        evidence = self.report["evidence_files"]
        self.assertEqual(len(sources), len(CRITICAL_SOURCE_FILES))
        self.assertEqual(len(evidence), len(REQUIRED_EVIDENCE_FILES))
        self.assertTrue(all(item["exists"] for item in sources))
        self.assertTrue(all(item["exists"] for item in evidence))
        self.assertTrue(all(len(item["sha256"]) == 64 for item in sources))
        self.assertEqual(
            len(self.report["source_revision"][
                "critical_source_tree_sha256"
            ]),
            64,
        )

    def test_api_contract_keeps_rk4_default(self) -> None:
        contract = self.report["api_contract"]["openapi_method_contract"]
        for model in ("two_level", "qutrit"):
            self.assertEqual(contract[model]["default"], "fixed_step_rk4")
            self.assertEqual(
                contract[model]["enum"],
                ["fixed_step_rk4", "explicit_cptp"],
            )

    def test_python_and_available_rust_smokes_are_cptp(self) -> None:
        api = self.report["api_contract"]
        smoke_sets = [api["python_smokes"]]
        if api["rust_extension_available"]:
            smoke_sets.append(api["rust_smokes"])
        for smokes in smoke_sets:
            for result in smokes.values():
                self.assertEqual(
                    result["method_id"],
                    EXPLICIT_CPTP_EVOLUTION_ID,
                )
                self.assertTrue(result["all_maps_cptp"])
                self.assertFalse(result["cleanup_applied"])
                self.assertLessEqual(
                    result["maximum_state_trace_error"],
                    1e-10,
                )
                self.assertGreaterEqual(
                    result["minimum_state_eigenvalue"],
                    -1e-10,
                )

    def test_comparison_evidence_and_freeze_pass(self) -> None:
        self.assertTrue(
            self.report["comparison_evidence"]["all_cases_pass"]
        )
        self.assertTrue(self.report["overall_pass"])
        self.assertTrue(self.report["phase2_complete"])
        self.assertEqual(
            self.report["decision"],
            "PASS WITH RESTRICTIONS",
        )

    def test_committed_artifact_matches_current_frozen_sources(self) -> None:
        self.assertEqual(
            self.artifact["frozen_contract"],
            self.report["frozen_contract"],
        )
        self.assertEqual(
            self.artifact["source_revision"][
                "critical_source_tree_sha256"
            ],
            self.report["source_revision"][
                "critical_source_tree_sha256"
            ],
        )
        self.assertEqual(
            self.artifact["api_contract"][
                "openapi_method_contract_sha256"
            ],
            self.report["api_contract"][
                "openapi_method_contract_sha256"
            ],
        )
        self.assertEqual(
            self.artifact["evidence_files"],
            self.report["evidence_files"],
        )
        self.assertTrue(self.artifact["overall_pass"])


if __name__ == "__main__":
    unittest.main()
