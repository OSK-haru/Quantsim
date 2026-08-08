"""Gate-aware logical-to-native circuit compilation."""

from __future__ import annotations

from dataclasses import dataclass
import math

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.gates import (
    DEFAULT_GATE_DURATIONS_US,
    column_duration_us,
    oracle_marked_index,
    oracle_register,
    qft_register,
)


LOGICAL_DIRECT = "logical_direct"
AUTO_DECOMPOSE = "auto_decompose"
SUPPORTED_COMPILATION_MODES = frozenset({LOGICAL_DIRECT, AUTO_DECOMPOSE})
NATIVE_GATE_SET_ID = "gate_aware_hxyzst_rz_cnot_v3"
CZ_DECOMPOSITION_ID = "cz_to_h_cnot_h_v1"
SWAP_DECOMPOSITION_ID = "swap_to_three_cnot_v1"
CP_DECOMPOSITION_ID = "cp_to_rz_cnot_v1"
CCX_DECOMPOSITION_ID = "ccx_to_h_cnot_rz_v1"
RX_DECOMPOSITION_ID = "rx_to_h_rz_h_v1"
RY_DECOMPOSITION_ID = "ry_to_rz_h_rz_h_rz_v1"
QFT_DECOMPOSITION_ID = "qft_to_h_cp_swap_v1"
ORACLE_DECOMPOSITION_ID = "oracle_to_x_mcz_graycode_v1"
DECOMPOSABLE_GATES = frozenset({
    "RX", "RY", "CZ", "SWAP", "CP", "CCX", "QFT", "ORACLE",
})
DecompositionLayers = tuple[tuple[GateOperation, ...], ...]


@dataclass(frozen=True)
class GateCompilationResult:
    circuit: CircuitConfig
    diagnostics: dict[str, object]


def compile_gate_aware_circuit(
    circuit: CircuitConfig,
    mode: str,
    native_gate_durations_us: dict[str, float] | None = None,
) -> GateCompilationResult:
    """Compile advanced gates while retaining an auditable source map."""

    if mode not in SUPPORTED_COMPILATION_MODES:
        raise ValueError(
            f"compilation mode must be one of {sorted(SUPPORTED_COMPILATION_MODES)}"
        )
    durations = dict(DEFAULT_GATE_DURATIONS_US)
    durations.update(native_gate_durations_us or {})
    logical_columns = sorted(circuit.columns, key=lambda column: column.step)
    source_map: list[dict[str, object]] = []
    compiled_columns: list[GateColumn] = []
    rules_used: set[str] = set()

    for logical_index, column in enumerate(logical_columns):
        advanced_gates = [
            gate for gate in column.gates
            if gate.type.upper() in DECOMPOSABLE_GATES
        ]
        if mode == LOGICAL_DIRECT or not advanced_gates:
            compiled_step = len(compiled_columns)
            compiled_columns.append(_copy_column(column, compiled_step))
            for gate_index, gate in enumerate(column.gates):
                source_map.append(_source_entry(
                    logical_index,
                    gate_index,
                    gate,
                    ((compiled_step, _copy_gate(gate)),),
                    None,
                ))
            continue

        other_gates = [
            gate for gate in column.gates
            if gate.type.upper() not in DECOMPOSABLE_GATES
        ]
        first_step = len(compiled_columns)
        layers: list[list[GateOperation]] = [
            [_copy_gate(gate) for gate in other_gates]
        ]
        decomposition_by_gate_index: dict[
            int,
            tuple[str, DecompositionLayers],
        ] = {}
        for gate_index, gate in enumerate(column.gates):
            if gate.type.upper() not in DECOMPOSABLE_GATES:
                continue
            gate_layers, rule_id = _decompose_gate(gate, durations)
            rules_used.add(rule_id)
            while len(layers) < len(gate_layers):
                layers.append([])
            for layer_index, layer_operations in enumerate(gate_layers):
                layers[layer_index].extend(layer_operations)
            decomposition_by_gate_index[gate_index] = (
                rule_id,
                gate_layers,
            )

        compiled_columns.extend(
            GateColumn(first_step + offset, layer)
            for offset, layer in enumerate(layers)
        )
        for gate_index, gate in enumerate(column.gates):
            decomposition = decomposition_by_gate_index.get(gate_index)
            if decomposition is not None:
                rule_id, gate_layers = decomposition
                source_map.append(_source_entry(
                    logical_index,
                    gate_index,
                    gate,
                    tuple(
                        (first_step + offset, operation)
                        for offset, layer_operations in enumerate(gate_layers)
                        for operation in layer_operations
                    ),
                    rule_id,
                ))
            else:
                source_map.append(_source_entry(
                    logical_index,
                    gate_index,
                    gate,
                    ((first_step, _copy_gate(gate)),),
                    None,
                ))

    compiled = CircuitConfig(
        logical_qubits=circuit.logical_qubits,
        initial_states=list(circuit.initial_states),
        columns=compiled_columns,
    )
    logical_gate_count = sum(len(column.gates) for column in logical_columns)
    compiled_gate_count = sum(len(column.gates) for column in compiled_columns)
    diagnostics = {
        "compilation_mode": mode,
        "native_gate_set_id": NATIVE_GATE_SET_ID,
        "logical_gate_count": logical_gate_count,
        "compiled_gate_count": compiled_gate_count,
        "expanded_gate_count": compiled_gate_count - logical_gate_count,
        "logical_depth": len(logical_columns),
        "compiled_depth": len(compiled_columns),
        "logical_declared_duration_us": sum(
            column_duration_us(column) for column in logical_columns
        ),
        "compiled_duration_us": sum(
            column_duration_us(column) for column in compiled_columns
        ),
        "decomposition_rules_used": sorted(rules_used),
        "source_map": source_map,
        "compiled_circuit": compiled.to_dict(),
    }
    return GateCompilationResult(compiled, diagnostics)


