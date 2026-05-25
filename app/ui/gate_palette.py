from __future__ import annotations

import streamlit as st


ONE_QUBIT_GATES = ["I", "H", "X", "Z", "Measure"]
TWO_QUBIT_GATES = [*ONE_QUBIT_GATES, "CNOT"]


def render_gate_palette(logical_qubits: int = 1) -> str:
    st.subheader("Gate Palette")
    gates = TWO_QUBIT_GATES if logical_qubits >= 2 else ONE_QUBIT_GATES
    if st.session_state.get("selected_gate", "H") not in gates:
        st.session_state.selected_gate = "H"

    selected_gate = st.selectbox(
        "Gate",
        gates,
        index=gates.index(st.session_state.get("selected_gate", "H")),
        key="selected_gate",
    )
    if logical_qubits < 2:
        st.caption("CNOT is available when the circuit uses 2 qubits.")
    else:
        st.caption("Select a gate, choose a step and qubit, then place it.")
    return selected_gate
