from __future__ import annotations

from typing import Any

import streamlit as st

from core.comparison import ComparisonResult
from core.expert_data import (
    build_comparison_expert_summary,
    build_expert_inspector_data,
)
from core.results import SimulationResult


def render_expert_inspector(
    result: SimulationResult | None,
    comparison: ComparisonResult | None = None,
) -> None:
    st.subheader("Expert Inspector")
    query = st.text_input(
        "Search expert fields",
        placeholder="T1, gamma, fidelity, Lindblad, density matrix, trace...",
        key="expert_search",
    )
    data = build_expert_inspector_data(result)

    overview, noise, operators, state, assumptions = st.tabs([
        "Overview",
        "Noise",
        "Operators",
        "State",
        "Assumptions",
    ])

    with overview:
        _render_fields(data["overview"], query)
        _render_comparison_summary(comparison, query)

    with noise:
        _render_fields(data["noise"], query)

    with operators:
        _render_operator_data(data["operators"], query)

    with state:
        _render_state_data(data["state"], query)

    with assumptions:
        _render_assumptions(data["assumptions"], data["h_eff"], query)


def _render_comparison_summary(
    comparison: ComparisonResult | None,
    query: str,
) -> None:
    summary = build_comparison_expert_summary(comparison)
    if not summary:
        return
    if not _matches("comparison", summary, query):
        return

    st.markdown("#### A/B Expert Summary")
    for label, values in summary.items():
        if isinstance(values, dict):
            with st.expander(str(label), expanded=False):
                _render_fields(values, query)
        elif _matches(label, values, query):
            st.metric(str(label), _format_value(values))


def _render_fields(fields: dict[str, Any], query: str) -> None:
    visible = [
        {"Field": key, "Value": _format_value(value)}
        for key, value in fields.items()
        if _matches(key, value, query)
    ]
    if not visible:
        st.caption("No matching fields.")
        return
    st.dataframe(visible, hide_index=True, use_container_width=True)


def _render_operator_data(data: dict[str, Any], query: str) -> None:
    scalar_fields = {
        key: value
        for key, value in data.items()
        if key != "Collapse operators"
    }
    _render_fields(scalar_fields, query)

    operators = data.get("Collapse operators", [])
    if not operators:
        return

    for index, operator in enumerate(operators, start=1):
        label = (
            f"{operator.get('Name', 'Operator')} "
            f"q{operator.get('Target qubit', '?')}"
        )
        if not _matches(label, operator, query):
            continue
        with st.expander(label, expanded=False):
            _render_fields({
                "Target qubit": operator.get("Target qubit"),
                "Enabled": operator.get("Enabled"),
            }, query)
            matrix = operator.get("Matrix")
            if matrix is None:
                st.caption("Operator matrix is not available in current result.")
            else:
                _render_matrix_components(matrix, f"operator_{index}")


def _render_state_data(data: dict[str, Any], query: str) -> None:
    matrix = data.get("Final density matrix")
    fields = {
        key: value
        for key, value in data.items()
        if key != "Final density matrix"
    }
    _render_fields(fields, query)

    if _matches("Final density matrix", matrix, query):
        st.markdown("#### Final Density Matrix")
        if matrix is None:
            st.caption("Final density matrix is not available in current result.")
        else:
            _render_matrix_components(matrix, "final_density")


def _render_assumptions(
    assumptions: list[str],
    h_eff: dict[str, Any],
    query: str,
) -> None:
    visible = [
        assumption
        for assumption in assumptions
        if _matches("assumption", assumption, query)
    ]
    for assumption in visible:
        st.write(f"- {assumption}")

    if _matches("H_eff no-jump Lindblad", h_eff, query):
        st.markdown("#### H_eff / No-Jump")
        _render_fields(h_eff, query)


def _render_matrix_components(matrix: dict[str, Any], key_prefix: str) -> None:
    real, imag, absolute = st.tabs(["Re(rho)", "Im(rho)", "|rho|"])
    with real:
        st.dataframe(matrix["real"], use_container_width=True)
    with imag:
        st.dataframe(matrix["imag"], use_container_width=True)
    with absolute:
        st.dataframe(matrix["abs"], use_container_width=True)


def _matches(label: str, value: Any, query: str) -> bool:
    normalized = query.strip().lower()
    if not normalized:
        return True
    haystack = f"{label} {_flatten(value)}".lower()
    return normalized in haystack


def _flatten(value: Any) -> str:
    if isinstance(value, dict):
        return " ".join(f"{key} {_flatten(item)}" for key, item in value.items())
    if isinstance(value, list):
        return " ".join(_flatten(item) for item in value)
    return str(value)


def _format_value(value: Any) -> str:
    if value is None:
        return "not available in current result"
    if isinstance(value, bool):
        return "enabled" if value else "disabled"
    if isinstance(value, float):
        return f"{value:.6g}"
    if isinstance(value, dict) and {"real", "imag", "abs"}.issubset(value):
        return (
            f"{value['real']:.6g}"
            f"{value['imag']:+.6g}j"
            f" |abs|={value['abs']:.6g}"
        )
    return str(value)