def _copy_gate(gate: GateOperation) -> GateOperation:
    return GateOperation(
        gate.type,
        list(gate.targets),
        controls=list(gate.controls or []),
        params=dict(gate.params or {}),
    )


def _copy_column(column: GateColumn, step: int) -> GateColumn:
    return GateColumn(step, [_copy_gate(gate) for gate in column.gates])


def _controlled_qubits(gate: GateOperation, label: str) -> tuple[int, int]:
    if len(gate.controls or []) != 1 or len(gate.targets) != 1:
        raise ValueError(f"{label} requires exactly one control and one target")
    control, target = gate.controls[0], gate.targets[0]
    if control == target:
        raise ValueError(f"{label} control and target must differ")
    return control, target


def _pair_targets(gate: GateOperation, label: str) -> tuple[int, int]:
    if gate.controls or len(gate.targets) != 2:
        raise ValueError(f"{label} requires exactly two targets and no controls")
    first, second = gate.targets
    if first == second:
        raise ValueError(f"{label} targets must differ")
    return first, second


def _ccx_qubits(gate: GateOperation) -> tuple[int, int, int]:
    if len(gate.controls or []) != 2 or len(gate.targets) != 1:
        raise ValueError("CCX requires exactly two controls and one target")
    control_a, control_b = gate.controls
    target = gate.targets[0]
    if len({control_a, control_b, target}) != 3:
        raise ValueError("CCX controls and target must differ")
    return control_a, control_b, target


