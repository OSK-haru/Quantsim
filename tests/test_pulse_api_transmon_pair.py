import math
import unittest

from api.main import pulse_simulate
from api.pulse_models import (
    CoupledTransmonPairPulseSimulateRequest,
    CoupledTransmonPairPulseSimulateResponse,
)
from core.capabilities import (
    DRIVEN_COUPLED_TRANSMON_PAIR_RWA_EXPERIMENTAL_MODEL,
)
from core.gates import add, adjoint, matmul, subtract
from core.pulse_envelopes import SquarePulseEnvelope
from core.pulse_qutrit_contract import NUMBER_QUTRIT
from core.pulse_transmon_pair import (
    CoupledTransmonPairHamiltonian,
    embed_local_operator,
)
from core.quasi_static_noise import correlated_gaussian_detuning_pair_samples
from core.rust_dense_kernel import is_rust_kernel_available


class CoupledTransmonPairApiTests(unittest.TestCase):
    def test_near_duplicate_pulse_boundary_snapshot_is_normalized(self) -> None:
        payload = _pair_payload()
        payload["total_simulation_time_us"] = 0.024
        payload["snapshot_options"] = {
            "uniform_count": 13,
            "custom_times_us": [0.016],
        }
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )
        times = response["sample_times_us"]
        self.assertEqual(times, sorted(set(times)))
        self.assertEqual(sum(abs(value - 0.016) < 1e-14 for value in times), 1)

    def test_pair_hamiltonian_is_hermitian_and_exchange_conserves_excitation(self) -> None:
        hamiltonian = CoupledTransmonPairHamiltonian(
            envelope=SquarePulseEnvelope(0.0, 0.02),
            anharmonicities_rad_per_us=(-600.0, -650.0),
            detunings_rad_per_us=(0.0, 30.0),
            exchange_coupling_rad_per_us=5.0,
            drive_target=0,
        ).evaluate(0.01)
        hermitian_error = max(
            abs(hamiltonian[row][column] - adjoint(hamiltonian)[row][column])
            for row in range(9)
            for column in range(9)
        )
        total_number = add(
            embed_local_operator(NUMBER_QUTRIT, 0),
            embed_local_operator(NUMBER_QUTRIT, 1),
        )
        commutator = subtract(
            matmul(hamiltonian, total_number),
            matmul(total_number, hamiltonian),
        )

        self.assertLess(hermitian_error, 1e-14)
        self.assertLess(
            max(abs(value) for row in commutator for value in row),
            1e-12,
        )

    def test_pair_response_has_nine_dimensional_state(self) -> None:
        request = CoupledTransmonPairPulseSimulateRequest.model_validate(
            _pair_payload()
        )
        response = pulse_simulate(request)
        validated = CoupledTransmonPairPulseSimulateResponse.model_validate(
            response
        )

        self.assertEqual(validated.model["hilbert_dimension"], 9)
        self.assertEqual(len(validated.final.density_matrix), 9)
        self.assertEqual(len(validated.final.density_matrix[0]), 9)
        self.assertAlmostEqual(
            sum(validated.final.joint_populations.values()),
            1.0,
            places=10,
        )
        self.assertLessEqual(
            validated.step_policy["estimated_internal_step_count"],
            validated.step_policy["maximum_internal_step_count"],
        )

    def test_exchange_coupling_moves_single_excitation(self) -> None:
        payload = _pair_payload()
        payload["initial_state"] = "10"
        payload["exchange_coupling_rad_per_us"] = 20.0
        payload["pulse"]["target_rotation_angle_rad"] = 0.0
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )

        self.assertGreater(response["final"]["joint_populations"]["01"], 0.05)
        self.assertLess(response["final"]["joint_populations"]["10"], 0.95)

    def test_zero_coupling_keeps_spectator_in_ground_state(self) -> None:
        payload = _pair_payload()
        payload["exchange_coupling_rad_per_us"] = 0.0
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )

        spectator_excited = sum(
            probability
            for label, probability in response["final"]["joint_populations"].items()
            if label[1] != "0"
        )
        self.assertAlmostEqual(spectator_excited, 0.0, places=10)

    def test_correlated_pair_quadrature_reproduces_covariance(self) -> None:
        samples = correlated_gaussian_detuning_pair_samples((2.0, 3.0), 0.4, 3)
        self.assertAlmostEqual(sum(weight for _, weight in samples), 1.0, places=13)
        self.assertAlmostEqual(
            sum(offsets[0] * offsets[1] * weight for offsets, weight in samples),
            0.4 * 2.0 * 3.0,
            places=12,
        )

    def test_pair_quasi_static_noise_averages_full_joint_state(self) -> None:
        payload = _pair_payload()
        payload["quasi_static_detuning_sigmas_rad_per_us"] = [2.0, 3.0]
        payload["quasi_static_detuning_correlation"] = 0.25
        payload["quasi_static_quadrature_order"] = 3
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )
        diagnostics = response["diagnostics"]["quasi_static_noise"]
        self.assertEqual(diagnostics["sample_count"], 9)
        self.assertEqual(
            diagnostics["model_id"],
            "correlated_gaussian_pair_detuning_v1",
        )
        self.assertAlmostEqual(
            sum(response["final"]["joint_populations"].values()),
            1.0,
            places=10,
        )

    def test_simultaneous_two_channel_drive_excites_both_transmons(self) -> None:
        payload = _pair_payload()
        payload["exchange_coupling_rad_per_us"] = 0.0
        payload["detunings_rad_per_us"] = [0.0, 0.0]
        payload["secondary_pulse"] = dict(payload["pulse"])
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )
        populations = response["final"]["joint_populations"]
        q0_excited = sum(value for label, value in populations.items() if label[0] == "1")
        q1_excited = sum(value for label, value in populations.items() if label[1] == "1")
        self.assertGreater(q0_excited, 0.2)
        self.assertGreater(q1_excited, 0.2)

    def test_pair_explicit_cptp_audits_nine_dimensional_maps(self) -> None:
        payload = _short_pair_payload()
        payload["evolution_method"] = "explicit_cptp"
        payload["backend"] = "rust" if is_rust_kernel_available() else "python"
        response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(payload)
        )
        audit = response["diagnostics"]["evolution"]["open_pulse_audit"]
        self.assertTrue(audit["all_maps_cptp"])
        self.assertGreater(audit["interval_count"], 0)
        self.assertFalse(response["diagnostics"]["evolution"]["cleanup_applied"])

    @unittest.skipUnless(is_rust_kernel_available(), "Rust kernel unavailable")
    def test_pair_rust_rk4_matches_python(self) -> None:
        python_payload = _short_pair_payload()
        rust_payload = _short_pair_payload()
        python_payload["backend"] = "python"
        rust_payload["backend"] = "rust"
        python_response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(python_payload)
        )
        rust_response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(rust_payload)
        )
        for python_row, rust_row in zip(
            python_response["final"]["density_matrix"],
            rust_response["final"]["density_matrix"],
        ):
            for python_value, rust_value in zip(python_row, rust_row):
                self.assertAlmostEqual(python_value["real"], rust_value["real"], places=11)
                self.assertAlmostEqual(python_value["imag"], rust_value["imag"], places=11)

    @unittest.skipUnless(is_rust_kernel_available(), "Rust kernel unavailable")
    def test_pair_rust_cptp_matches_python_cptp(self) -> None:
        python_payload = _short_pair_payload()
        rust_payload = _short_pair_payload()
        python_payload.update({"backend": "python", "evolution_method": "explicit_cptp"})
        rust_payload.update({"backend": "rust", "evolution_method": "explicit_cptp"})
        python_response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(python_payload)
        )
        rust_response = pulse_simulate(
            CoupledTransmonPairPulseSimulateRequest.model_validate(rust_payload)
        )
        difference = math.sqrt(sum(
            (python_value["real"] - rust_value["real"]) ** 2
            + (python_value["imag"] - rust_value["imag"]) ** 2
            for python_row, rust_row in zip(
                python_response["final"]["density_matrix"],
                rust_response["final"]["density_matrix"],
            )
            for python_value, rust_value in zip(python_row, rust_row)
        ))
        self.assertLess(difference, 1e-9)


