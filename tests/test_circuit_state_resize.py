import unittest

from core.circuit_model import GateOperation
from core.circuit_state import CircuitState


class CircuitStateResizeTest(unittest.TestCase):
    def test_increasing_qubits_appends_zero_initial_states(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])

        warnings = state.resize_qubits(2)

        self.assertEqual(state.logical_qubits, 2)
        self.assertEqual(state.initial_states, ["0", "0"])
        self.assertTrue(warnings)

    def test_decreasing_qubits_removes_invalid_gates(self) -> None:
        state = CircuitState(logical_qubits=2, initial_states=["0", "0"], columns=[])
        state.add_gate(0, GateOperation(type="H", targets=[0], controls=[], params={}))
        state.add_gate(1, GateOperation(type="X", targets=[1], controls=[], params={}))
        state.add_gate(2, GateOperation(type="CNOT", targets=[1], controls=[0], params={}))

        warnings = state.resize_qubits(1)

        self.assertEqual(state.logical_qubits, 1)
        self.assertEqual(state.initial_states, ["0"])
        self.assertEqual(len(state.columns), 1)
        self.assertEqual(state.columns[0].gates[0].type, "H")
        self.assertGreaterEqual(len(warnings), 2)

    def test_to_config_after_resize_round_trips(self) -> None:
        state = CircuitState(logical_qubits=2, initial_states=["0", "1"], columns=[])
        state.resize_qubits(1)

        restored = CircuitState.from_config(state.to_config())

        self.assertEqual(restored.to_config().to_dict(), state.to_config().to_dict())


if __name__ == "__main__":
    unittest.main()
