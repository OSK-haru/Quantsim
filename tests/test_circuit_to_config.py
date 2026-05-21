import sys
import unittest

from core.circuit_model import GateOperation
from core.circuit_state import CircuitState
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation


class CircuitToConfigTest(unittest.TestCase):
    def test_one_qubit_h_circuit_from_state_runs_simulation(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        state.add_gate(
            0,
            GateOperation(
                type="H",
                targets=[0],
                controls=[],
                params={},
            ),
        )

        config = SimulationConfig(
            circuit=state.to_config(),
            environment=EnvironmentConfig(
                mode="normalized",
                temperature=0.02,
                magnetic_field=0.0,
                noise_level=0.01,
            ),
            duration_us=20.0,
            time_steps=101,
            fidelity_threshold=0.9,
        )
        result = run_simulation(config)

        self.assertIsInstance(result, SimulationResult)
        self.assertEqual(len(result.times), 101)
        self.assertEqual(result.issues, [])
        self.assertNotIn("streamlit", sys.modules)


if __name__ == "__main__":
    unittest.main()
