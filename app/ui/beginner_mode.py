from __future__ import annotations

import json

import streamlit as st

from core.circuit_model import GateOperation
from core.comparison import ComparisonConfig, ComparisonResult, run_comparison
from core.circuit_model import CircuitConfig, GateColumn
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation
from ui.circuit_editor import render_circuit_editor
from ui.comparison_drawers import render_comparison_drawers
from ui.comparison_summary import render_comparison_summary
from ui.environment_panel import render_environment_panel
from ui.error_display import render_error_display
from ui.gate_palette import render_gate_palette
from ui.persistence_panel import render_persistence_panel
from ui.result_drawers import render_result_drawers
from ui.result_summary import render_result_summary
from ui.session_sync import (
    apply_loaded_config_to_session,
    apply_pending_loaded_config_if_any,
    current_simulation_config,
    initialize_default_session_state,
)


def render_beginner_mode() -> None:
    _initialize_beginner_state()
    _load_demo_if_requested()

    st.title("Beginner Mode")
    st.write("Build a tiny circuit, choose environment conditions, and run it.")

    if st.button("Back to Start Screen"):
        st.session_state.app_screen = "start"
        st.rerun()

    history = st.session_state.circuit_history

    left, main = st.columns([1, 2])

    with left:
        selected_gate = render_gate_palette(history.current.logical_qubits)
        environment_values = render_environment_panel()
        render_persistence_panel(
            history,
            environment_values,
            st.session_state.get("last_result"),
            st.session_state.get("last_comparison"),
        )

    with main:
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


def _initialize_beginner_state() -> None:
    initialize_default_session_state()
    apply_pending_loaded_config_if_any()


def _load_demo_if_requested() -> None:
    if not st.session_state.get("load_demo_circuit"):
        return

    config = SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=1,
            initial_states=["0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[
                        GateOperation(
                            type="H",
                            targets=[0],
                            controls=[],
                            params={},
                        )
                    ],
                )
            ],
        ),
        environment=EnvironmentConfig(
            mode="normalized",
            temperature=0.1,
            magnetic_field=0.1,
            noise_level=0.1,
        ),
        duration_us=20.0,
        time_steps=101,
        fidelity_threshold=0.9,
    )
    apply_loaded_config_to_session(config)
    st.session_state.load_demo_circuit = False


def _run_simulation() -> SimulationResult:
    return run_simulation(current_simulation_config())


def _run_low_high_comparison() -> ComparisonResult:
    config = current_simulation_config()
    config = ComparisonConfig(
        circuit=config.circuit,
        environment_a=EnvironmentConfig(
            mode="normalized",
            temperature=0.1,
            magnetic_field=0.1,
            noise_level=0.1,
        ),
        environment_b=EnvironmentConfig(
            mode="normalized",
            temperature=0.8,
            magnetic_field=0.1,
            noise_level=0.8,
        ),
        duration_us=config.duration_us,
        time_steps=config.time_steps,
        fidelity_threshold=config.fidelity_threshold,
        model=config.model,
        label_a="Low noise",
        label_b="High noise",
    )
    return run_comparison(config)


def _run_and_store_simulation(signature: str) -> None:
    st.session_state.last_result = _run_simulation()
    st.session_state.last_result_signature = signature


def _should_refresh_result(signature: str) -> bool:
    result = st.session_state.get("last_result")
    return (
        isinstance(result, SimulationResult)
        and st.session_state.get("last_result_signature") != signature
    )


def _simulation_signature(
    history=None,
    environment_values=None,
) -> str:
    return json.dumps(current_simulation_config().to_dict(), sort_keys=True)
