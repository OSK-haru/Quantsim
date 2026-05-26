"""Simulation and comparison result export helpers."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path
from typing import Any

from core.capabilities import DEFAULT_SIMULATION_MODEL
from core.comparison import ComparisonResult
from core.results import SimulationResult


SCHEMA_VERSION = "1.0"
RESULT_KIND = "quanta_scope.result"
COMPARISON_KIND = "quanta_scope.comparison_result"


def result_to_dict(result: SimulationResult) -> dict[str, Any]:
    """Return a JSON-safe .qscope.result.json envelope."""

    return {
        "schema_version": SCHEMA_VERSION,
        "kind": RESULT_KIND,
        "created_at": _created_at(),
        "model_version": DEFAULT_SIMULATION_MODEL,
        "input_config": result.config.to_dict(),
        "summary": _result_summary(result),
        "timeseries": _result_timeseries(result),
        "output_probabilities": dict(result.output_probabilities),
        "derived_parameters": dict(result.derived_parameters),
        "diagnostics": dict(result.diagnostics),
        "warnings": list(result.warnings),
        "issues": [issue.to_dict() for issue in result.issues],
    }


def result_to_json_text(result: SimulationResult) -> str:
    return json.dumps(result_to_dict(result), indent=2, sort_keys=True)


def save_result_json(result: SimulationResult, path: str | Path) -> None:
    Path(path).write_text(result_to_json_text(result), encoding="utf-8")


def result_to_csv_text(result: SimulationResult) -> str:
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["time_us", "state_fidelity", "purity"],
        lineterminator="\n",
    )
    writer.writeheader()
    for row in _result_timeseries(result):
        writer.writerow(row)
    return output.getvalue()


def export_result_csv(result: SimulationResult, path: str | Path) -> None:
    Path(path).write_text(result_to_csv_text(result), encoding="utf-8")


def comparison_result_to_dict(comparison_result: ComparisonResult) -> dict[str, Any]:
    """Return a JSON-safe comparison result envelope."""

    return {
        "schema_version": SCHEMA_VERSION,
        "kind": COMPARISON_KIND,
        "created_at": _created_at(),
        "model_version": DEFAULT_SIMULATION_MODEL,
        "condition_a": {
            "label": comparison_result.config.label_a,
            "environment": comparison_result.config.environment_a.to_dict(),
            "summary": _result_summary(comparison_result.result_a),
            "result": result_to_dict(comparison_result.result_a),
        },
        "condition_b": {
            "label": comparison_result.config.label_b,
            "environment": comparison_result.config.environment_b.to_dict(),
            "summary": _result_summary(comparison_result.result_b),
            "result": result_to_dict(comparison_result.result_b),
        },
        "delta_metrics": {
            "delta_final_fidelity": comparison_result.delta_final_fidelity,
            "delta_final_purity": comparison_result.delta_final_purity,
            "delta_effective_operation_time_us": (
                comparison_result.delta_effective_operation_time_us
            ),
            "better_condition": comparison_result.better_condition,
        },
        "warnings": list(comparison_result.warnings),
    }


def comparison_result_to_json_text(comparison_result: ComparisonResult) -> str:
    return json.dumps(
        comparison_result_to_dict(comparison_result),
        indent=2,
        sort_keys=True,
    )


def save_comparison_result_json(
    comparison_result: ComparisonResult,
    path: str | Path,
) -> None:
    Path(path).write_text(
        comparison_result_to_json_text(comparison_result),
        encoding="utf-8",
    )


def comparison_to_csv_text(comparison_result: ComparisonResult) -> str:
    output = StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "time_us",
            "state_fidelity_a",
            "purity_a",
            "state_fidelity_b",
            "purity_b",
        ],
        lineterminator="\n",
    )
    writer.writeheader()
    result_a = comparison_result.result_a
    result_b = comparison_result.result_b
    row_count = min(
        len(result_a.times),
        len(result_a.fidelity),
        len(result_a.purity),
        len(result_b.times),
        len(result_b.fidelity),
        len(result_b.purity),
    )
    for index in range(row_count):
        writer.writerow({
            "time_us": result_a.times[index],
            "state_fidelity_a": result_a.fidelity[index],
            "purity_a": result_a.purity[index],
            "state_fidelity_b": result_b.fidelity[index],
            "purity_b": result_b.purity[index],
        })
    return output.getvalue()


def export_comparison_csv(
    comparison_result: ComparisonResult,
    path: str | Path,
) -> None:
    Path(path).write_text(
        comparison_to_csv_text(comparison_result),
        encoding="utf-8",
    )


def _result_summary(result: SimulationResult) -> dict[str, Any]:
    return {
        "final_state_fidelity": result.fidelity[-1] if result.fidelity else None,
        "final_purity": result.purity[-1] if result.purity else None,
        "effective_operation_time_us": result.effective_operation_time_us,
        "time_samples": len(result.times),
        "warning_count": len(result.warnings),
        "issue_count": len(result.issues),
    }


def _result_timeseries(result: SimulationResult) -> list[dict[str, float]]:
    return [
        {
            "time_us": time,
            "state_fidelity": fidelity,
            "purity": purity,
        }
        for time, fidelity, purity in zip(
            result.times,
            result.fidelity,
            result.purity,
        )
    ]


def _created_at() -> str:
    return datetime.now(timezone.utc).isoformat()
