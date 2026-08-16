"""Physical-validity checks for the coupled transmon-network pulse model.

These run without QuTiP so the network keeps a solver-independent physics
guard: an analytic exchange solution, closed-system invariants, and agreement
with the separately validated single-qutrit model.
"""

import math
import unittest

import numpy as np
from pydantic import TypeAdapter

from api.main import pulse_simulate
from api.pulse_models import PulseApiRequest
from core.pulse_envelopes import GaussianPulseEnvelope, SquarePulseEnvelope
from core.pulse_transmon_network import (
    CoupledTransmonNetworkHamiltonian,
    ScheduledTransmonDrive,
    TransmonExchangeCoupling,
)


ZERO_RATES = {
    "input_mode": "direct_rates",
    "gamma_10_down_per_us": 0.0,
    "gamma_01_up_per_us": 0.0,
    "gamma_21_down_per_us": 0.0,
    "gamma_12_up_per_us": 0.0,
    "gamma_phi_adjacent_per_us": 0.0,
}
OPEN_RATES = {
    "input_mode": "direct_rates",
    "gamma_10_down_per_us": 0.18,
    "gamma_01_up_per_us": 0.03,
    "gamma_21_down_per_us": 0.34,
    "gamma_12_up_per_us": 0.05,
    "gamma_phi_adjacent_per_us": 0.07,
}
IDLE_PULSE = {
    "shape": "square",
    "amplitude_mode": "peak_amplitude",
    "peak_amplitude_rad_per_us": 0.0,
    "pulse_duration_us": 0.001,
    "phase_rad": 0.0,
    "detuning_rad_per_us": 0.0,
    "drag_beta_us": 0.0,
}
SQUARE_PULSE = {
    "shape": "square",
    "amplitude_mode": "target_rotation_angle",
    "target_rotation_angle_rad": 0.35 * math.pi,
    "pulse_duration_us": 0.006,
    "phase_rad": 0.25,
    "detuning_rad_per_us": 0.0,
    "drag_beta_us": 0.0,
}


