from __future__ import annotations

import sys
from pathlib import Path

import matplotlib.pyplot as plt
import streamlit as st


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.evolution import simulate_once
from core.metrics import (
    effective_time,
    fidelity_series,
    ideal_state_series,
    purity_series,
)


FIDELITY_THRESHOLD = 0.9


def main() -> None:
    st.set_page_config(
        page_title="Quantum-Sim MVP",
        layout="wide",
    )

    st.title("Quantum-Sim MVP")
    st.write(
        "Change the environment around a single-qubit H gate and watch how the "
        "state becomes less ideal over time."
    )

    temperature_kelvin, magnetic_field_tesla, noise_level = _environment_controls()

    times, states = simulate_once(
        temperature_kelvin,
        magnetic_field_tesla,
        noise_level,
    )
    ideal_states = ideal_state_series(times)
    fidelities = fidelity_series(states, ideal_states)
    purities = purity_series(states)
    usable_time = effective_time(times, fidelities, FIDELITY_THRESHOLD)

    _summary_metrics(usable_time, fidelities[-1], purities[-1])

    st.pyplot(
        _build_plot(times, fidelities, purities, usable_time),
        clear_figure=True,
    )

    _beginner_explanations()


def _environment_controls() -> tuple[float, float, float]:
    st.sidebar.header("Environment")

    temperature_kelvin = st.sidebar.slider(
        "Temperature (temperature_kelvin)",
        min_value=0.0,
        max_value=1.0,
        value=0.1,
        step=0.01,
        help="Higher means the state becomes easier to disturb.",
    )
    st.sidebar.caption("Temperature: higher means the state becomes easier to disturb.")

    magnetic_field_tesla = st.sidebar.slider(
        "Magnetic field (magnetic_field_tesla)",
        min_value=0.0,
        max_value=1.0,
        value=0.1,
        step=0.01,
        help="Changes the environment condition affecting the state.",
    )
    st.sidebar.caption(
        "Magnetic field: changes the environment condition affecting the state."
    )

    noise_level = st.sidebar.slider(
        "Noise level (noise_level)",
        min_value=0.0,
        max_value=1.0,
        value=0.1,
        step=0.01,
        help="Stronger random disturbance.",
    )
    st.sidebar.caption("Noise level: stronger random disturbance.")

    return temperature_kelvin, magnetic_field_tesla, noise_level


def _summary_metrics(
    usable_time: float,
    final_fidelity: float,
    final_purity: float,
) -> None:
    first, second, third = st.columns(3)
    first.metric("Effective time", f"{usable_time:.3f} us")
    second.metric("Final fidelity", f"{final_fidelity:.3f}")
    third.metric("Final purity", f"{final_purity:.3f}")


def _build_plot(
    times: list[float],
    fidelities: list[float],
    purities: list[float],
    usable_time: float,
):
    figure, axes = plt.subplots(2, 1, sharex=True, figsize=(8, 6))

    axes[0].plot(times, fidelities, color="tab:blue", label="Fidelity")
    axes[0].axhline(
        FIDELITY_THRESHOLD,
        color="gray",
        linestyle="--",
        linewidth=1.0,
        label="Threshold",
    )
    axes[0].axvline(
        usable_time,
        color="tab:red",
        linestyle=":",
        linewidth=1.2,
        label="Effective time",
    )
    axes[0].set_ylabel("Fidelity")

    axes[1].plot(times, purities, color="tab:green", label="Purity")
    axes[1].axvline(
        usable_time,
        color="tab:red",
        linestyle=":",
        linewidth=1.2,
        label="Effective time",
    )
    axes[1].set_ylabel("Purity")
    axes[1].set_xlabel("Time (us)")

    for axis in axes:
        axis.set_ylim(0.0, 1.05)
        axis.grid(True, alpha=0.3)
        axis.legend()

    figure.tight_layout()
    return figure


def _beginner_explanations() -> None:
    st.subheader("How to read this")
    st.write("Fidelity: how close the result is to the ideal state.")
    st.write("Purity: how clean or mixed the quantum state is.")
    st.write("Effective time: when fidelity drops below the threshold.")


if __name__ == "__main__":
    main()