def _pair_payload() -> dict[str, object]:
    return {
        "model_id": DRIVEN_COUPLED_TRANSMON_PAIR_RWA_EXPERIMENTAL_MODEL,
        "initial_state": "00",
        "anharmonicities_mhz": [-100.0, -110.0],
        "detunings_rad_per_us": [0.0, 30.0],
        "exchange_coupling_rad_per_us": 5.0,
        "drive_target": 0,
        "pulse": {
            "shape": "gaussian",
            "amplitude_mode": "target_rotation_angle",
            "target_rotation_angle_rad": math.pi / 2,
            "sigma_us": 0.002,
            "truncation_sigma": 4.0,
            "phase_rad": 0.0,
            "detuning_rad_per_us": 0.0,
            "drag_beta_us": 0.0,
        },
        "total_simulation_time_us": 0.02,
        "environment": {
            "input_mode": "direct_rates",
            "gamma_10_down_per_us": 0.0,
            "gamma_01_up_per_us": 0.0,
            "gamma_21_down_per_us": 0.0,
            "gamma_12_up_per_us": 0.0,
            "gamma_phi_adjacent_per_us": 0.0,
        },
        "snapshot_options": {
            "uniform_count": 9,
            "custom_times_us": [0.016],
        },
    }


def _short_pair_payload() -> dict[str, object]:
    payload = _pair_payload()
    payload["pulse"] = {
        "shape": "square",
        "amplitude_mode": "target_rotation_angle",
        "target_rotation_angle_rad": 0.2,
        "pulse_duration_us": 0.002,
        "phase_rad": 0.0,
        "detuning_rad_per_us": 0.0,
        "drag_beta_us": 0.0,
    }
    payload["total_simulation_time_us"] = 0.002
    payload["snapshot_options"] = {
        "uniform_count": 3,
        "custom_times_us": [0.002],
    }
    return payload


if __name__ == "__main__":
    unittest.main()
