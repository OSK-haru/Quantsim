import json
import unittest
from pathlib import Path

from core.io.config_io import load_config
from core.simulator import run_simulation


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PRESETS = PROJECT_ROOT / "data" / "presets"


class PresetsRegressionTest(unittest.TestCase):
    def test_circuit_presets_load_and_run(self) -> None:
        for name in [
            "one_qubit_h.qscope.json",
            "one_qubit_x.qscope.json",
            "bell_state.qscope.json",
        ]:
            with self.subTest(name=name):
                result = run_simulation(load_config(PRESETS / "circuits" / name))

                self.assertEqual(result.issues, [])
                self.assertTrue(result.times)

    def test_comparison_examples_have_required_fields(self) -> None:
        for name in [
            "one_qubit_h_low_high_compare.qscope.json",
            "bell_low_high_compare.qscope.json",
        ]:
            with self.subTest(name=name):
                data = json.loads((PRESETS / "examples" / name).read_text(encoding="utf-8"))

                self.assertEqual(data["kind"], "quanta_scope.comparison_config")
                self.assertIn("environment_a", data)
                self.assertIn("environment_b", data)
                self.assertIn("labels", data)


if __name__ == "__main__":
    unittest.main()