def _decompose_gate(
    gate: GateOperation,
    durations: dict[str, float],
) -> tuple[DecompositionLayers, str]:
    gate_type = gate.type.upper()
    if gate_type == "RX":
        target = _single_target(gate, "RX")
        theta = _finite_gate_angle(gate, "RX")
        h_duration = durations["H"]
        rz_duration = durations["RZ"]
        return ((
            GateOperation("H", [target], params={"duration_us": h_duration}),
        ), (
            GateOperation(
                "RZ", [target],
                params={"duration_us": rz_duration, "theta_rad": theta},
            ),
        ), (
            GateOperation("H", [target], params={"duration_us": h_duration}),
        )), RX_DECOMPOSITION_ID
    if gate_type == "RY":
        target = _single_target(gate, "RY")
        theta = _finite_gate_angle(gate, "RY")
        h_duration = durations["H"]
        rz_duration = durations["RZ"]

        def rz(angle: float) -> GateOperation:
            return GateOperation(
                "RZ", [target],
                params={"duration_us": rz_duration, "theta_rad": angle},
            )

        return (
            (rz(-math.pi / 2.0),),
            (GateOperation("H", [target], params={"duration_us": h_duration}),),
            (rz(theta),),
            (GateOperation("H", [target], params={"duration_us": h_duration}),),
            (rz(math.pi / 2.0),),
        ), RY_DECOMPOSITION_ID
    if gate_type == "CZ":
        control, target = _controlled_qubits(gate, "CZ")
        return ((
            GateOperation("H", [target], params={"duration_us": durations["H"]}),
        ), (
            GateOperation(
                "CNOT", [target], controls=[control],
                params={"duration_us": durations["CNOT"]},
            ),
        ), (
            GateOperation("H", [target], params={"duration_us": durations["H"]}),
        )), CZ_DECOMPOSITION_ID
    if gate_type == "SWAP":
        first, second = _pair_targets(gate, "SWAP")
        return ((
            GateOperation(
                "CNOT", [second], controls=[first],
                params={"duration_us": durations["CNOT"]},
            ),
        ), (
            GateOperation(
                "CNOT", [first], controls=[second],
                params={"duration_us": durations["CNOT"]},
            ),
        ), (
            GateOperation(
                "CNOT", [second], controls=[first],
                params={"duration_us": durations["CNOT"]},
            ),
        )), SWAP_DECOMPOSITION_ID
    if gate_type == "CP":
        control, target = _controlled_qubits(gate, "CP")
        theta = float((gate.params or {}).get("theta_rad", math.pi / 2.0))
        if not math.isfinite(theta):
            raise ValueError("CP theta_rad must be finite")
        half_theta = theta / 2.0
        rz_duration = durations["RZ"]
        cnot_duration = durations["CNOT"]
        return ((
            GateOperation(
                "RZ", [control],
                params={"duration_us": rz_duration, "theta_rad": half_theta},
            ),
            GateOperation(
                "RZ", [target],
                params={"duration_us": rz_duration, "theta_rad": half_theta},
            ),
        ), (
            GateOperation(
                "CNOT", [target], controls=[control],
                params={"duration_us": cnot_duration},
            ),
        ), (
            GateOperation(
                "RZ", [target],
                params={"duration_us": rz_duration, "theta_rad": -half_theta},
            ),
        ), (
            GateOperation(
                "CNOT", [target], controls=[control],
                params={"duration_us": cnot_duration},
            ),
        )), CP_DECOMPOSITION_ID
    if gate_type == "CCX":
        control_a, control_b, target = _ccx_qubits(gate)
        h_duration = durations["H"]
        rz_duration = durations["RZ"]
        cnot_duration = durations["CNOT"]

        def h(qubit: int) -> GateOperation:
            return GateOperation("H", [qubit], params={"duration_us": h_duration})

        def rz(qubit: int, theta: float) -> GateOperation:
            return GateOperation(
                "RZ", [qubit],
                params={"duration_us": rz_duration, "theta_rad": theta},
            )

        def cnot(control: int, cnot_target: int) -> GateOperation:
            return GateOperation(
                "CNOT", [cnot_target], controls=[control],
                params={"duration_us": cnot_duration},
            )

        quarter_turn = math.pi / 4.0
        return (
            (h(target),),
            (cnot(control_b, target),),
            (rz(target, -quarter_turn),),
            (cnot(control_a, target),),
            (rz(target, quarter_turn),),
            (cnot(control_b, target),),
            (rz(target, -quarter_turn),),
            (cnot(control_a, target),),
            (rz(control_b, quarter_turn), rz(target, quarter_turn)),
            (h(target),),
            (cnot(control_a, control_b),),
            (rz(control_a, quarter_turn), rz(control_b, -quarter_turn)),
            (cnot(control_a, control_b),),
        ), CCX_DECOMPOSITION_ID
    if gate_type == "QFT":
        if gate.controls:
            raise ValueError("QFT requires targets only and no controls")
        register = qft_register(gate.targets)
        return _expand_logical_layers(
            _qft_logical_layers(register, durations),
            durations,
        ), QFT_DECOMPOSITION_ID
    if gate_type == "ORACLE":
        if gate.controls:
            raise ValueError("ORACLE requires targets only and no controls")
        register = oracle_register(gate.targets)
        marked = oracle_marked_index(gate.params, len(register))
        return _oracle_layers(register, marked, durations), ORACLE_DECOMPOSITION_ID
    raise ValueError(f"no decomposition rule is registered for {gate.type!r}")


