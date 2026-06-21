from __future__ import annotations

import streamlit as st

from core.circuit_history import CircuitHistory
from core.circuit_model import GateOperation
from core.gates import DEFAULT_GATE_DURATIONS_US
from ui.session_sync import clear_stale_results, resize_logical_qubits, sync_from_history


def render_circuit_editor(history: CircuitHistory, selected_gate: str) -> None:
    st.subheader("Circuit Editor")
    st.caption("Select a gate, choose where it lands, then place or replace it.")

    logical_qubits = st.radio(
        "Logical qubits",
        options=[1, 2],
        index=0 if history.current.logical_qubits == 1 else 1,
        horizontal=True,
        key="logical_qubits",
    )
    if logical_qubits != history.current.logical_qubits:
        resize_logical_qubits(logical_qubits)
        st.rerun()

    for warning in st.session_state.pop("resize_warnings", []):
        st.warning(warning)

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

    default_duration = _default_duration_us(selected_gate)
    duration_columns = st.columns([1, 2])
    with duration_columns[0]:
        use_custom_duration = st.checkbox(
            "Custom duration",
            value=bool(st.session_state.get("editor_use_custom_duration", False)),
            key="editor_use_custom_duration",
        )
    with duration_columns[1]:
        duration_us = st.number_input(
            "Gate duration [us]",
            min_value=0.0,
            value=float(st.session_state.get("editor_gate_duration_us", default_duration)),
            step=0.01,
            format="%.6f",
            key="editor_gate_duration_us",
            disabled=not use_custom_duration,
        )
    st.caption(
        f"Default {selected_gate} duration: {default_duration:g} us. "
        "Custom duration is saved in gate.params['duration_us']."
    )

    first, second, third, fourth, fifth, sixth = st.columns(6)
    if first.button("Add", use_container_width=True):
        _run_edit(lambda: history.add_gate(
            step,
            _gate(
                selected_gate,
                target,
                control,
                duration_us=duration_us if use_custom_duration else None,
            ),
        ))
    if second.button("Replace", use_container_width=True):
        _run_edit(lambda: history.replace_gate(
            step,
            _gate(
                selected_gate,
                target,
                control,
                duration_us=duration_us if use_custom_duration else None,
            ),
        ))
    if third.button("Remove", use_container_width=True):
        _run_edit(lambda: history.remove_gate(step, target))
    if fourth.button("Undo", disabled=not history.can_undo(), use_container_width=True):
        history.undo()
        _after_history_edit(history)
    if fifth.button("Redo", disabled=not history.can_redo(), use_container_width=True):
        history.redo()
        _after_history_edit(history)
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
    duration_label = _duration_label(gate)
    if gate.type == "Measure":
        return f"M{duration_label}"
    if gate.type == "CNOT":
        control = gate.controls[0] if gate.controls else "?"
        target = gate.targets[0] if gate.targets else qubit
        duration_text = _duration_text(gate)
        duration_line = f"<br>{duration_text}" if duration_text else ""
        return f"X<br><small>CNOT({control}->{target}){duration_line}</small>"
    return f"{gate.type}{duration_label}"


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


def _load_bell_preset(history: CircuitHistory) -> None:
    def mutate() -> None:
        history.current.clear()
        history.current.logical_qubits = 2
        history.current.initial_states = ["0", "0"]
        history.current.add_gate(0, _gate("H", 0, 0))
        history.current.add_gate(1, _gate("CNOT", 1, 0))

    history._apply(mutate)


def _gate(
    gate_type: str,
    target: int,
    control: int | None = None,
    duration_us: float | None = None,
) -> GateOperation:
    controls: list[int] = []
    if gate_type == "CNOT":
        controls = [int(control if control is not None else 0)]
    params = {}
    if duration_us is not None:
        params["duration_us"] = float(duration_us)
    return GateOperation(
        type=gate_type,
        targets=[target],
        controls=controls,
        params=params,
    )


def _default_duration_us(gate_type: str) -> float:
    return float(DEFAULT_GATE_DURATIONS_US.get(str(gate_type).upper(), 0.0))


def _duration_label(gate: GateOperation) -> str:
    duration_text = _duration_text(gate)
    if not duration_text:
        return ""
    return f"<br><small>{duration_text}</small>"


def _duration_text(gate: GateOperation) -> str:
    params = gate.params or {}
    if "duration_us" not in params:
        return ""
    return f"{params['duration_us']:g} us"


def _run_edit(edit) -> None:
    try:
        edit()
        st.session_state.edit_error = ""
        _after_history_edit(st.session_state.circuit_history)
    except ValueError as exc:
        st.session_state.edit_error = str(exc)

    if st.session_state.get("edit_error"):
        st.warning(st.session_state.edit_error)


def _after_history_edit(history: CircuitHistory) -> None:
    sync_from_history(history, update_widget_keys=False)
    clear_stale_results()