class CoupledTransmonNetworkPhysicsTests(unittest.TestCase):
    def test_exchange_coupling_matches_the_analytic_vacuum_rabi_solution(self) -> None:
        """One excitation on a resonant pair swaps as cos^2(Jt) and sin^2(Jt)."""

        exchange = 40.0
        response = _simulate(_network_payload(
            initial_state="10",
            couplings=[{
                "left": 0,
                "right": 1,
                "exchange_coupling_rad_per_us": exchange,
            }],
            drives=[{"target": 0, "start_time_us": 0.0, "pulse": IDLE_PULSE}],
            total_simulation_time_us=0.05,
            environment=ZERO_RATES,
            uniform_count=11,
        ))

        for point in response["trajectory"]:
            time_us = float(point["time_us"])
            populations = point["joint_populations"]
            self.assertAlmostEqual(
                populations["10"],
                math.cos(exchange * time_us) ** 2,
                places=9,
            )
            self.assertAlmostEqual(
                populations["01"],
                math.sin(exchange * time_us) ** 2,
                places=9,
            )

    def test_closed_network_conserves_purity_and_excitation_number(self) -> None:
        response = _simulate(_network_payload(
            initial_state="10",
            couplings=[{
                "left": 0,
                "right": 1,
                "exchange_coupling_rad_per_us": 25.0,
            }],
            drives=[{"target": 0, "start_time_us": 0.0, "pulse": IDLE_PULSE}],
            total_simulation_time_us=0.03,
            environment=ZERO_RATES,
            uniform_count=7,
        ))

        for point in response["trajectory"]:
            populations = point["joint_populations"]
            excitations = sum(
                value * sum(int(level) for level in label)
                for label, value in populations.items()
            )
            self.assertAlmostEqual(point["purity"], 1.0, places=9)
            self.assertAlmostEqual(excitations, 1.0, places=9)

    def test_uncoupled_network_reproduces_the_single_qutrit_model(self) -> None:
        """A square pulse plus idle must match the validated qutrit model.

        The uncoupled network factorises, so transmon 0 has to follow the
        single-qutrit contract exactly. A square pulse with an idle tail is the
        case that catches drive edges bleeding across an integration boundary.
        """

        qutrit = _simulate({
            "model_id": "driven_transmon_qutrit_rwa_experimental_v1",
            "initial_state": "0",
            "anharmonicity_mhz": -100.0,
            "pulse": SQUARE_PULSE,
            "total_simulation_time_us": 0.02,
            "backend": "python",
            "evolution_method": "fixed_step_rk4",
            "environment": OPEN_RATES,
            "snapshot_options": {"uniform_count": 2, "custom_times_us": []},
        })
        network = _simulate(_network_payload(
            initial_state="00",
            couplings=[],
            drives=[{"target": 0, "start_time_us": 0.0, "pulse": SQUARE_PULSE}],
            total_simulation_time_us=0.02,
            environment=OPEN_RATES,
            uniform_count=2,
        ))

        expected = _density_matrix(qutrit["final"]["density_matrix"])
        joint = _density_matrix(network["final"]["density_matrix"])
        reduced = joint.reshape(3, 3, 3, 3).trace(axis1=1, axis2=3)
        self.assertLess(float(np.max(np.abs(expected - reduced))), 1e-12)

    def test_segment_view_pins_the_active_drive_set(self) -> None:
        hamiltonian = CoupledTransmonNetworkHamiltonian(
            anharmonicities_rad_per_us=(-628.3, -628.3),
            detunings_rad_per_us=(0.0, 0.0),
            couplings=(),
            drives=(
                ScheduledTransmonDrive(0, 0.0, SquarePulseEnvelope(12.0, 0.004)),
                ScheduledTransmonDrive(
                    1,
                    0.004,
                    GaussianPulseEnvelope(9.0, 0.0005, 4.0),
                ),
            ),
        )

        pulse_segment = hamiltonian.for_segment(0.0, 0.004)
        idle_start = hamiltonian.for_segment(0.004, 0.008)
        self.assertEqual(
            [drive.target for drive in pulse_segment.drives],
            [0],
        )
        self.assertEqual(
            [drive.target for drive in idle_start.drives],
            [1],
        )
        # The square drive is over at 0.004, so its edge must not act there.
        self.assertTrue(np.array_equal(
            idle_start.evaluate_array(0.004),
            hamiltonian.for_segment(0.004, 0.008).evaluate_array(0.004),
        ))

        with self.assertRaises(ValueError):
            hamiltonian.for_segment(0.002, 0.006)


def _network_payload(
    *,
    initial_state: str,
    couplings: list[dict[str, object]],
    drives: list[dict[str, object]],
    total_simulation_time_us: float,
    environment: dict[str, object],
    uniform_count: int,
) -> dict[str, object]:
    count = len(initial_state)
    return {
        "model_id": "driven_coupled_transmon_network_rwa_experimental_v1",
        "transmon_count": count,
        "initial_state": initial_state,
        "frequencies_ghz": [5.0] * count,
        "anharmonicities_mhz": [-100.0] * count,
        "detunings_rad_per_us": [0.0] * count,
        "couplings": couplings,
        "drives": drives,
        "total_simulation_time_us": total_simulation_time_us,
        "backend": "python",
        "evolution_method": "fixed_step_rk4",
        "environment": environment,
        "snapshot_options": {
            "uniform_count": uniform_count,
            "custom_times_us": [],
        },
    }


def _simulate(payload: dict[str, object]) -> dict[str, object]:
    request = TypeAdapter(PulseApiRequest).validate_python(payload)
    return pulse_simulate(request)


def _density_matrix(matrix) -> np.ndarray:
    return np.asarray([
        [complex(value["real"], value["imag"]) for value in row]
        for row in matrix
    ], dtype=complex)


if __name__ == "__main__":
    unittest.main()
