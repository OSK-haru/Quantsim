from __future__ import annotations

import streamlit as st


def render_start_screen() -> str | None:
    st.title("QuantaScope")
    st.write(
        "Explore how simple quantum circuits lose effectiveness when their "
        "environment becomes noisy."
    )

    st.radio(
        "Display level",
        options=["Beginner", "Expert"],
        horizontal=True,
        key="display_level",
    )
    if st.session_state.display_level == "Expert":
        st.info("Expert mode is coming soon. Beginner mode is ready to try.")

    first, second, third = st.columns(3)
    with first:
        if st.button("Run Demo", use_container_width=True):
            return "demo"
    with second:
        if st.button("Start Tutorial", use_container_width=True):
            st.session_state.show_tutorial_hint = True
            return "beginner"
    with third:
        if st.button("Open Config", use_container_width=True):
            st.info("Config loading will be added in a later phase.")

    if st.button("Enter Beginner Mode", type="primary"):
        return "beginner"

    if st.session_state.get("show_tutorial_hint"):
        st.info("Tutorial starts with one H gate on q0 and the Low noise preset.")

    return None
