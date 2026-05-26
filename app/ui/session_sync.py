from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from core.circuit_history import CircuitHistory
from core.circuit_state import CircuitState
from core.results import EnvironmentConfig, SimulationConfig


def apply_loaded_config_to_session(
    config: SimulationConfig,
    state: MutableMapping[str, Any] | None = None,
) -> None:
    """Apply a loaded config to UI session state and clear stale outputs."""

    target = _session_state() if state is None else state
    circuit_state = CircuitState.from_config(config.circuit)
    circuit_history = CircuitHistory(current=circuit_state)

    target["simulation_config"] = config
    target["logical_qubits"] = config.circuit.logical_qubits
    target["initial_states"] = list(config.circuit.initial_states)
    target["circuit_state"] = circuit_state.copy()
    target["circuit_history"] = circuit_history
    target["temperature"] = config.environment.temperature
    target["magnetic_field"] = config.environment.magnetic_field
    target["noise_level"] = config.environment.noise_level
    target["observation_strength"] = config.environment.observation_strength
    target["observation_frequency"] = config.environment.observation_frequency
    target["duration_us"] = config.duration_us
    target["time_steps"] = config.time_steps
    target["fidelity_threshold"] = config.fidelity_threshold
    target["model"] = config.model
    target["workflow"] = target.get("workflow", "single")
    _clear_stale_outputs(target)


def apply_pending_loaded_config_if_any(
    state: MutableMapping[str, Any] | None = None,
) -> bool:
    target = _session_state() if state is None else state
    pending = target.get("pending_loaded_config")
    if pending is None:
        return False
    apply_loaded_config_to_session(SimulationConfig.from_dict(pending), target)
    if "pending_loaded_config" in target:
        del target["pending_loaded_config"]
    return True


def initialize_default_session_state(
    state: MutableMapping[str, Any] | None = None,
) -> None:
    target = _session_state() if state is None else state
    if "circuit_state" not in target:
        target["circuit_state"] = CircuitState(
            logical_qubits=1,
            initial_states=["0"],
            columns=[],
        )
    if "circuit_history" not in target:
        target["circuit_history"] = CircuitHistory(current=target["circuit_state"])
    sync_from_history(
        target["circuit_history"],
        target,
        update_widget_keys="logical_qubits" not in target,
    )

    target.setdefault("selected_gate", "H")
    target.setdefault("temperature", _legacy_value(target, "env_temperature", 0.1))
    target.setdefault("magnetic_field", _legacy_value(target, "env_magnetic_field", 0.1))
    target.setdefault("noise_level", _legacy_value(target, "env_noise_level", 0.1))
    target.setdefault("observation_strength", None)
    target.setdefault("observation_frequency", None)
    target.setdefault("duration_us", 20.0)
    target.setdefault("time_steps", 101)
    target.setdefault("fidelity_threshold", 0.9)
    target.setdefault("model", "weak_coupling_lindblad")
    target.setdefault("workflow", "single")
    _update_simulation_config(target)


def sync_from_history(
    history: CircuitHistory,
    state: MutableMapping[str, Any] | None = None,
    update_widget_keys: bool = True,
) -> None:
    target = _session_state() if state is None else state
    target["circuit_state"] = history.current.copy()
    if update_widget_keys:
        target["logical_qubits"] = history.current.logical_qubits
    target["initial_states"] = list(history.current.initial_states)
    _update_simulation_config(target)


def resize_logical_qubits(
    new_count: int,
    state: MutableMapping[str, Any] | None = None,
) -> list[str]:
    target = _session_state() if state is None else state
    if target.get("logical_qubits") != int(new_count):
        target["logical_qubits"] = int(new_count)
    history = target["circuit_history"]
    resized = history.current.copy()
    warnings = resized.resize_qubits(new_count)
    target["circuit_history"] = CircuitHistory(current=resized)
    sync_from_history(
        target["circuit_history"],
        target,
        update_widget_keys=False,
    )
    _clear_stale_outputs(target)
    target["resize_warnings"] = warnings
    return warnings


def current_simulation_config(
    state: MutableMapping[str, Any] | None = None,
) -> SimulationConfig:
    target = _session_state() if state is None else state
    circuit_state = target["circuit_state"]
    return SimulationConfig(
        circuit=circuit_state.to_config(),
        environment=EnvironmentConfig(
            mode="normalized",
            temperature=target["temperature"],
            magnetic_field=target["magnetic_field"],
            noise_level=target["noise_level"],
            observation_strength=target.get("observation_strength"),
            observation_frequency=target.get("observation_frequency"),
        ),
        duration_us=target["duration_us"],
        time_steps=target["time_steps"],
        fidelity_threshold=target["fidelity_threshold"],
        model=target["model"],
    )


def clear_stale_results(state: MutableMapping[str, Any] | None = None) -> None:
    _clear_stale_outputs(_session_state() if state is None else state)


def open_config_uploader_key(
    scope: str,
    state: MutableMapping[str, Any] | None = None,
) -> str:
    target = _session_state() if state is None else state
    version = int(target.get(_uploader_version_key(scope), 0))
    return f"{scope}_config_upload_{version}"


def clear_open_config_upload(
    scope: str,
    state: MutableMapping[str, Any] | None = None,
) -> None:
    """Force the next rerun to render an empty Open Config uploader."""

    target = _session_state() if state is None else state
    version_key = _uploader_version_key(scope)
    target[version_key] = int(target.get(version_key, 0)) + 1


def _update_simulation_config(target: MutableMapping[str, Any]) -> None:
    required = {
        "circuit_state",
        "temperature",
        "magnetic_field",
        "noise_level",
        "duration_us",
        "time_steps",
        "fidelity_threshold",
        "model",
    }
    if not required.issubset(target):
        return
    target["simulation_config"] = current_simulation_config(target)


def _clear_stale_outputs(target: MutableMapping[str, Any]) -> None:
    target["last_result"] = None
    target["last_comparison"] = None
    target["last_comparison_result"] = None
    target["expert_data"] = None
    for key in (
        "last_result_signature",
        "graph_data",
        "comparison_graph_data",
        "cached_graph_data",
    ):
        if key in target:
            del target[key]


def _legacy_value(target: MutableMapping[str, Any], key: str, default: float) -> float:
    return float(target[key]) if key in target else default


def _uploader_version_key(scope: str) -> str:
    return f"{scope}_config_upload_version"


def _session_state() -> MutableMapping[str, Any]:
    import streamlit as st

    return st.session_state