def _oracle_layers(
    register: tuple[int, ...],
    marked_index: int,
    durations: dict[str, float],
) -> DecompositionLayers:
    """Conjugate a multi-controlled Z with X on the marked value's zero bits.

    ``MCZ`` flips the sign of ``|1...1>``; the X pairs move that sign onto
    ``|marked_index>``.
    """

    size = len(register)
    marked_bits = format(int(marked_index), f"0{size}b")
    zero_bits = tuple(
        qubit for position, qubit in enumerate(register)
        if marked_bits[position] == "0"
    )
    flip = tuple(
        GateOperation("X", [qubit], params={"duration_us": durations["X"]})
        for qubit in zero_bits
    )
    layers: list[tuple[GateOperation, ...]] = []
    if flip:
        layers.append(flip)
    layers.extend(_multi_controlled_z_layers(register, durations))
    if flip:
        layers.append(flip)
    return tuple(layers)


def _multi_controlled_z_layers(
    register: tuple[int, ...],
    durations: dict[str, float],
) -> DecompositionLayers:
    """Return C^(m-1)Z on ``register`` as native CNOT and RZ layers.

    Writes the diagonal phase ``pi * prod_j b_j`` in the Pauli-Z basis. With
    ``z_j = (-1)^b_j`` we have
    ``prod_j b_j = 2^-m * sum_S (-1)^|S| prod_{j in S} z_j``,
    so the gate is a product of RZ rotations on subset parities. Subsets are
    walked in Gray-code order, which keeps each step to one CNOT instead of
    rebuilding a parity ladder per subset: 2^m - 1 CNOTs rather than O(m 2^m).
    The empty subset contributes only a global phase and is dropped, exactly as
    the CP and CCX rules already do.
    """

    size = len(register)
    scale = 2.0 * math.pi / float(2 ** size)
    rz_duration = durations["RZ"]
    cnot_duration = durations["CNOT"]
    layers: list[tuple[GateOperation, ...]] = []

    def cnot(control: int, target: int) -> tuple[GateOperation, ...]:
        return (GateOperation(
            "CNOT", [target], controls=[control],
            params={"duration_us": cnot_duration},
        ),)

    def rz(qubit: int, subset_size: int) -> tuple[GateOperation, ...]:
        # theta_S = 2 pi (-1)^(|S|+1) / 2^m
        angle = scale * (-1.0 if subset_size % 2 == 0 else 1.0)
        return (GateOperation(
            "RZ", [qubit],
            params={"duration_us": rz_duration, "theta_rad": angle},
        ),)

    def sweep(qubits: tuple[int, ...]) -> None:
        # Handles every subset containing `accumulator`, then recurses on the
        # rest, so each non-empty subset is visited exactly once.
        if not qubits:
            return
        accumulator = qubits[-1]
        others = qubits[:-1]
        active: frozenset[int] = frozenset()
        for code in range(2 ** len(others)):
            gray = code ^ (code >> 1)
            wanted = frozenset(
                others[bit] for bit in range(len(others)) if (gray >> bit) & 1
            )
            for qubit in sorted(wanted ^ active):
                layers.append(cnot(qubit, accumulator))
            active = wanted
            layers.append(rz(accumulator, len(active) + 1))
        for qubit in sorted(active):
            layers.append(cnot(qubit, accumulator))
        sweep(others)

    sweep(tuple(register))
    return tuple(layers)


