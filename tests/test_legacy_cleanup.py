import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LegacyCleanupTest(unittest.TestCase):
    def test_obsolete_mvp_modules_are_removed(self) -> None:
        self.assertIsNone(importlib.util.find_spec("core.circuit"))
        self.assertIsNone(importlib.util.find_spec("core.environment"))
        self.assertIsNone(importlib.util.find_spec("core.evolution"))

    def test_simulator_uses_unified_environment_pipeline(self) -> None:
        source = (ROOT / "core" / "simulator.py").read_text(encoding="utf-8")

        self.assertIn("compute_environment_rates", source)
        self.assertIn("multi_qubit_environment_collapse_operators", source)
        self.assertNotIn("map_environment_to_t1_t2", source)
        self.assertNotIn("t1_t2_to_gammas", source)

    def test_ui_does_not_expose_legacy_environment_model_ids(self) -> None:
        ui_source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / "app" / "ui").glob("*.py")
        )

        self.assertNotIn("normalized_phenomenological_v1", ui_source)
        self.assertNotIn("superconducting_qubit_profile_v1", ui_source)
        self.assertNotIn("Environment model", ui_source)


if __name__ == "__main__":
    unittest.main()
