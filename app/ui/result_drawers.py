from __future__ import annotations

import matplotlib.pyplot as plt
import streamlit as st

from core.results import SimulationResult


def render_result_drawers(result: SimulationResult | None) -> None:
    with st.expander("Graphs", expanded=True):
        if result is None or not result.times:
            st.info("Run a simulation to see fidelity and purity curves.")
        else:
            st.pyplot(_build_plot(result), clear_figure=True)

    with st.expander("Output Probabilities", expanded=False):
        if result is None or not result.output_probabilities:
            st.write("No output probabilities available yet.")
        else:
            rows = [
                {"state": state, "noisy probability": probability}
                for state, probability in result.output_probabilities.items()
            ]
            st.dataframe(rows, hide_index=True, use_container_width=True)
            st.write("Ideal output probabilities: not available")
            st.write("Output probability distance: not available")

    with st.expander("Explanation", expanded=False):
        st.write("State Fidelity shows how close the noisy state is to the ideal state.")
        st.write("Purity shows how clean the state remains. Lower purity means more mixing.")
        st.write(
            "Effective Operation Time is the first time the fidelity drops below "
            "the chosen threshold."
        )
        st.write(
            "Temperature, magnetic field, and noise level are normalized learning "
            "controls. Higher values usually shorten useful circuit lifetime."
        )


def _build_plot(result: SimulationResult):
    figure, axes = plt.subplots(2, 1, sharex=True, figsize=(8, 5))
    threshold = result.config.fidelity_threshold
    effective_time = result.effective_operation_time_us

    axes[0].plot(result.times, result.fidelity, color="tab:blue", label="Fidelity")
    axes[0].axhline(
        threshold,
        color="gray",
        linestyle="--",
        linewidth=1.0,
        label="Threshold",
    )
    if effective_time is not None:
        axes[0].axvline(
            effective_time,
            color="tab:red",
            linestyle=":",
            linewidth=1.2,
            label="Effective time",
        )
    axes[0].set_ylabel("Fidelity")

    axes[1].plot(result.times, result.purity, color="tab:green", label="Purity")
    if effective_time is not None:
        axes[1].axvline(
            effective_time,
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
