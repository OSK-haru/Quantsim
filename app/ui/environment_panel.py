from __future__ import annotations

import streamlit as st


LOW_NOISE = {
    "temperature": 0.1,
    "magnetic_field": 0.1,
    "noise_level": 0.1,
}
HIGH_NOISE = {
    "temperature": 0.8,
    "magnetic_field": 0.1,
    "noise_level": 0.8,
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
        value=float(st.session_state.get("temperature", 0.1)),
        step=0.01,
        key="temperature",
    )
    magnetic_field = st.slider(
        "Magnetic field parameter",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("magnetic_field", 0.1)),
        step=0.01,
        key="magnetic_field",
    )
    noise_level = st.slider(
        "Noise level",
        min_value=0.0,
        max_value=1.0,
        value=float(st.session_state.get("noise_level", 0.1)),
        step=0.01,
        key="noise_level",
    )

    with st.expander("Simulation settings", expanded=False):
        st.number_input(
            "Duration (us)",
            min_value=0.001,
            value=float(st.session_state.get("duration_us", 20.0)),
            step=1.0,
            key="duration_us",
        )
        st.number_input(
            "Time steps",
            min_value=2,
            value=int(st.session_state.get("time_steps", 101)),
            step=1,
            key="time_steps",
        )
        st.slider(
            "Fidelity threshold",
            min_value=0.0,
            max_value=1.0,
            value=float(st.session_state.get("fidelity_threshold", 0.9)),
            step=0.01,
            key="fidelity_threshold",
        )
        st.selectbox(
            "Model",
            options=["weak_coupling_lindblad"],
            index=0,
            key="model",
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
