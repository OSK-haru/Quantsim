import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.expert_data import build_expert_inspector_data
from core.gates import multi_qubit_environment_collapse_operators
from core.physical_environment import (
    INPUT_MODE_NORMALIZED,
    INPUT_MODE_PHYSICAL,
    compute_environment_rates,
)
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation


class UnifiedEnvironmentSimulationTest(unittest.TestCase):
    def test_one_qubit_h_runs_with_normalized_input_mode(self) -> None:
        result = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(input_mode=INPUT_MODE_NORMALIZED),
            duration_us=2.0,
            time_steps=11,
        ))

        self.assertEqual(len(result.times), 11)
        self.assertEqual(result.derived_parameters["input_mode"], INPUT_MODE_NORMALIZED)
        self.assertIn("gamma_down_per_us", result.derived_parameters)
        self.assertIn("gamma_up_per_us", result.derived_parameters)
        self.assertIn("gamma_phi_per_us", result.derived_parameters)
        self.assertIn("gamma1_per_us", result.derived_parameters)
        self.assertIn("gammaphi_per_us", result.derived_parameters)

    def test_one_qubit_h_runs_with_physical_input_mode(self) -> None:
        result = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(input_mode=INPUT_MODE_PHYSICAL),
            duration_us=2.0,
            time_steps=11,
        ))

        self.assertEqual(len(result.times), 11)
        self.assertEqual(result.derived_parameters["input_mode"], INPUT_MODE_PHYSICAL)

    def test_two_qubit_bell_runs_with_both_input_modes(self) -> None:
        for input_mode in (INPUT_MODE_NORMALIZED, INPUT_MODE_PHYSICAL):
            with self.subTest(input_mode=input_mode):
                result = run_simulation(SimulationConfig(
                    circuit=_bell_circuit(),
                    environment=EnvironmentConfig(input_mode=input_mode),
                    duration_us=2.0,
                    time_steps=11,
                ))

                self.assertEqual(len(result.times), 11)
                self.assertAlmostEqual(
                    sum(result.output_probabilities.values()),
                    1.0,
                    delta=1e-8,
                )

    def test_long_high_noise_bell_run_remains_numerically_stable(self) -> None:
        result = run_simulation(SimulationConfig(
            circuit=_bell_circuit(),
            environment=EnvironmentConfig(
                input_mode=INPUT_MODE_NORMALIZED,
                temperature=0.82,
                magnetic_field=0.11,
                noise_level=0.99,
            ),
            duration_us=200.0,
            time_steps=101,
            fidelity_threshold=0.73,
        ))

        self.assertEqual(len(result.times), 101)
        self.assertLessEqual(max(result.fidelity), 1.0 + 1e-10)
        self.assertLessEqual(max(result.purity), 1.0 + 1e-10)
        self.assertAlmostEqual(sum(result.output_probabilities.values()), 1.0, delta=1e-8)
        self.assertGreater(result.diagnostics["integration_substeps"], 1.0)
        self.assertIn("state", build_expert_inspector_data(result))

    def test_ideal_reference_produces_zero_collapse_operators(self) -> None:
        rates = compute_environment_rates(EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            ideal_reference=True,
            device_quality=1.0,
            temperature_mk=0.0,
            flux_noise_phi0=0.0,
        ))

        self.assertEqual(rates.gamma_down_per_us, 0.0)
        self.assertEqual(rates.gamma_up_per_us, 0.0)
        self.assertEqual(rates.gamma_phi_per_us, 0.0)
        self.assertEqual(multi_qubit_environment_collapse_operators(1, rates), [])

    def test_larger_profile_max_times_reduce_decoherence(self) -> None:
        base = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(
                input_mode=INPUT_MODE_PHYSICAL,
                device_quality=1.0,
                temperature_mk=0.0,
                flux_noise_phi0=0.0,
                t1_max_us=100.0,
                tphi_max_us=100.0,
            ),
            duration_us=20.0,
            time_steps=101,
        ))
        extended = run_simulation(SimulationConfig(
            circuit=CircuitConfig.one_qubit_h(),
            environment=EnvironmentConfig(
                input_mode=INPUT_MODE_PHYSICAL,
                device_quality=1.0,
                temperature_mk=0.0,
                flux_noise_phi0=0.0,
                t1_max_us=10000.0,
                tphi_max_us=10000.0,
            ),
            duration_us=20.0,
            time_steps=101,
        ))

        self.assertGreater(extended.fidelity[-1], base.fidelity[-1])
        self.assertGreater(extended.purity[-1], base.purity[-1])


def _bell_circuit() -> CircuitConfig:
    return CircuitConfig(
        logical_qubits=2,
        initial_states=["0", "0"],
        columns=[
            GateColumn(
                step=0,
                gates=[GateOperation(type="H", targets=[0])],
            ),
            GateColumn(
                step=1,
                gates=[GateOperation(type="CNOT", targets=[1], controls=[0])],
            ),
        ],
    )


if __name__ == "__main__":
    unittest.main()
