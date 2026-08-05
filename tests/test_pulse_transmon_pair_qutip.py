import unittest

from validation_pulse.qutip_adapter import QUTIP_AVAILABLE
from validation_pulse.transmon_pair_qutip import (
    PAIR_QUTIP_BASIS,
    PairQutipCase,
    _run_case,
    pair_qutip_cases,
    specification_alignment,
)


@unittest.skipUnless(QUTIP_AVAILABLE, "validation-only QuTiP is unavailable")
class CoupledTransmonPairQutipTests(unittest.TestCase):
    def test_audit_contract_declares_tensor_basis_and_alignment(self) -> None:
        self.assertEqual(
            PAIR_QUTIP_BASIS,
            ("00", "01", "02", "10", "11", "12", "20", "21", "22"),
        )
        items = {item["item"] for item in specification_alignment()}
        self.assertIn("drive I/Q convention", items)
        self.assertIn("collapse operators", items)
        self.assertIn("solver and vectorization", items)

    def test_short_smoke_case_matches_qutip(self) -> None:
        payload = pair_qutip_cases()[0].payload.copy()
        payload.update({
            "anharmonicities_mhz": [-20.0, -25.0],
            "detunings_rad_per_us": [0.0, 0.0],
            "exchange_coupling_rad_per_us": 1.0,
            "pulse": {
                "shape": "square",
                "amplitude_mode": "target_rotation_angle",
                "target_rotation_angle_rad": 0.1,
                "pulse_duration_us": 0.001,
                "phase_rad": 0.0,
                "detuning_rad_per_us": 0.0,
                "drag_beta_us": 0.0,
            },
            "total_simulation_time_us": 0.001,
            "snapshot_options": {"uniform_count": 3, "custom_times_us": []},
        })
        case = PairQutipCase("short_smoke", "smoke", payload, 2e-6)
        report, rows = _run_case(case, "python")
        self.assertTrue(report["pass"])
        self.assertTrue(rows)
        self.assertLessEqual(
            report["maximum_density_matrix_element_error"],
            case.tolerance,
        )


if __name__ == "__main__":
    unittest.main()
