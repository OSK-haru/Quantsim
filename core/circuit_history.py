"""Snapshot-based undo/redo for editable circuit state."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from core.circuit_model import GateOperation
from core.circuit_state import CircuitState


@dataclass
class CircuitHistory:
    """Wrap CircuitState mutations with bounded undo/redo stacks."""

    current: CircuitState = field(default_factory=CircuitState)
    undo_stack: list[CircuitState] = field(default_factory=list)
    redo_stack: list[CircuitState] = field(default_factory=list)
    history_limit: int = 50

    def __post_init__(self) -> None:
        self.history_limit = int(self.history_limit)
        if self.history_limit < 1:
            raise ValueError("history_limit must be at least 1")
        self.current = self.current.copy()
        self.undo_stack = [state.copy() for state in self.undo_stack]
        self.redo_stack = [state.copy() for state in self.redo_stack]
        self._trim_undo_stack()

    def add_gate(self, step: int, gate: GateOperation) -> None:
        self._apply(lambda: self.current.add_gate(step, gate))

    def remove_gate(self, step: int, target: int) -> None:
        self._apply(lambda: self.current.remove_gate(step, target))

    def replace_gate(self, step: int, gate: GateOperation) -> None:
        self._apply(lambda: self.current.replace_gate(step, gate))

    def move_gate(
        self,
        from_step: int,
        from_target: int,
        to_step: int,
        to_target: int,
    ) -> None:
        self._apply(
            lambda: self.current.move_gate(
                from_step,
                from_target,
                to_step,
                to_target,
            )
        )

    def clear_circuit(self) -> None:
        self._apply(self.current.clear)

    def undo(self) -> bool:
        if not self.can_undo():
            return False

        self.redo_stack.append(self.current.copy())
        self.current = self.undo_stack.pop()
        return True

    def redo(self) -> bool:
        if not self.can_redo():
            return False

        self.undo_stack.append(self.current.copy())
        self._trim_undo_stack()
        self.current = self.redo_stack.pop()
        return True

    def can_undo(self) -> bool:
        return bool(self.undo_stack)

    def can_redo(self) -> bool:
        return bool(self.redo_stack)

    def _apply(self, mutate: Callable[[], None]) -> None:
        before = self.current.copy()
        mutate()
        self.undo_stack.append(before)
        self._trim_undo_stack()
        self.redo_stack = []

    def _trim_undo_stack(self) -> None:
        overflow = len(self.undo_stack) - self.history_limit
        if overflow > 0:
            del self.undo_stack[:overflow]
