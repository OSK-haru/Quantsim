import json
import tempfile
import unittest
from pathlib import Path

from core.io.config_io import load_config, save_config
from core.io.report_export import export_markdown_report
from core.io.result_export import export_result_csv, save_result_json
from core.simulator import run_simulation
from tests.phase8_helpers import one_qubit_gate_config


class ExportRegressionTest(unittest.TestCase):
    def test_save_load_run_and_export_files(self) -> None:
        config = one_qubit_gate_config("H")
        with tempfile.TemporaryDirectory() as directory:
            directory_path = Path(directory)
            config_path = directory_path / "config.qscope.json"
            result_json_path = directory_path / "result.qscope.result.json"
            csv_path = directory_path / "result.csv"
            markdown_path = directory_path / "report.md"

            save_config(config, config_path)
            loaded = load_config(config_path)
            result = run_simulation(loaded)
            save_result_json(result, result_json_path)
            export_result_csv(result, csv_path)
            export_markdown_report(result, markdown_path)

            self.assertTrue(config_path.exists())
            self.assertTrue(result_json_path.exists())
            self.assertTrue(csv_path.exists())
            self.assertTrue(markdown_path.exists())
            self.assertIn("summary", json.loads(result_json_path.read_text(encoding="utf-8")))
            self.assertIn("time_us,state_fidelity,purity", csv_path.read_text(encoding="utf-8"))
            self.assertIn("Yuragi-Strider Simulation Report", markdown_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
