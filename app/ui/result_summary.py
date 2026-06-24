from __future__ import annotations

import streamlit as st

from core.results import SimulationResult


def render_result_summary(result: SimulationResult | None) -> None:
    st.subheader("Result Summary")

    final_fidelity = _diagnostic_value(result, "final_fidelity")
    if final_fidelity is None:
        final_fidelity = _last_value(result.fidelity if result else None)
    final_purity = _diagnostic_value(result, "final_purity")
    if final_purity is None:
        final_purity = _last_value(result.purity if result else None)
    completion_fidelity = _diagnostic_value(result, "completion_fidelity")
    completion_purity = _diagnostic_value(result, "completion_purity")
    effective_time = (
        result.effective_operation_time_us
        if result is not None
        else None
    )

    first, second, third, fourth = st.columns(4)
    first.metric("Final State Fidelity", _format_probability(final_fidelity))
    second.metric("Final Purity", _format_probability(final_purity))
    third.metric("Effective Operation Time", _format_time(effective_time))
    fourth.metric("Output Probability Distance", "not available")

    st.subheader("Timing Summary")
    st.caption(
        "Completion is immediately after the last circuit column. Final is after "
        "any remaining idle evolution."
    )
    first, second, third, fourth = st.columns(4)
    first.metric(
        "Completion Fidelity",
        _format_probability(completion_fidelity),
        delta=_format_delta(completion_fidelity, final_fidelity),
    )
    second.metric(
        "Completion Purity",
        _format_probability(completion_purity),
        delta=_format_delta(completion_purity, final_purity),
    )
    third.metric(
        "Completion Time",
        _format_time(_diagnostic_value(result, "completion_time_us")),
    )
    fourth.metric(
        "Final Time",
        _format_time(_diagnostic_value(result, "final_time_us")),
    )

    first, second, third, fourth = st.columns(4)
    first.metric(
        "Configured Duration",
        _format_time(_diagnostic_value(result, "configured_duration_us")),
    )
    second.metric(
        "Actual Duration",
        _format_time(_diagnostic_value(result, "actual_duration_us")),
    )
    third.metric(
        "Gate Duration",
        _format_time(_diagnostic_value(result, "total_gate_duration_us")),
    )
    fourth.metric(
        "Idle Duration",
        _format_time(_diagnostic_value(result, "idle_duration_us")),
    )


def _last_value(values: list[float] | None) -> float | None:
    if not values:
        return None
    return values[-1]


def _diagnostic_value(result: SimulationResult | None, key: str) -> float | None:
    if result is None:
        return None
    value = result.diagnostics.get(key)
    if isinstance(value, bool) or value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_probability(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:.3f}"


def _format_time(value: float | None) -> str:
    if value is None:
        return "not available"
    return f"{value:.3f} us"


def _format_delta(start: float | None, end: float | None) -> str | None:
    if start is None or end is None:
        return None
    return f"{end - start:+.3f} final"
