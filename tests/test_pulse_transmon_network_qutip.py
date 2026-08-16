import json
import math
from pathlib import Path
import unittest

from validation_pulse.qutip_adapter import QUTIP_AVAILABLE
from validation_pulse.transmon_network_qutip import (
    NETWORK_QUTIP_AUDIT_ID,
    NetworkQutipCase,
    _run_case,
    network_basis_labels,
    network_qutip_cases,
    specification_alignment,
)


ARTIFACT_PATH = (
    Path(__file__).resolve().parents[1]
    / "validation_results"
    / "pulse_transmon_network_qutip_audit.json"
)


class CoupledTransmonNetworkQutipArtifactTests(unittest.TestCase):
    def test_committed_audit_passes_and_covers_two_to_four_transmons(self) -> None:
        report = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))

        self.assertEqual(report["audit_id"], NETWORK_QUTIP_AUDIT_ID)
        self.assertTrue(report["pass"])
        self.assertEqual(report["transmon_counts_covered"], [2, 3, 4])
        self.assertEqual(report["production_kernel"], "numpy_dense")
        for case in report["cases"]:
            self.assertTrue(case["pass"], case["name"])
            self.assertLessEqual(
                case["maximum_density_matrix_element_error"],
                case["tolerance"],
            )
        categories = {case["category"] for case in report["cases"]}
        self.assertIn("drive_schedule", categories)
        self.assertIn("four_transmon_register", categories)
        self.assertIn("dissipation_leakage", categories)

    def test_audit_contract_declares_tensor_basis_and_alignment(self) -> None:
        self.assertEqual(
            network_basis_labels(2),
            ("00", "01", "02", "10", "11", "12", "20", "21", "22"),
        )
        self.assertEqual(len(network_basis_labels(4)), 81)
        items = {item["item"] for item in specification_alignment()}
        self.assertIn("drive schedule", items)
        self.assertIn("collapse operators", items)
        self.assertIn("relaxation term", items)
        self.assertIn("solver and cleanup", items)


@unittest.skipUnless(QUTIP_AVAILABLE, "validation-only QuTiP is unavailable")
class CoupledTransmonNetworkQutipTests(unittest.TestCase):
    def test_short_scheduled_smoke_case_matches_qutip(self) -> None:
        payload = dict(network_qutip_cases()[0].payload)
        payload.update({
            "anharmonicities_mhz": [-20.0, -25.0],
            "detunings_rad_per_us": [0.0, 4.0],
            "couplings": [
                {"left": 0, "right": 1, "exchange_coupling_rad_per_us": 3.0},
            ],
            "drives": [
                {
                    "target": 0,
                    "start_time_us": 0.0,
                    "pulse": {
                        "shape": "square",
                        "amplitude_mode": "target_rotation_angle",
                        "target_rotation_angle_rad": 0.2 * math.pi,
                        "pulse_duration_us": 0.001,
                        "phase_rad": 0.0,
                        "detuning_rad_per_us": 0.0,
                        "drag_beta_us": 0.0,
                    },
                },
            ],
            "total_simulation_time_us": 0.002,
            "snapshot_options": {"uniform_count": 3, "custom_times_us": []},
        })
        case = NetworkQutipCase("short_scheduled_smoke", "smoke", payload, 1e-7)

        report, rows = _run_case(case)

        self.assertTrue(report["pass"])
        self.assertTrue(rows)
        self.assertLessEqual(
            report["maximum_density_matrix_element_error"],
            case.tolerance,
        )
        self.assertIn("idle", {row["segment"] for row in rows})


if __name__ == "__main__":
    unittest.main()
