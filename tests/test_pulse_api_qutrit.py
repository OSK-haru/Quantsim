import math
import unittest

from fastapi import HTTPException

from api.main import pulse_simulate
from api.pulse_models import (
    QutritPulseSimulateRequest,
    QutritPulseSimulateResponse,
)
from api.pulse_qutrit_service import QUTRIT_API_MAX_INTERNAL_STEPS
from core.capabilities import (
    DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL,
)


class PulseQutritApiTests(unittest.TestCase):
    def test_direct_rate_qutrit_response_exposes_three_level_state(self) -> None:
        request = QutritPulseSimulateRequest.model_validate(
            _direct_payload()
        )
        response = pulse_simulate(request)
        validated = QutritPulseSimulateResponse.model_validate(response)

        self.assertEqual(validated.contract_version, "pulse-extension-b-v1")
        self.assertEqual(validated.model.state_levels, 3)
        self.assertEqual(validated.model.subsystem_dimensions, [3])
        self.assertEqual(len(validated.final.density_matrix), 3)
        self.assertEqual(
            len(validated.final.density_matrix[0]),
            3,
        )
        probability_sum = (
            validated.final.population_0
            + validated.final.population_1
            + validated.final.population_2
        )
        self.assertAlmostEqual(probability_sum, 1.0, places=10)
        self.assertEqual(
            validated.step_policy.maximum_internal_step_count,
            QUTRIT_API_MAX_INTERNAL_STEPS,
        )

    def test_physical_environment_rates_are_returned(self) -> None:
        payload = _direct_payload()
        payload["environment"] = {
            "input_mode": "physical",
            "device_quality": 0.8,
            "temperature_mk": 15.0,
            "flux_noise_phi0": 1e-6,
            "qubit_frequency_ghz": 5.0,
            "t1_max_us": 100.0,
            "tphi_max_us": 100.0,
        }
        response = pulse_simulate(
            QutritPulseSimulateRequest.model_validate(payload)
        )
        self.assertEqual(response["rates"]["input_mode"], "physical")
        self.assertIsNotNone(response["rates"]["n_01"])
        self.assertIsNotNone(response["rates"]["n_12"])

    def test_gaussian_drag_is_executable(self) -> None:
        payload = _direct_payload()
        payload["pulse"]["drag_beta_us"] = 0.001
        response = pulse_simulate(
            QutritPulseSimulateRequest.model_validate(payload)
        )
        self.assertEqual(response["input"]["drag_beta_us"], 0.001)
        self.assertLessEqual(
            response["step_policy"]["estimated_internal_step_count"],
            QUTRIT_API_MAX_INTERNAL_STEPS,
        )

    def test_heavy_qutrit_request_is_rejected_before_execution(self) -> None:
        payload = _direct_payload()
        payload["anharmonicity_mhz"] = -250.0
        payload["pulse"]["sigma_us"] = 0.02
        payload["total_simulation_time_us"] = 0.2
        with self.assertRaises(HTTPException) as context:
            pulse_simulate(
                QutritPulseSimulateRequest.model_validate(payload)
            )
        self.assertEqual(context.exception.status_code, 422)
        self.assertIn(
            "internal-step limit",
            str(context.exception.detail),
        )


def _direct_payload() -> dict[str, object]:
    return {
        "model_id": DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL,
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
            "drag_beta_us": 0.0,
        },
        "total_simulation_time_us": 0.02,
        "environment": {
            "input_mode": "direct_rates",
            "gamma_10_down_per_us": 0.2,
            "gamma_01_up_per_us": 0.02,
            "gamma_21_down_per_us": 0.4,
            "gamma_12_up_per_us": 0.03,
            "gamma_phi_adjacent_per_us": 0.08,
        },
        "snapshot_options": {
            "uniform_count": 9,
            "custom_times_us": [0.016, 0.02],
        },
    }


if __name__ == "__main__":
    unittest.main()
