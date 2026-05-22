from __future__ import annotations

import streamlit as st

from core.results import SimulationResult


def render_result_summary(result: SimulationResult | None) -> None:
    st.subheader("Result Summary")

    fidelity = _last_value(result.fidelity if result else None)
    purity = _last_value(result.purity if result else None)
    effective_time = (
        result.effective_operation_time_us
        if result is not None
        else None
    )

    first, second, third, fourth = st.columns(4)
    first.metric("State Fidelity", _format_probability(fidelity))
    second.metric("Purity", _format_probability(purity))
    third.metric("Effective Operation Time", _format_time(effective_time))
    fourth.metric("Output Probability Distance", "not available")


def _last_value(values: list[float] | None) -> float | None:
    if not values:
        return None
    return values[-1]


def _format_probability(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:.3f}"


def _format_time(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:.3f} us"
