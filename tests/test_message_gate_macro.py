import numpy as np

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.gates import gate_unitary, message_matrix, rx_matrix, ry_matrix


def test_message_macro_has_verified_order_and_shared_parameter_mapping() -> None:
    t = 0.37
    expected = np.asarray(rx_matrix(np.pi * t)) @ np.asarray(ry_matrix(2.0 * t))
    actual = np.asarray(message_matrix(t))
    np.testing.assert_allclose(actual, expected, atol=1e-12)


def test_message_gate_serializes_animation_parameter() -> None:
    config = CircuitConfig(
        logical_qubits=1,
        initial_states=["0"],
        columns=[GateColumn(0, [GateOperation("MESSAGE", [0], params={
            "duration_us": 0.04,
            "animation_parameter_t": 0.25,
        })])],
    )
    restored = CircuitConfig.from_dict(config.to_dict())
    gate = restored.columns[0].gates[0]
    assert gate.type == "MESSAGE"
    assert gate.params["animation_parameter_t"] == 0.25


def test_message_gate_is_a_single_unitary_operation_with_no_weight_duration() -> None:
    gate = GateOperation("MESSAGE", [0], params={"animation_parameter_t": 0.5})
    unitary = np.asarray(gate_unitary(gate, 1))
    np.testing.assert_allclose(unitary.conj().T @ unitary, np.eye(2), atol=1e-12)
