from __future__ import annotations

import streamlit as st


LOW_NOISE = {
    "env_temperature": 0.1,
    "env_magnetic_field": 0.1,
    "env_noise_level": 0.1,
}
HIGH_NOISE = {
    "env_temperature": 0.8,
    "env_magnetic_field": 0.1,
    "env_noise_level": 0.8,
}


def render_environment_panel() -> dict[str, float]:
    st.subheader("Environment")

    first, second = st.columns(2)
    if first.button("Low noise", use_container_width=True):
        _apply_preset(LOW_NOISE)
    if second.button("High noise", use_container_width=True):
        _apply_preset(HIGH_NOISE)

    temperature = st.slider(
        "Temperature parameter",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("env_temperature", 0.1)),
        step=0.01,
        key="env_temperature",
    )
    magnetic_field = st.slider(
        "Magnetic field parameter",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("env_magnetic_field", 0.1)),
        step=0.01,
        key="env_magnetic_field",
    )
    noise_level = st.slider(
        "Noise level",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("env_noise_level", 0.1)),
        step=0.01,
        key="env_noise_level",
    )

    st.caption(
        "These are normalized parameters for learning, not exact hardware "
        "temperature, magnetic field, or material values."
    )

    return {
        "temperature": temperature,
        "magnetic_field": magnetic_field,
        "noise_level": noise_level,
    }


def _apply_preset(values: dict[str, float]) -> None:
    for key, value in values.items():
        st.session_state[key] = value
