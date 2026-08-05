import unittest

from api.main import SimulateRequest, simulate


class ParameterAnimationContractTest(unittest.TestCase):
    def test_public_simulation_entry_re_evaluates_parameterized_gate(self):
        def request(theta: float) -> SimulateRequest:
            return SimulateRequest(
                simulation_backend="python_dense",
                input_mode="normalized",
                circuit_config={
                    "logical_qubits": 1,
                    "initial_states": [0],
                    "columns": [{
                        "step": 0,
                        "gates": [{
                            "type": "RX",
                            "targets": [0],
                            "params": {"duration_us": 0.02},
                        }],
                    }],
                },
                animation_parameter={
                    "name": "theta_rad",
                    "value": theta,
                    "column_index": 0,
                    "gate_index": 0,
                },
                parameters={
                    "normalized_temperature": 0.0,
                    "normalized_magnetic_field": 0.0,
                    "noise_level": 0.0,
                    "duration_us": 0.1,
                    "time_steps": 3,
                    "fidelity_threshold": 0.9,
                },
            )

        zero = simulate(request(0.0))
        half_turn = simulate(request(3.141592653589793))

        self.assertGreater(zero["output_probabilities"]["0"], 0.99)
        self.assertGreater(half_turn["output_probabilities"]["1"], 0.99)
        self.assertIn("circuit_probes", zero)
        self.assertIn("physical_timeline", half_turn)


if __name__ == "__main__":
    unittest.main()
