import unittest

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.circuit_state import CircuitState
from core.circuit_validation import (
    validate_circuit_state,
    validate_gate_placement,
)


class CircuitStateTest(unittest.TestCase):
    def test_add_remove_replace_move_and_clear_gates(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])

        state.add_gate(0, _gate("H", 0))

        self.assertEqual(state.columns[0].step, 0)
        self.assertEqual(state.columns[0].gates[0].type, "H")

        previous = state.replace_gate(0, _gate("X", 0))

        self.assertEqual(previous.type, "H")
        self.assertEqual(state.columns[0].gates[0].type, "X")

        state.move_gate(from_step=0, from_target=0, to_step=1, to_target=0)

        self.assertEqual(len(state.columns), 1)
        self.assertEqual(state.columns[0].step, 1)
        self.assertEqual(state.columns[0].gates[0].type, "X")

        removed = state.remove_gate(1, 0)

        self.assertEqual(removed.type, "X")
        self.assertEqual(state.columns, [])

        state.add_gate(0, _gate("H", 0))
        state.clear()

        self.assertEqual(state.columns, [])

    def test_to_config_and_from_config_round_trip(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        state.add_gate(0, _gate("H", 0))

        config = state.to_config()
        restored = CircuitState.from_config(config)

        self.assertIsInstance(config, CircuitConfig)
        self.assertEqual(restored.to_config().to_dict(), config.to_dict())

    def test_copy_is_independent(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        state.add_gate(0, _gate("H", 0))

        copied = state.copy()
        copied.replace_gate(0, _gate("X", 0))

        self.assertEqual(state.columns[0].gates[0].type, "H")
        self.assertEqual(copied.columns[0].gates[0].type, "X")

    def test_editor_validation_detects_conflicts_and_cnot_shape(self) -> None:
        state = CircuitState(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(
                            type="H",
                            targets=[0],
                            controls=[],
                            params={},
                        ),
                        GateOperation(
                            type="X",
                            targets=[0],
                            controls=[],
                            params={},
                        ),
                    ],
                )
            ],
        )

        issues = validate_circuit_state(state)
        placement_issues = validate_gate_placement(
            logical_qubits=2,
            columns=[],
            step=0,
            gate=GateOperation(
                type="CNOT",
                targets=[0],
                controls=[0],
                params={},
            ),
        )

        self.assertIssueCode(issues, "CELL_ALREADY_OCCUPIED")
        self.assertIssueCode(placement_issues, "CNOT_CONTROL_EQUALS_TARGET")

    def test_editor_validation_detects_cnot_arity_and_control_range(self) -> None:
        missing_control = validate_gate_placement(
            logical_qubits=2,
            columns=[],
            step=0,
            gate=GateOperation(
                type="CNOT",
                targets=[1],
                controls=[],
                params={},
            ),
        )
        invalid_control = validate_gate_placement(
            logical_qubits=2,
            columns=[],
            step=0,
            gate=GateOperation(
                type="CNOT",
                targets=[1],
                controls=[2],
                params={},
            ),
        )

        self.assertIssueCode(missing_control, "CNOT_REQUIRES_CONTROL")
        self.assertIssueCode(invalid_control, "GATE_CONTROL_OUT_OF_RANGE")

    def test_add_gate_rejects_occupied_cell(self) -> None:
        state = CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        state.add_gate(0, _gate("H", 0))

        with self.assertRaises(ValueError):
            state.add_gate(0, _gate("X", 0))

    def test_two_qubit_cnot_can_convert_to_config(self) -> None:
        state = CircuitState(logical_qubits=2, initial_states=["0", "0"], columns=[])

        state.add_gate(0, _gate("H", 0))
        state.add_gate(
            1,
            GateOperation(
                type="CNOT",
                targets=[1],
                controls=[0],
                params={},
            ),
        )

        config = state.to_config()

        self.assertEqual(config.logical_qubits, 2)
        self.assertEqual(config.initial_states, ["0", "0"])
        self.assertEqual(config.columns[0].gates[0].type, "H")
        self.assertEqual(config.columns[1].gates[0].type, "CNOT")
        self.assertEqual(config.columns[1].gates[0].controls, [0])
        self.assertEqual(config.columns[1].gates[0].targets, [1])

    def test_cnot_control_and_target_must_be_distinct(self) -> None:
        state = CircuitState(logical_qubits=2, initial_states=["0", "0"], columns=[])

        with self.assertRaises(ValueError):
            state.add_gate(
                0,
                GateOperation(
                    type="CNOT",
                    targets=[0],
                    controls=[0],
                    params={},
                ),
            )

    def assertIssueCode(self, issues, code: str) -> None:
        self.assertIn(code, {issue.code for issue in issues})


def _gate(gate_type: str, target: int) -> GateOperation:
    return GateOperation(
        type=gate_type,
        targets=[target],
        controls=[],
        params={},
    )


if __name__ == "__main__":
    unittest.main()
