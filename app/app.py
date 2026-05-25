from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ui.beginner_mode import render_beginner_mode
from ui.expert_mode import render_expert_mode
from ui.start_screen import render_start_screen


def main() -> None:
    st.set_page_config(
        page_title="QuantaScope",
        layout="wide",
    )

    _initialize_navigation()

    if st.session_state.app_screen == "beginner":
        render_beginner_mode()
    elif st.session_state.app_screen == "expert":
        render_expert_mode()
    else:
        action = render_start_screen()
        if action == "beginner":
            st.session_state.app_screen = "beginner"
            st.rerun()
        if action == "expert":
            st.session_state.app_screen = "expert"
            st.rerun()
        if action == "demo":
            st.session_state.app_screen = "beginner"
            st.session_state.load_demo_circuit = True
            st.session_state.run_demo_simulation = True
            st.rerun()


def _initialize_navigation() -> None:
    if "app_screen" not in st.session_state:
        st.session_state.app_screen = "start"


if __name__ == "__main__":
    main()
