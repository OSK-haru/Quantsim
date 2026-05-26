import unittest

from app.ui.session_sync import (
    apply_loaded_config_to_session,
    clear_open_config_upload,
    current_simulation_config,
    initialize_default_session_state,
    open_config_uploader_key,
    resize_logical_qubits,
)
from core.circuit_history import CircuitHistory
from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.circuit_state import CircuitState
from core.results import EnvironmentConfig, SimulationConfig


class ConfigUiSyncTest(unittest.TestCase):
    def test_apply_loaded_config_updates_session_and_clears_stale_results(self) -> None:
        state = {
            "last_result": object(),
            "last_comparison": object(),
            "last_comparison_result": object(),
            "expert_data": {"old": True},
        }
        config = _two_qubit_config()

        apply_loaded_config_to_session(config, state)

        self.assertEqual(state["logical_qubits"], 2)
        self.assertEqual(state["initial_states"], ["0", "0"])
        self.assertIsInstance(state["circuit_state"], CircuitState)
        self.assertIsInstance(state["circuit_history"], CircuitHistory)
        self.assertEqual(state["temperature"], 0.3)
        self.assertEqual(state["magnetic_field"], 0.2)
        self.assertEqual(state["noise_level"], 0.4)
        self.assertEqual(state["duration_us"], 7.0)
        self.assertEqual(state["time_steps"], 9)
        self.assertEqual(state["fidelity_threshold"], 0.8)
        self.assertEqual(state["model"], "weak_coupling_lindblad")
        self.assertIsNone(state["last_result"])
        self.assertIsNone(state["last_comparison_result"])
        self.assertIsNone(state["expert_data"])

    def test_current_simulation_config_uses_current_circuit_state(self) -> None:
        state = {}
        apply_loaded_config_to_session(_two_qubit_config(), state)
        state["circuit_state"].resize_qubits(1)

        config = current_simulation_config(state)

        self.assertEqual(config.circuit.logical_qubits, 1)
        self.assertEqual(config.environment.noise_level, 0.4)

    def test_resize_logical_qubits_updates_history_and_initial_states(self) -> None:
        state = {}
        apply_loaded_config_to_session(_two_qubit_config(), state)

        warnings = resize_logical_qubits(1, state)

        self.assertEqual(state["logical_qubits"], 1)
        self.assertEqual(state["circuit_state"].logical_qubits, 1)
        self.assertEqual(state["initial_states"], ["0"])
        self.assertTrue(warnings)
        self.assertIsNone(state["last_result"])

    def test_open_config_upload_key_changes_after_clear(self) -> None:
        state = {}

        first_key = open_config_uploader_key("mode", state)
        clear_open_config_upload("mode", state)
        second_key = open_config_uploader_key("mode", state)

        self.assertNotEqual(first_key, second_key)
        self.assertEqual(first_key, "mode_config_upload_0")
        self.assertEqual(second_key, "mode_config_upload_1")

    def test_initialize_does_not_override_user_changed_logical_qubits(self) -> None:
        state = {}
        apply_loaded_config_to_session(_two_qubit_config(), state)
        state["logical_qubits"] = 1

        initialize_default_session_state(state)

        self.assertEqual(state["logical_qubits"], 1)
        self.assertEqual(state["circuit_history"].current.logical_qubits, 2)


def _two_qubit_config() -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(type="H", targets=[0], controls=[], params={})
                    ],
                ),
                GateColumn(
                    step=1,
                    gates=[
                        GateOperation(
                            type="CNOT",
                            targets=[1],
                            controls=[0],
                            params={},
                        )
                    ],
                ),
            ],
        ),
        environment=EnvironmentConfig(
            mode="normalized",
            temperature=0.3,
            magnetic_field=0.2,
            noise_level=0.4,
        ),
        duration_us=7.0,
        time_steps=9,
        fidelity_threshold=0.8,
    )


if __name__ == "__main__":
    unittest.main()
