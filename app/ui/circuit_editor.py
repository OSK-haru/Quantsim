from __future__ import annotations

import streamlit as st

from core.circuit_history import CircuitHistory
from core.circuit_model import GateOperation


def render_circuit_editor(history: CircuitHistory, selected_gate: str) -> None:
    st.subheader("Circuit Editor")
    st.caption("Phase 4 uses simple controls here. Drag and drop comes later.")

    max_step = max([column.step for column in history.current.columns] + [0, 3])
    step = st.number_input(
        "Step",
        min_value=0,
        max_value=20,
        value=min(int(st.session_state.get("editor_step", 0)), 20),
        step=1,
        key="editor_step",
    )
    target = st.selectbox(
        "Target",
        options=list(range(history.current.logical_qubits)),
        format_func=lambda index: f"q{index}",
        key="editor_target",
    )

    first, second, third, fourth, fifth = st.columns(5)
    if first.button("Add Gate", use_container_width=True):
        _run_edit(lambda: history.add_gate(step, _gate(selected_gate, target)))
    if second.button("Remove Gate", use_container_width=True):
        _run_edit(lambda: history.remove_gate(step, target))
    if third.button("Undo", disabled=not history.can_undo(), use_container_width=True):
        history.undo()
    if fourth.button("Redo", disabled=not history.can_redo(), use_container_width=True):
        history.redo()
    if fifth.button("Clear", use_container_width=True):
        _run_edit(history.clear_circuit)

    _render_grid(history, max_step=max(max_step, int(step)))


def _render_grid(history: CircuitHistory, max_step: int) -> None:
    steps = list(range(max_step + 1))
    rows: list[dict[str, str]] = []

    for qubit in range(history.current.logical_qubits):
        row = {"qubit": f"q{qubit}"}
        for step in steps:
            row[f"step {step}"] = _gate_label_at(history, step, qubit)
        rows.append(row)

    st.dataframe(rows, hide_index=True, use_container_width=True)


def _gate_label_at(history: CircuitHistory, step: int, qubit: int) -> str:
    for column in history.current.columns:
        if column.step != step:
            continue
        for gate in column.gates:
            if qubit in gate.targets:
                return gate.type
            if qubit in (gate.controls or []):
                return f"{gate.type} control"
    return ""


def _gate(gate_type: str, target: int) -> GateOperation:
    return GateOperation(
        type=gate_type,
        targets=[target],
        controls=[],
        params={},
    )


def _run_edit(edit) -> None:
    try:
        edit()
        st.session_state.edit_error = ""
    except ValueError as exc:
        st.session_state.edit_error = str(exc)

    if st.session_state.get("edit_error"):
        st.warning(st.session_state.edit_error)
