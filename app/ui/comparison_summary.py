from __future__ import annotations

import streamlit as st

from core.comparison import ComparisonResult


def render_comparison_summary(result: ComparisonResult | None) -> None:
    st.subheader("Comparison Summary")

    first, second, third, fourth, fifth = st.columns(5)
    first.metric(
        "Delta Final State Fidelity",
        _format_delta(result.delta_final_fidelity if result else None),
    )
    second.metric(
        "Delta Final Purity",
        _format_delta(result.delta_final_purity if result else None),
    )
    third.metric(
        "Delta Effective Operation Time",
        _format_time_delta(
            result.delta_effective_operation_time_us if result else None
        ),
    )
    fourth.metric(
        "Better Condition",
        result.better_condition if result else "not available",
    )
    fifth.metric("Delta Output Probability Distance", "not available")


def _format_delta(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:+.3f}"


def _format_time_delta(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:+.3f} us"
