from __future__ import annotations

import streamlit as st


BEGINNER_GATES = ["I", "H", "X", "Z", "Measure"]


def render_gate_palette() -> str:
    st.subheader("Gate Palette")
    selected_gate = st.selectbox(
        "Gate",
        BEGINNER_GATES,
        index=BEGINNER_GATES.index(st.session_state.get("selected_gate", "H")),
        key="selected_gate",
    )
    st.caption("CNOT appears after the 2-qubit editor is ready.")
    return selected_gate