def _qft_logical_layers(
    register: tuple[int, ...],
    durations: dict[str, float],
) -> DecompositionLayers:
    """Return the textbook H / CP ladder followed by the bit-reversal SWAPs."""

    size = len(register)
    layers: list[tuple[GateOperation, ...]] = []
    for position, target in enumerate(register):
        layers.append((
            GateOperation("H", [target], params={"duration_us": durations["H"]}),
        ))
        for offset in range(1, size - position):
            layers.append((
                GateOperation(
                    "CP", [target], controls=[register[position + offset]],
                    params={
                        "duration_us": durations["CP"],
                        "theta_rad": math.pi / float(2 ** offset),
                    },
                ),
            ))
    reversal = tuple(
        GateOperation(
            "SWAP",
            [register[index], register[size - 1 - index]],
            params={"duration_us": durations["SWAP"]},
        )
        for index in range(size // 2)
    )
    if reversal:
        layers.append(reversal)
    return tuple(layers)


def _expand_logical_layers(
    logical_layers: DecompositionLayers,
    durations: dict[str, float],
) -> DecompositionLayers:
    """Flatten layers of logical sub-gates into native-gate layers."""

    native: list[list[GateOperation]] = []
    for logical_layer in logical_layers:
        merged: list[list[GateOperation]] = []
        for sub_gate in logical_layer:
            for index, operations in enumerate(_native_layers(sub_gate, durations)):
                while len(merged) <= index:
                    merged.append([])
                merged[index].extend(operations)
        native.extend(merged)
    return tuple(tuple(layer) for layer in native)


def _native_layers(
    gate: GateOperation,
    durations: dict[str, float],
) -> DecompositionLayers:
    if gate.type.upper() in DECOMPOSABLE_GATES:
        return _decompose_gate(gate, durations)[0]
    return ((_copy_gate(gate),),)


def _single_target(gate: GateOperation, label: str) -> int:
    if gate.controls or len(gate.targets) != 1:
        raise ValueError(f"{label} requires exactly one target and no controls")
    return gate.targets[0]


def _finite_gate_angle(gate: GateOperation, label: str) -> float:
    theta = float((gate.params or {}).get("theta_rad", math.pi / 2.0))
    if not math.isfinite(theta):
        raise ValueError(f"{label} theta_rad must be finite")
    return theta


def _source_entry(
    logical_column: int,
    logical_gate_index: int,
    gate: GateOperation,
    compiled_operations: tuple[tuple[int, GateOperation], ...],
    rule_id: str | None,
) -> dict[str, object]:
    return {
        "logical_column": logical_column,
        "logical_gate_index": logical_gate_index,
        "source_gate": gate.type.upper(),
        "targets": list(gate.targets),
        "controls": list(gate.controls or []),
        "rule_id": rule_id,
        "compiled_operations": [
            {
                "compiled_column": step,
                "gate": operation.type.upper(),
                "targets": list(operation.targets),
                "controls": list(operation.controls or []),
                "params": dict(operation.params or {}),
            }
            for step, operation in compiled_operations
        ],
    }
