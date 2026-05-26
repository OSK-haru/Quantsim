from __future__ import annotations

import streamlit as st

from core.circuit_history import CircuitHistory
from core.comparison import ComparisonResult
from core.io.config_io import (
    ConfigValidationError,
    config_from_json_text,
    config_to_json_text,
)
from core.io.report_export import (
    comparison_markdown_report_text,
    markdown_report_text,
)
from core.io.result_export import (
    comparison_result_to_json_text,
    comparison_to_csv_text,
    result_to_csv_text,
    result_to_json_text,
)
from core.results import EnvironmentConfig, SimulationConfig, SimulationResult
from ui.session_sync import (
    clear_open_config_upload,
    current_simulation_config,
    open_config_uploader_key,
)


def render_persistence_panel(
    history: CircuitHistory,
    environment_values: dict[str, float],
    result: SimulationResult | None = None,
    comparison: ComparisonResult | None = None,
) -> None:
    with st.expander("Save / Load / Export", expanded=False):
        config = _current_config(history, environment_values)

        st.download_button(
            "Save Config",
            data=config_to_json_text(config),
            file_name="current_circuit.qscope.json",
            mime="application/json",
            use_container_width=True,
        )

        upload = st.file_uploader(
            "Open Config",
            type=["json"],
            accept_multiple_files=False,
            key=open_config_uploader_key("mode"),
        )
        if upload is not None:
            _load_uploaded_config(upload)

        if isinstance(result, SimulationResult):
            first, second, third = st.columns(3)
            first.download_button(
                "Export Result JSON",
                data=result_to_json_text(result),
                file_name="simulation.qscope.result.json",
                mime="application/json",
                use_container_width=True,
            )
            second.download_button(
                "Export CSV",
                data=result_to_csv_text(result),
                file_name="simulation_timeseries.csv",
                mime="text/csv",
                use_container_width=True,
            )
            third.download_button(
                "Export Markdown Report",
                data=markdown_report_text(result),
                file_name="simulation_report.md",
                mime="text/markdown",
                use_container_width=True,
            )

        if isinstance(comparison, ComparisonResult):
            st.caption("Comparison exports")
            first, second, third = st.columns(3)
            first.download_button(
                "Export Comparison JSON",
                data=comparison_result_to_json_text(comparison),
                file_name="comparison.qscope.result.json",
                mime="application/json",
                use_container_width=True,
            )
            second.download_button(
                "Export Comparison CSV",
                data=comparison_to_csv_text(comparison),
                file_name="comparison_timeseries.csv",
                mime="text/csv",
                use_container_width=True,
            )
            third.download_button(
                "Export Comparison Markdown",
                data=comparison_markdown_report_text(comparison),
                file_name="comparison_report.md",
                mime="text/markdown",
                use_container_width=True,
            )


def _current_config(
    history: CircuitHistory,
    environment_values: dict[str, float],
) -> SimulationConfig:
    return current_simulation_config()


def _load_uploaded_config(upload) -> None:
    try:
        config = config_from_json_text(upload.getvalue().decode("utf-8"))
    except (ConfigValidationError, ValueError, TypeError, KeyError) as exc:
        st.error(str(exc))
        return

    st.session_state.pending_loaded_config = config.to_dict()
    clear_open_config_upload("mode")
    st.session_state.config_load_message = "Config loaded."
    st.rerun()
