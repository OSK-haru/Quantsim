"""Tests for the provider-neutral Phase 3B pilot manifest."""

from __future__ import annotations

import copy
import unittest
from pathlib import Path

from validation_hardware.pilot_manifest import (
    load_and_validate_pilot_manifest,
    validate_pilot_manifest,
)


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "validation_hardware" / "phase3b_pilot_manifest.json"


class Phase3BPilotManifestTests(unittest.TestCase):
    def test_frozen_manifest_is_valid(self) -> None:
        manifest = load_and_validate_pilot_manifest(MANIFEST)
        self.assertEqual(len(manifest["cases"]), 4)
        self.assertFalse(manifest["formal_holdout_eligible"])
        self.assertEqual(manifest["execution_policy"]["total_circuits_max"], 12)
        self.assertEqual(manifest["execution_policy"]["total_shots_max"], 384)

    def test_shot_budget_is_enforced(self) -> None:
        manifest = load_and_validate_pilot_manifest(MANIFEST)
        broken = copy.deepcopy(manifest)
        broken["cases"][0]["shots"] = 128
        errors = validate_pilot_manifest(broken)
        self.assertTrue(any("shots does not match" in error for error in errors))

    def test_secret_fields_are_rejected(self) -> None:
        manifest = load_and_validate_pilot_manifest(MANIFEST)
        broken = copy.deepcopy(manifest)
        broken["provider"]["token"] = "never-store-this"
        self.assertIn(
            "manifest must not contain secret-bearing fields",
            validate_pilot_manifest(broken),
        )

    def test_pilot_cannot_be_formal_holdout(self) -> None:
        manifest = load_and_validate_pilot_manifest(MANIFEST)
        broken = copy.deepcopy(manifest)
        broken["cases"][0]["formal_holdout_eligible"] = True
        errors = validate_pilot_manifest(broken)
        self.assertTrue(any("formal_holdout_eligible" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
