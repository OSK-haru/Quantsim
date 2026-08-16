import math
import unittest

from fastapi import HTTPException
from pydantic import TypeAdapter, ValidationError

from api.main import pulse_simulate
from api.pulse_models import (
    CoupledTransmonNetworkPulseSimulateRequest,
    CoupledTransmonNetworkPulseSimulateResponse,
    PulseApiRequest,
)
from core.capabilities import (
    DRIVEN_COUPLED_TRANSMON_NETWORK_RWA_EXPERIMENTAL_MODEL,
    SUPPORTED_PULSE_MODELS,
)
from core.gates import add, adjoint, matmul, subtract
from core.pulse_envelopes import SquarePulseEnvelope
from core.pulse_qutrit_contract import NUMBER_QUTRIT
from core.pulse_transmon_network import (
    CoupledTransmonNetworkHamiltonian,
    ScheduledTransmonDrive,
    TransmonExchangeCoupling,
    embed_network_local_operator,
)


class CoupledTransmonNetworkApiTests(unittest.TestCase):
    def test_network_is_discoverable_and_selected_by_discriminator(self) -> None:
        self.assertIn(
            DRIVEN_COUPLED_TRANSMON_NETWORK_RWA_EXPERIMENTAL_MODEL,
            SUPPORTED_PULSE_MODELS,
        )
        request = TypeAdapter(PulseApiRequest).validate_python(_network_payload())
        self.assertIsInstance(request, CoupledTransmonNetworkPulseSimulateRequest)

    def test_three_transmon_hamiltonian_is_hermitian_and_conserves_excitation(self) -> None:
        hamiltonian = CoupledTransmonNetworkHamiltonian(
            anharmonicities_rad_per_us=(-120.0, -130.0, -140.0),
            detunings_rad_per_us=(0.0, 5.0, -3.0),
            couplings=(
                TransmonExchangeCoupling(0, 1, 2.0),
                TransmonExchangeCoupling(1, 2, 3.0),
            ),
            drives=(
                ScheduledTransmonDrive(0, 0.0, SquarePulseEnvelope(0.0, 0.001)),
            ),
        ).evaluate(0.0005)
        hermitian = adjoint(hamiltonian)
        total_number = add(*(
            embed_network_local_operator(NUMBER_QUTRIT, index, 3)
            for index in range(3)
        ))
        commutator = subtract(
            matmul(hamiltonian, total_number),
            matmul(total_number, hamiltonian),
        )

        self.assertEqual(len(hamiltonian), 27)
        self.assertLess(
            max(
                abs(hamiltonian[row][column] - hermitian[row][column])
                for row in range(27)
                for column in range(27)
            ),
            1e-14,
        )
        self.assertLess(max(abs(value) for row in commutator for value in row), 1e-12)

    def test_three_transmon_api_returns_joint_density_matrix(self) -> None:
        request = CoupledTransmonNetworkPulseSimulateRequest.model_validate(
            _network_payload()
        )
        response = pulse_simulate(request)
        validated = CoupledTransmonNetworkPulseSimulateResponse.model_validate(response)

        self.assertEqual(validated.model["logical_qubits"], 3)
        self.assertEqual(validated.model["hilbert_dimension"], 27)
        self.assertEqual(len(validated.final.density_matrix), 27)
        self.assertEqual(len(validated.model["basis_order"]), 27)
        self.assertAlmostEqual(
            sum(validated.final.joint_populations.values()),
            1.0,
            places=10,
        )
        populations = validated.final.joint_populations
        q0_excited = sum(value for label, value in populations.items() if label[0] == "1")
        q2_excited = sum(value for label, value in populations.items() if label[2] == "1")
        self.assertGreater(q0_excited, 1e-4)
        self.assertGreater(q2_excited, 1e-4)

    def test_network_rejects_registers_above_four_transmons(self) -> None:
        payload = _network_payload()
        payload.update({
            "transmon_count": 5,
            "initial_state": "00000",
            "frequencies_ghz": [5.0] * 5,
            "anharmonicities_mhz": [-20.0] * 5,
            "detunings_rad_per_us": [0.0] * 5,
        })
        with self.assertRaises(ValidationError):
            CoupledTransmonNetworkPulseSimulateRequest.model_validate(payload)

    def test_four_transmon_response_budget_is_checked_before_evolution(self) -> None:
        payload = _network_payload()
        payload.update({
            "transmon_count": 4,
            "initial_state": "0000",
            "frequencies_ghz": [5.0] * 4,
            "anharmonicities_mhz": [-20.0] * 4,
            "detunings_rad_per_us": [0.0] * 4,
            "snapshot_options": {"uniform_count": 101, "custom_times_us": []},
        })
        request = CoupledTransmonNetworkPulseSimulateRequest.model_validate(payload)

        with self.assertRaises(HTTPException) as raised:
            pulse_simulate(request)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("density-matrix element limit", str(raised.exception.detail))

    def test_four_transmon_dense_work_budget_is_checked_before_evolution(self) -> None:
        payload = _network_payload()
        payload.update({
            "transmon_count": 4,
            "initial_state": "0000",
            "frequencies_ghz": [5.0] * 4,
            "anharmonicities_mhz": [-20.0] * 4,
            "detunings_rad_per_us": [0.0] * 4,
            "total_simulation_time_us": 0.1,
            "snapshot_options": {"uniform_count": 2, "custom_times_us": [0.001]},
        })
        request = CoupledTransmonNetworkPulseSimulateRequest.model_validate(payload)

        with self.assertRaises(HTTPException) as raised:
            pulse_simulate(request)

        self.assertEqual(raised.exception.status_code, 422)
        self.assertIn("dimension-aware dense-work limit", str(raised.exception.detail))


def _network_payload() -> dict[str, object]:
    pulse = {
        "shape": "square",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": math.pi / 20,
        "pulse_duration_us": 0.001,
        "phase_rad": 0.0,
        "detuning_rad_per_us": 0.0,
        "drag_beta_us": 0.0,
    }
    return {
        "model_id": DRIVEN_COUPLED_TRANSMON_NETWORK_RWA_EXPERIMENTAL_MODEL,
        "transmon_count": 3,
        "initial_state": "000",
        "frequencies_ghz": [5.0, 5.1, 4.9],
        "anharmonicities_mhz": [-20.0, -22.0, -24.0],
        "detunings_rad_per_us": [0.0, 0.0, 0.0],
        "couplings": [
            {"left": 0, "right": 1, "exchange_coupling_rad_per_us": 1.0},
            {"left": 1, "right": 2, "exchange_coupling_rad_per_us": 1.5},
        ],
        "drives": [
            {"target": 0, "start_time_us": 0.0, "pulse": pulse},
            {
                "target": 2,
                "start_time_us": 0.0,
                "pulse": {**pulse, "phase_rad": math.pi / 2},
            },
        ],
        "total_simulation_time_us": 0.001,
        "backend": "python",
        "evolution_method": "fixed_step_rk4",
        "environment": {
            "input_mode": "direct_rates",
            "gamma_10_down_per_us": 0.0,
            "gamma_01_up_per_us": 0.0,
            "gamma_21_down_per_us": 0.0,
            "gamma_12_up_per_us": 0.0,
            "gamma_phi_adjacent_per_us": 0.0,
        },
        "snapshot_options": {"uniform_count": 3, "custom_times_us": []},
    }


if __name__ == "__main__":
    unittest.main()
