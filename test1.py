import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation


class PublicSimulationSmokeTest(unittest.TestCase):
    def test_one_qubit_h_runs_through_public_api(self) -> None:
        config = SimulationConfig(
            circuit=CircuitConfig(
                logical_qubits=1,
                initial_states=["0"],
                columns=[
                    GateColumn(
                        step=0,
                        gates=[GateOperation(type="H", targets=[0])],
                    )
                ],
            ),
            environment=EnvironmentConfig(
                input_mode="physical",
                ideal_reference=True,
                device_quality=1.0,
                temperature_mk=0.0,
                flux_noise_phi0=0.0,
            ),
            duration_us=1.0,
            time_steps=21,
            fidelity_threshold=0.9,
        )

        result = run_simulation(config)

        self.assertIsInstance(result, SimulationResult)
        self.assertAlmostEqual(result.output_probabilities["0"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.output_probabilities["1"], 0.5, delta=1e-10)
        self.assertAlmostEqual(result.fidelity[-1], 1.0, delta=1e-10)


if __name__ == "__main__":
    unittest.main()
