import math
import unittest

from pydantic import ValidationError

from api.main import app
from api.pulse_models import (
    PulseSimulateRequest,
    QutritPulseSimulateRequest,
)
from api.pulse_qutrit_service import run_qutrit_pulse_request
from api.pulse_service import run_pulse_request
from core.rust_dense_kernel import is_rust_kernel_available


class PulseCPTPApiIntegrationTests(unittest.TestCase):
    def test_omitted_method_preserves_rk4_default(self) -> None:
        response = run_pulse_request(
            PulseSimulateRequest.model_validate(_qubit_payload())
        )

        evolution = response["diagnostics"]["evolution"]
        self.assertEqual(evolution["resolved"], "fixed_step_rk4")
        self.assertEqual(evolution["method_id"], "fixed_step_rk4_v1")
        self.assertFalse(evolution["cptp_guaranteed_by_construction"])
        self.assertTrue(evolution["cleanup_applied"])
        self.assertIsNone(evolution["open_pulse_audit"])

    def test_qubit_explicit_cptp_returns_sampled_audited_trajectory(self) -> None:
        payload = _qubit_payload()
        payload["evolution_method"] = "explicit_cptp"
        response = run_pulse_request(
            PulseSimulateRequest.model_validate(payload)
        )

        evolution = response["diagnostics"]["evolution"]
        self.assertEqual(evolution["resolved"], "explicit_cptp")
        self.assertEqual(
            evolution["method_id"],
            "explicit_cptp_midpoint_gksl_v1",
        )
        self.assertTrue(evolution["cptp_guaranteed_by_construction"])
        self.assertFalse(evolution["cleanup_applied"])
        self.assertTrue(evolution["open_pulse_audit"]["all_maps_cptp"])
        self.assertTrue(evolution["open_idle_audit"]["all_maps_cptp"])
        self.assertTrue(evolution["closed_pulse_audit"]["all_maps_cptp"])
        self.assertEqual(
            len(response["trajectory"]),
            len(response["sample_times_us"]),
        )
        self.assertTrue(all(
            point["cleanup_correction_norm"] == 0.0
            for point in response["trajectory"]
        ))
        self.assertLess(
            response["diagnostics"]["maximum_cleaned_trace_error"],
            1e-10,
        )

    def test_qutrit_explicit_cptp_preserves_physicality_without_cleanup(
        self,
    ) -> None:
        payload = _qutrit_payload()
        payload["evolution_method"] = "explicit_cptp"
        response = run_qutrit_pulse_request(
            QutritPulseSimulateRequest.model_validate(payload)
        )

        evolution = response["diagnostics"]["evolution"]
        self.assertTrue(evolution["cptp_guaranteed_by_construction"])
        self.assertTrue(evolution["open_pulse_audit"]["all_maps_cptp"])
        self.assertIsNone(evolution["open_idle_audit"])
        self.assertTrue(all(
            point["cleanup_correction_norm"] == 0.0
            for point in response["trajectory"]
        ))
        self.assertGreaterEqual(
            response["diagnostics"]["minimum_cleaned_eigenvalue"],
            -1e-10,
        )

    def test_unknown_evolution_method_is_rejected(self) -> None:
        payload = _qubit_payload()
        payload["evolution_method"] = "implicit_magic"
        with self.assertRaises(ValidationError):
            PulseSimulateRequest.model_validate(payload)

    def test_openapi_publishes_method_enum_and_rk4_default(self) -> None:
        schemas = app.openapi()["components"]["schemas"]
        for schema_name in (
            "PulseSimulateRequest",
            "QutritPulseSimulateRequest",
        ):
            field = schemas[schema_name]["properties"]["evolution_method"]
            self.assertEqual(
                field["enum"],
                ["fixed_step_rk4", "explicit_cptp"],
            )
            self.assertEqual(field["default"], "fixed_step_rk4")

    @unittest.skipUnless(
        is_rust_kernel_available(),
        "yuragi_strider_rust is not importable",
    )
    def test_rust_explicit_cptp_is_selectable_through_api(self) -> None:
        payload = _qubit_payload()
        payload["backend"] = "rust"
        payload["evolution_method"] = "explicit_cptp"
        response = run_pulse_request(
            PulseSimulateRequest.model_validate(payload)
        )

        self.assertEqual(
            response["diagnostics"]["backend"]["resolved"],
            "rust",
        )
        self.assertTrue(
            response["diagnostics"]["evolution"]["open_pulse_audit"][
                "all_maps_cptp"
            ]
        )


def _qubit_payload() -> dict[str, object]:
    return {
        "model_id": "driven_two_level_rwa_experimental_v1",
        "initial_state": "0",
        "pulse": {
            "shape": "square",
            "amplitude_mode": "target_rotation_angle",
            "target_rotation_angle_rad": math.pi / 2.0,
            "pulse_duration_us": 0.02,
            "phase_rad": 0.2,
            "detuning_rad_per_us": 0.1,
            "drag_beta_us": 0.0,
        },
        "total_simulation_time_us": 0.04,
        "environment": {
            "input_mode": "direct_rates",
            "gamma_down_per_us": 0.1,
            "gamma_up_per_us": 0.02,
            "gamma_phi_per_us": 0.05,
        },
        "snapshot_options": {
            "uniform_count": 5,
            "custom_times_us": [0.02],
        },
    }


def _qutrit_payload() -> dict[str, object]:
    return {
        "model_id": "driven_transmon_qutrit_rwa_experimental_v1",
        "initial_state": "0",
        "anharmonicity_mhz": -100.0,
        "pulse": {
            "shape": "gaussian",
            "amplitude_mode": "target_rotation_angle",
            "target_rotation_angle_rad": math.pi / 2.0,
            "sigma_us": 0.002,
            "truncation_sigma": 4.0,
            "phase_rad": 0.2,
            "detuning_rad_per_us": 0.1,
            "drag_beta_us": 0.001,
        },
        "total_simulation_time_us": 0.016,
        "environment": {
            "input_mode": "direct_rates",
            "gamma_10_down_per_us": 0.2,
            "gamma_01_up_per_us": 0.02,
            "gamma_21_down_per_us": 0.4,
            "gamma_12_up_per_us": 0.03,
            "gamma_phi_adjacent_per_us": 0.08,
        },
        "snapshot_options": {
            "uniform_count": 5,
            "custom_times_us": [0.016],
        },
    }


if __name__ == "__main__":
    unittest.main()
