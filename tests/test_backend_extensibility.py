import unittest

from core.circuit_model import CircuitConfig
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulation_backends import register_simulation_backend
from core.simulator import run_simulation
from core.validation import validate_simulation_config


class BackendExtensibilityTest(unittest.TestCase):
    def test_registered_backend_uses_same_config_and_result_contract(self) -> None:
        model = "test_contract_backend"

        def runner(config: SimulationConfig) -> SimulationResult:
            return SimulationResult(
                config=config,
                times=[0.0],
                fidelity=[1.0],
                purity=[1.0],
                effective_operation_time_us=0.0,
                output_probabilities={"0": 1.0},
                derived_parameters={},
                diagnostics={},
                warnings=[],
                issues=[],
            )

        register_simulation_backend(model, runner)
        config = SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(),
            model=model,
        )

        issues = validate_simulation_config(config)
        result = run_simulation(config)

        self.assertEqual(issues, [])
        self.assertIsInstance(result, SimulationResult)
        self.assertEqual(result.config.model, model)
        self.assertEqual(result.times, [0.0])
        self.assertEqual(result.issues, [])


if __name__ == "__main__":
    unittest.main()
