import unittest

from core.circuit_history import CircuitHistory
from core.circuit_model import GateOperation
from core.circuit_state import CircuitState


class CircuitHistoryTest(unittest.TestCase):
    def test_add_gate_can_undo_and_redo(self) -> None:
        history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        )

        history.add_gate(0, _gate("H", 0))

        self.assertTrue(history.can_undo())
        self.assertEqual(history.current.columns[0].gates[0].type, "H")

        self.assertTrue(history.undo())
        self.assertEqual(history.current.columns, [])
        self.assertTrue(history.can_redo())

        self.assertTrue(history.redo())
        self.assertEqual(history.current.columns[0].gates[0].type, "H")

    def test_remove_gate_can_be_undone(self) -> None:
        history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        )
        history.add_gate(0, _gate("H", 0))
        history.remove_gate(0, 0)

        self.assertEqual(history.current.columns, [])

        history.undo()

        self.assertEqual(history.current.columns[0].gates[0].type, "H")

    def test_clear_circuit_can_be_undone(self) -> None:
        history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        )
        history.add_gate(0, _gate("H", 0))
        history.clear_circuit()

        self.assertEqual(history.current.columns, [])

        history.undo()

        self.assertEqual(history.current.columns[0].gates[0].type, "H")

    def test_new_operation_after_undo_clears_redo_stack(self) -> None:
        history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        )
        history.add_gate(0, _gate("H", 0))
        history.undo()

        self.assertTrue(history.can_redo())

        history.add_gate(1, _gate("X", 0))

        self.assertFalse(history.can_redo())
        self.assertEqual(history.current.columns[0].step, 1)
        self.assertEqual(history.current.columns[0].gates[0].type, "X")

    def test_history_limit_is_enforced(self) -> None:
        history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[]),
            history_limit=3,
        )

        for step in range(5):
            history.add_gate(step, _gate("H", 0))

        self.assertEqual(len(history.undo_stack), 3)


def _gate(gate_type: str, target: int) -> GateOperation:
    return GateOperation(
        type=gate_type,
        targets=[target],
        controls=[],
        params={},
    )


if __name__ == "__main__":
    unittest.main()
