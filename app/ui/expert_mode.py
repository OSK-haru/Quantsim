from __future__ import annotations

import streamlit as st

from core.comparison import ComparisonResult
from core.results import SimulationResult
from ui.beginner_mode import (
    _initialize_beginner_state,
    _load_demo_if_requested,
    _run_and_store_simulation,
    _run_low_high_comparison,
    _should_refresh_result,
    _simulation_signature,
)
from ui.circuit_editor import render_circuit_editor
from ui.comparison_drawers import render_comparison_drawers
from ui.comparison_summary import render_comparison_summary
from ui.environment_panel import render_environment_panel
from ui.error_display import render_error_display
from ui.expert_inspector import render_expert_inspector
from ui.gate_palette import render_gate_palette
from ui.persistence_panel import render_persistence_panel
from ui.result_drawers import render_result_drawers
from ui.result_summary import render_result_summary


def render_expert_mode() -> None:
    _initialize_beginner_state()
    _load_demo_if_requested()

    st.title("Expert Mode")
    st.write(
        "Inspect circuit execution, physical parameters, diagnostics, and "
        "model assumptions for the current simulation."
    )

    if st.button("Back to Start Screen"):
        st.session_state.app_screen = "start"
        st.rerun()

    history = st.session_state.circuit_history
    controls, workspace, inspector = st.columns([1, 2, 2])

    with controls:
        selected_gate = render_gate_palette(history.current.logical_qubits)
        environment_values = render_environment_panel()
        render_persistence_panel(
            history,
            environment_values,
            st.session_state.get("last_result"),
            st.session_state.get("last_comparison"),
        )

    with workspace:
        signature = _simulation_signature()

        st.subheader("Workflow")
        st.caption("Run the current circuit once, or compare it under two presets.")
        single_column, compare_column = st.columns(2)
        with single_column:
            if st.button("Run Simulation", type="primary", use_container_width=True):
                _run_and_store_simulation(signature)
        with compare_column:
            if st.button("Compare Low vs High Noise", use_container_width=True):
                st.session_state.last_comparison = _run_low_high_comparison()
                st.session_state.last_comparison_result = st.session_state.last_comparison

        render_circuit_editor(history, selected_gate)

        if st.session_state.get("run_demo_simulation"):
            _run_and_store_simulation(signature)
            st.session_state.run_demo_simulation = False

        if _should_refresh_result(signature):
            _run_and_store_simulation(signature)

        result = st.session_state.get("last_result")
        render_error_display(
            issues=result.issues if isinstance(result, SimulationResult) else [],
            warnings=result.warnings if isinstance(result, SimulationResult) else [],
        )
        render_result_summary(result)
        render_result_drawers(result)

        comparison = st.session_state.get("last_comparison")
        if isinstance(comparison, ComparisonResult):
            render_error_display(warnings=comparison.warnings)
            render_comparison_summary(comparison)
            render_comparison_drawers(comparison)

    with inspector:
        result = st.session_state.get("last_result")
        comparison = st.session_state.get("last_comparison")
        render_expert_inspector(
            result if isinstance(result, SimulationResult) else None,
            comparison if isinstance(comparison, ComparisonResult) else None,
        )
