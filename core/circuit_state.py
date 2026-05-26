"""Editable circuit state for future UI workflows."""

from __future__ import annotations

from dataclasses import dataclass, field

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.circuit_validation import validate_gate_placement
from core.validation import has_blocking_issues


@dataclass
class CircuitState:
    """Mutable circuit-editing model backed by Phase 1 circuit structures."""

    logical_qubits: int = 1
    initial_states: list[str] = field(default_factory=lambda: ["0"])
    columns: list[GateColumn] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.logical_qubits = int(self.logical_qubits)
        self.initial_states = [str(state) for state in self.initial_states]
        self.columns = [
            column if isinstance(column, GateColumn) else GateColumn.from_dict(column)
            for column in self.columns
        ]
        self._sort_and_prune_columns()

    def add_gate(self, step: int, gate: GateOperation) -> None:
        gate = _copy_gate(gate)
        step = _normalize_step(step)
        self._raise_for_issues(validate_gate_placement(
            self.logical_qubits,
            self.columns,
            step,
            gate,
        ))

        column = self._get_or_create_column(step)
        column.gates.append(gate)
        self._sort_and_prune_columns()

    def remove_gate(self, step: int, target: int) -> GateOperation:
        column = self._require_column(step)
        target = int(target)

        for index, gate in enumerate(column.gates):
            if target in gate.targets:
                removed = column.gates.pop(index)
                self._sort_and_prune_columns()
                return removed

        raise ValueError(f"no gate found at step={step}, target={target}")

    def replace_gate(self, step: int, gate: GateOperation) -> GateOperation:
        step = _normalize_step(step)
        gate = _copy_gate(gate)
        column = self._require_column(step)

        replace_index = _find_gate_index_for_targets(column, gate.targets)
        if replace_index is None:
            raise ValueError(f"no gate found at step={step}, targets={gate.targets}")

        previous = column.gates[replace_index]
        trial_columns = self._copied_columns()
        trial_column = _find_column(trial_columns, step)
        if trial_column is None:
            raise ValueError(f"no column found at step={step}")
        trial_column.gates.pop(replace_index)

        self._raise_for_issues(validate_gate_placement(
            self.logical_qubits,
            trial_columns,
            step,
            gate,
        ))

        column.gates[replace_index] = gate
        self._sort_and_prune_columns()
        return previous

    def move_gate(
        self,
        from_step: int,
        from_target: int,
        to_step: int,
        to_target: int,
    ) -> None:
        from_step = _normalize_step(from_step)
        to_step = _normalize_step(to_step)
        from_target = int(from_target)
        to_target = int(to_target)

        source_column = self._require_column(from_step)
        source_index = _find_gate_index_for_targets(source_column, [from_target])
        if source_index is None:
            raise ValueError(
                f"no gate found at step={from_step}, target={from_target}"
            )

        moved_gate = _copy_gate(source_column.gates[source_index])
        moved_gate.targets = [to_target]

        trial_columns = self._copied_columns()
        trial_source = _find_column(trial_columns, from_step)
        if trial_source is None:
            raise ValueError(f"no column found at step={from_step}")
        trial_source.gates.pop(source_index)
        _prune_columns(trial_columns)

        self._raise_for_issues(validate_gate_placement(
            self.logical_qubits,
            trial_columns,
            to_step,
            moved_gate,
        ))

        source_column.gates.pop(source_index)
        self._sort_and_prune_columns()
        self.add_gate(to_step, moved_gate)

    def clear(self) -> None:
        self.columns = []

    def resize_qubits(self, new_count: int) -> list[str]:
        """Resize the circuit and drop gates that no longer fit."""

        new_count = int(new_count)
        if new_count < 1:
            raise ValueError("new_count must be at least 1")

        warnings: list[str] = []
        previous_count = self.logical_qubits
        self.logical_qubits = new_count

        if len(self.initial_states) < new_count:
            self.initial_states = [
                *self.initial_states,
                *(["0"] * (new_count - len(self.initial_states))),
            ]
        else:
            self.initial_states = self.initial_states[:new_count]

        resized_columns: list[GateColumn] = []
        for column in self.columns:
            kept_gates: list[GateOperation] = []
            for gate in column.gates:
                if _gate_fits(gate, new_count):
                    kept_gates.append(_copy_gate(gate))
                else:
                    warnings.append(
                        (
                            f"Removed {gate.type} at step {column.step} because it "
                            f"uses a qubit outside 0..{new_count - 1}."
                        )
                    )
            if kept_gates:
                resized_columns.append(GateColumn(step=column.step, gates=kept_gates))

        self.columns = resized_columns
        self._sort_and_prune_columns()
        if previous_count != new_count:
            warnings.append(f"Resized circuit from {previous_count} to {new_count} qubit(s).")
        return warnings

    def to_config(self) -> CircuitConfig:
        return CircuitConfig(
            logical_qubits=self.logical_qubits,
            initial_states=list(self.initial_states),
            columns=self._copied_columns(),
        )

    @classmethod
    def from_config(cls, config: CircuitConfig) -> "CircuitState":
        return cls(
            logical_qubits=config.logical_qubits,
            initial_states=list(config.initial_states),
            columns=[
                GateColumn.from_dict(column.to_dict())
                for column in config.columns
            ],
        )

    def copy(self) -> "CircuitState":
        return CircuitState.from_config(self.to_config())

    def _get_or_create_column(self, step: int) -> GateColumn:
        column = _find_column(self.columns, step)
        if column is not None:
            return column

        column = GateColumn(step=step, gates=[])
        self.columns.append(column)
        self.columns.sort(key=lambda existing_column: existing_column.step)
        return column

    def _require_column(self, step: int) -> GateColumn:
        step = _normalize_step(step)
        column = _find_column(self.columns, step)
        if column is None:
            raise ValueError(f"no column found at step={step}")
        return column

    def _copied_columns(self) -> list[GateColumn]:
        return [
            GateColumn.from_dict(column.to_dict())
            for column in self.columns
        ]

    def _sort_and_prune_columns(self) -> None:
        _prune_columns(self.columns)
        self.columns.sort(key=lambda column: column.step)

    @staticmethod
    def _raise_for_issues(issues) -> None:
        if has_blocking_issues(issues):
            details = "; ".join(f"{issue.code}: {issue.message}" for issue in issues)
            raise ValueError(details)


def _copy_gate(gate: GateOperation) -> GateOperation:
    return GateOperation.from_dict(gate.to_dict())


def _normalize_step(step: int) -> int:
    step = int(step)
    if step < 0:
        raise ValueError("step must be non-negative")
    return step


def _find_column(columns: list[GateColumn], step: int) -> GateColumn | None:
    for column in columns:
        if column.step == step:
            return column
    return None


def _find_gate_index_for_targets(
    column: GateColumn,
    targets: list[int],
) -> int | None:
    target_set = set(targets)
    for index, gate in enumerate(column.gates):
        if target_set.intersection(gate.targets):
            return index
    return None


def _prune_columns(columns: list[GateColumn]) -> None:
    columns[:] = [column for column in columns if column.gates]


def _gate_fits(gate: GateOperation, logical_qubits: int) -> bool:
    used_qubits = set(gate.targets).union(gate.controls or [])
    if any(qubit < 0 or qubit >= logical_qubits for qubit in used_qubits):
        return False
    if gate.type.upper() == "CNOT":
        if len(gate.targets) != 1 or len(gate.controls or []) != 1:
            return False
        if gate.targets[0] == gate.controls[0]:
            return False
    return True
