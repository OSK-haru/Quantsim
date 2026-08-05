"""Contract tests for the Phase 3B hardware dataset selection."""

from __future__ import annotations

import copy
import unittest
from pathlib import Path

from validation_hardware.dataset_registry import (
    PRIMARY_DATASET_ID,
    load_and_validate_registry,
    validate_registry,
)


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = (
    ROOT
    / "validation_results"
    / "phase3b_hardware_dataset_registry.json"
)


class Phase3BDatasetRegistryTests(unittest.TestCase):
    def test_frozen_registry_is_valid_and_selects_qhad(self) -> None:
        registry = load_and_validate_registry(REGISTRY)

        self.assertEqual(
            registry["primary_dataset"]["dataset_id"],
            PRIMARY_DATASET_ID,
        )
        self.assertFalse(
            registry["primary_dataset"]["data_splits"][
                "pilot_reusable_as_formal_holdout"
            ]
        )
        self.assertEqual(
            {
                dataset["role"]
                for dataset in registry["external_evidence_datasets"]
            },
            {
                "model_discrepancy_stress_dataset",
                "t1_ramsey_spam_auxiliary_dataset",
            },
        )

    def test_calibration_holdout_overlap_is_rejected(self) -> None:
        registry = load_and_validate_registry(REGISTRY)
        broken = copy.deepcopy(registry)
        broken["primary_dataset"]["data_splits"][
            "holdout_case_ids"
        ].append("t1_parameter_subset")

        errors = validate_registry(broken)

        self.assertTrue(
            any("calibration and holdout overlap" in error for error in errors)
        )

    def test_redistribution_requires_explicit_license(self) -> None:
        registry = load_and_validate_registry(REGISTRY)
        broken = copy.deepcopy(registry)
        rights = broken["external_evidence_datasets"][0]["rights"]
        rights["redistribution_allowed"] = True
        rights["license_id"] = None

        errors = validate_registry(broken)

        self.assertTrue(
            any("without a license_id" in error for error in errors)
        )

    def test_secret_bearing_fields_are_rejected(self) -> None:
        registry = load_and_validate_registry(REGISTRY)
        broken = copy.deepcopy(registry)
        broken["primary_dataset"]["api_key"] = "must-never-be-stored"

        errors = validate_registry(broken)

        self.assertIn(
            "registry must not contain secret-bearing fields",
            errors,
        )


if __name__ == "__main__":
    unittest.main()
