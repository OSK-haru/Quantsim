import unittest

from validation_pulse.baseline_freeze import (
    REQUIRED_VALIDATION_ARTIFACTS,
    build_freeze_report,
)


class PulseBaselineAFreezeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = build_freeze_report()

    def test_required_validation_artifacts_pass(self) -> None:
        artifacts = self.report["artifact_audit"]

        self.assertEqual(
            len(artifacts),
            len(REQUIRED_VALIDATION_ARTIFACTS),
        )
        self.assertTrue(
            all(
                item["exists"] and item["pass"] is True
                for item in artifacts
            )
        )

    def test_gate_and_pulse_api_paths_coexist(self) -> None:
        self.assertEqual(
            self.report["api_audit"]["required_paths"],
            {
                "/api/simulate": True,
                "/api/pulse/simulate": True,
            },
        )

    def test_both_environment_input_modes_execute(self) -> None:
        self.assertEqual(
            self.report["api_audit"]["direct_rates_smoke"]["input_mode"],
            "direct_rates",
        )
        self.assertEqual(
            self.report["api_audit"]["physical_smoke"]["input_mode"],
            "physical",
        )

    def test_contract_hash_and_freeze_result_are_recorded(self) -> None:
        contract_hash = self.report["api_audit"][
            "pulse_contract_sha256"
        ]

        self.assertEqual(len(contract_hash), 64)
        self.assertTrue(self.report["overall_pass"])


if __name__ == "__main__":
    unittest.main()
