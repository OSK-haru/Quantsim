from __future__ import annotations

import json

import streamlit as st

from core.circuit_history import CircuitHistory
from core.circuit_model import GateOperation
from core.circuit_state import CircuitState
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from core.simulator import run_simulation
from ui.circuit_editor import render_circuit_editor
from ui.environment_panel import render_environment_panel
from ui.error_display import render_error_display
from ui.gate_palette import render_gate_palette
from ui.result_drawers import render_result_drawers
from ui.result_summary import render_result_summary


def render_beginner_mode() -> None:
    _initialize_beginner_state()
    _load_demo_if_requested()

    st.title("Beginner Mode")
    st.write("Build a tiny circuit, choose environment conditions, and run it.")

    if st.button("Back to Start Screen"):
        st.session_state.app_screen = "start"
        st.rerun()

    left, main = st.columns([1, 2])

    with left:
        selected_gate = render_gate_palette()
        environment_values = render_environment_panel()

    with main:
        history = st.session_state.circuit_history
        render_circuit_editor(history, selected_gate)
        signature = _simulation_signature(history, environment_values)

        if st.button("Run Simulation", type="primary"):
            _run_and_store_simulation(
                history,
                environment_values,
                signature,
            )

        if st.session_state.get("run_demo_simulation"):
            _run_and_store_simulation(
                history,
                environment_values,
                signature,
            )
            st.session_state.run_demo_simulation = False

        if _should_refresh_result(signature):
            _run_and_store_simulation(
                history,
                environment_values,
                signature,
            )

        result = st.session_state.get("last_result")
        render_error_display(
            issues=result.issues if isinstance(result, SimulationResult) else [],
            warnings=result.warnings if isinstance(result, SimulationResult) else [],
        )
        render_result_summary(result)
        render_result_drawers(result)


def _initialize_beginner_state() -> None:
    if "circuit_history" not in st.session_state:
        st.session_state.circuit_history = CircuitHistory(
            current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
        )
    if "selected_gate" not in st.session_state:
        st.session_state.selected_gate = "H"
    if "env_temperature" not in st.session_state:
        st.session_state.env_temperature = 0.1
    if "env_magnetic_field" not in st.session_state:
        st.session_state.env_magnetic_field = 0.1
    if "env_noise_level" not in st.session_state:
        st.session_state.env_noise_level = 0.1


def _load_demo_if_requested() -> None:
    if not st.session_state.get("load_demo_circuit"):
        return

    history = CircuitHistory(
        current=CircuitState(logical_qubits=1, initial_states=["0"], columns=[])
    )
    history.add_gate(
        0,
        GateOperation(
            type="H",
            targets=[0],
            controls=[],
            params={},
        ),
    )
    st.session_state.circuit_history = history
    st.session_state.selected_gate = "H"
    st.session_state.env_temperature = 0.1
    st.session_state.env_magnetic_field = 0.1
    st.session_state.env_noise_level = 0.1
    st.session_state.load_demo_circuit = False


def _run_simulation(
    history: CircuitHistory,
    environment_values: dict[str, float],
) -> SimulationResult:
    config = SimulationConfig(
        circuit=history.current.to_config(),
        environment=EnvironmentConfig(
            mode="normalized",
            temperature=environment_values["temperature"],
            magnetic_field=environment_values["magnetic_field"],
            noise_level=environment_values["noise_level"],
        ),
        duration_us=20.0,
        time_steps=101,
        fidelity_threshold=0.9,
    )
    return run_simulation(config)


def _run_and_store_simulation(
    history: CircuitHistory,
    environment_values: dict[str, float],
    signature: str,
) -> None:
    st.session_state.last_result = _run_simulation(history, environment_values)
    st.session_state.last_result_signature = signature


def _should_refresh_result(signature: str) -> bool:
    return (
        "last_result" in st.session_state
        and st.session_state.get("last_result_signature") != signature
    )


def _simulation_signature(
    history: CircuitHistory,
    environment_values: dict[str, float],
) -> str:
    payload = {
        "circuit": history.current.to_config().to_dict(),
        "environment": environment_values,
        "duration_us": 20.0,
        "time_steps": 101,
        "fidelity_threshold": 0.9,
    }
    return json.dumps(payload, sort_keys=True)
