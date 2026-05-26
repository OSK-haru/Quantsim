from __future__ import annotations

import streamlit as st

from core.io.config_io import ConfigValidationError, config_from_json_text
from ui.session_sync import (
    apply_loaded_config_to_session,
    clear_open_config_upload,
    open_config_uploader_key,
)


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
            st.session_state.show_start_config_upload = True

    if st.session_state.get("show_start_config_upload"):
        upload = st.file_uploader(
            "Choose a .qscope.json config",
            type=["json"],
            accept_multiple_files=False,
            key=open_config_uploader_key("start"),
        )
        if upload is not None:
            action = _load_start_config(upload)
            if action is not None:
                return action

    if st.session_state.display_level == "Expert":
        if st.button("Enter Expert Mode", type="primary"):
            return "expert"
    else:
        if st.button("Enter Beginner Mode", type="primary"):
            return "beginner"

    if st.session_state.get("show_tutorial_hint"):
        st.info("Tutorial starts with one H gate on q0 and the Low noise preset.")

    return None


def _load_start_config(upload) -> str | None:
    try:
        config = config_from_json_text(upload.getvalue().decode("utf-8"))
    except (ConfigValidationError, ValueError, TypeError, KeyError) as exc:
        st.error(str(exc))
        return None

    apply_loaded_config_to_session(config)
    clear_open_config_upload("start")
    st.session_state.show_start_config_upload = False
    return "expert" if st.session_state.display_level == "Expert" else "beginner"
