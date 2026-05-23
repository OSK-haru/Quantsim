from __future__ import annotations

import matplotlib.pyplot as plt
import streamlit as st

from core.comparison import ComparisonResult
from core.results import EnvironmentConfig


def render_comparison_drawers(result: ComparisonResult | None) -> None:
    with st.expander("Comparison Graphs", expanded=True):
        if result is None:
            st.info("Run a comparison to see A/B curves.")
        else:
            st.pyplot(_build_comparison_plot(result), clear_figure=True)

    with st.expander("Output Probabilities", expanded=False):
        if result is None:
            st.write("No comparison output probabilities available yet.")
        else:
            _render_probability_rows(result)
            st.write("Delta Output Probability Distance: not available")

    with st.expander("Condition Details", expanded=False):
        if result is None:
            st.write("No comparison conditions available yet.")
        else:
            first, second = st.columns(2)
            with first:
                st.write(result.config.label_a)
                st.dataframe(
                    [_environment_row(result.config.environment_a)],
                    hide_index=True,
                    use_container_width=True,
                )
            with second:
                st.write(result.config.label_b)
                st.dataframe(
                    [_environment_row(result.config.environment_b)],
                    hide_index=True,
                    use_container_width=True,
                )


def _build_comparison_plot(result: ComparisonResult):
    figure, axes = plt.subplots(2, 1, sharex=True, figsize=(8, 5))

    axes[0].plot(
        result.result_a.times,
        result.result_a.fidelity,
        color="tab:blue",
        label=result.config.label_a,
    )
    axes[0].plot(
        result.result_b.times,
        result.result_b.fidelity,
        color="tab:orange",
        label=result.config.label_b,
    )
    axes[0].set_ylabel("Fidelity")

    axes[1].plot(
        result.result_a.times,
        result.result_a.purity,
        color="tab:green",
        label=result.config.label_a,
    )
    axes[1].plot(
        result.result_b.times,
        result.result_b.purity,
        color="tab:red",
        label=result.config.label_b,
    )
    axes[1].set_ylabel("Purity")
    axes[1].set_xlabel("Time (us)")

    for axis in axes:
        axis.set_ylim(0.0, 1.05)
        axis.grid(True, alpha=0.3)
        axis.legend()

    figure.tight_layout()
    return figure


def _render_probability_rows(result: ComparisonResult) -> None:
    states = sorted(
        set(result.result_a.output_probabilities)
        .union(result.result_b.output_probabilities)
    )
    if not states:
        st.write("No output probabilities available.")
        return

    rows = [
        {
            "state": state,
            result.config.label_a: result.result_a.output_probabilities.get(state),
            result.config.label_b: result.result_b.output_probabilities.get(state),
        }
        for state in states
    ]
    st.dataframe(rows, hide_index=True, use_container_width=True)


def _environment_row(environment: EnvironmentConfig) -> dict[str, float | str]:
    return {
        "mode": environment.mode,
        "temperature": environment.temperature,
        "magnetic_field": environment.magnetic_field,
        "noise_level": environment.noise_level,
    }
