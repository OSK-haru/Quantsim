from __future__ import annotations

import streamlit as st

from core.circuit_history import CircuitHistory
from core.circuit_model import GateColumn, GateOperation
from core.circuit_state import CircuitState


def render_circuit_editor(history: CircuitHistory, selected_gate: str) -> None:
    st.subheader("Circuit Editor")
    st.caption("Select a gate, choose where it lands, then place or replace it.")

    logical_qubits = st.radio(
        "Logical qubits",
        options=[1, 2],
        index=0 if history.current.logical_qubits == 1 else 1,
        horizontal=True,
        key="editor_logical_qubits",
    )
    if logical_qubits != history.current.logical_qubits:
        _resize_circuit(history, logical_qubits)
        st.session_state.last_result = None
        st.session_state.last_comparison = None
        st.rerun()

    max_step = max([column.step for column in history.current.columns] + [0, 3])

    preset_column, spacer = st.columns([1, 2])
    if preset_column.button(
        "Bell Preset",
        disabled=history.current.logical_qubits < 2,
        use_container_width=True,
    ):
        _run_edit(lambda: _load_bell_preset(history))
    spacer.caption("Bell preset: H on q0, then CNOT q0 -> q1.")

    step_column, target_column, control_column = st.columns(3)
    with step_column:
        step = st.number_input(
            "Step",
            min_value=0,
            max_value=20,
            value=min(int(st.session_state.get("editor_step", 0)), 20),
            step=1,
            key="editor_step",
        )
    with target_column:
        target = st.selectbox(
            "Target",
            options=list(range(history.current.logical_qubits)),
            format_func=lambda index: f"q{index}",
            key="editor_target",
        )
    with control_column:
        control_options = list(range(history.current.logical_qubits))
        control = st.selectbox(
            "Control",
            options=control_options,
            format_func=lambda index: f"q{index}",
            key="editor_control",
            disabled=selected_gate != "CNOT",
        )

    first, second, third, fourth, fifth, sixth = st.columns(6)
    if first.button("Add", use_container_width=True):
        _run_edit(lambda: history.add_gate(step, _gate(selected_gate, target, control)))
    if second.button("Replace", use_container_width=True):
        _run_edit(lambda: history.replace_gate(step, _gate(selected_gate, target, control)))
    if third.button("Remove", use_container_width=True):
        _run_edit(lambda: history.remove_gate(step, target))
    if fourth.button("Undo", disabled=not history.can_undo(), use_container_width=True):
        history.undo()
    if fifth.button("Redo", disabled=not history.can_redo(), use_container_width=True):
        history.redo()
    if sixth.button("Clear", use_container_width=True):
        _run_edit(history.clear_circuit)

    _render_circuit_lines(history, max_step=max(max_step, int(step)))


def _render_circuit_lines(history: CircuitHistory, max_step: int) -> None:
    steps = list(range(max_step + 1))
    st.markdown(_circuit_css(), unsafe_allow_html=True)
    step_labels = "".join(
        f'<div class="circuit-step-label">t{step}</div>'
        for step in steps
    )
    st.markdown(
        f'<div class="circuit-row circuit-header"><div></div>{step_labels}</div>',
        unsafe_allow_html=True,
    )

    for qubit in range(history.current.logical_qubits):
        cells = []
        for step in steps:
            cells.append(
                '<div class="circuit-cell">'
                f'{_gate_card_at(history, step, qubit)}'
                '</div>'
            )
        st.markdown(
            (
                '<div class="circuit-row">'
                f'<div class="qubit-label">q{qubit}</div>'
                f'{"".join(cells)}'
                '</div>'
            ),
            unsafe_allow_html=True,
        )


def _gate_card_at(history: CircuitHistory, step: int, qubit: int) -> str:
    for column in history.current.columns:
        if column.step != step:
            continue
        for gate in column.gates:
            if qubit in gate.targets:
                return f'<span class="gate-card">{_gate_label(gate, qubit)}</span>'
            if qubit in (gate.controls or []):
                return '<span class="gate-card gate-control">C</span>'
    return '<span class="wire"></span>'


def _gate_label(gate: GateOperation, qubit: int) -> str:
    if gate.type == "Measure":
        return "M"
    if gate.type == "CNOT":
        control = gate.controls[0] if gate.controls else "?"
        target = gate.targets[0] if gate.targets else qubit
        return f"X<br><small>CNOT({control}->{target})</small>"
    return gate.type


def _circuit_css() -> str:
    return """
    <style>
    .circuit-row {
        display: grid;
        grid-template-columns: 3rem repeat(21, minmax(2.75rem, 1fr));
        gap: 0.35rem;
        align-items: center;
        margin: 0.35rem 0;
        overflow-x: auto;
    }
    .circuit-header {
        color: #57606a;
        font-size: 0.78rem;
    }
    .qubit-label {
        font-weight: 700;
        color: #24292f;
    }
    .circuit-step-label {
        text-align: center;
    }
    .circuit-cell {
        min-height: 2.5rem;
        border-bottom: 2px solid #8c959f;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .wire {
        width: 100%;
        height: 1px;
    }
    .gate-card {
        min-width: 2.2rem;
        min-height: 2rem;
        padding: 0.2rem 0.35rem;
        border: 1px solid #57606a;
        border-radius: 0.35rem;
        background: #ffffff;
        color: #24292f;
        font-weight: 700;
        line-height: 1.0;
        text-align: center;
        box-shadow: 0 1px 2px rgba(31, 35, 40, 0.08);
    }
    .gate-card small {
        display: block;
        font-size: 0.58rem;
        font-weight: 500;
        margin-top: 0.15rem;
        white-space: nowrap;
    }
    .gate-control {
        border-radius: 50%;
        min-width: 1.9rem;
        min-height: 1.9rem;
        padding: 0.2rem;
        background: #24292f;
        color: #ffffff;
    }
    </style>
    """


def _resize_circuit(history: CircuitHistory, logical_qubits: int) -> None:
    logical_qubits = int(logical_qubits)
    columns = [
        GateColumn.from_dict(column.to_dict())
        for column in history.current.columns
        if _column_fits(column, logical_qubits)
    ]
    history.current = CircuitState(
        logical_qubits=logical_qubits,
        initial_states=["0"] * logical_qubits,
        columns=columns,
    )
    history.undo_stack = []
    history.redo_stack = []


def _column_fits(column: GateColumn, logical_qubits: int) -> bool:
    for gate in column.gates:
        used_qubits = set(gate.targets).union(gate.controls or [])
        if any(qubit >= logical_qubits for qubit in used_qubits):
            return False
    return True


def _load_bell_preset(history: CircuitHistory) -> None:
    def mutate() -> None:
        history.current.clear()
        history.current.logical_qubits = 2
        history.current.initial_states = ["0", "0"]
        history.current.add_gate(0, _gate("H", 0, 0))
        history.current.add_gate(1, _gate("CNOT", 1, 0))

    history._apply(mutate)


def _gate(gate_type: str, target: int, control: int | None = None) -> GateOperation:
    controls: list[int] = []
    if gate_type == "CNOT":
        controls = [int(control if control is not None else 0)]
    return GateOperation(
        type=gate_type,
        targets=[target],
        controls=controls,
        params={},
    )


def _run_edit(edit) -> None:
    try:
        edit()
        st.session_state.edit_error = ""
        st.session_state.last_result = None
        st.session_state.last_comparison = None
    except ValueError as exc:
        st.session_state.edit_error = str(exc)

    if st.session_state.get("edit_error"):
        st.warning(st.session_state.edit_error)
