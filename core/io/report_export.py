"""Markdown report exports for simulation and comparison results."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from core.comparison import ComparisonResult
from core.expert_data import build_expert_inspector_data
from core.io.result_export import comparison_result_to_dict, result_to_dict
from core.results import SimulationResult


def markdown_report_text(result: SimulationResult) -> str:
    data = result_to_dict(result)
    expert = build_expert_inspector_data(result)
    lines = [
        "# Yuragi-Strider Simulation Report",
        "",
        "## Summary",
        *_bullet_mapping(data["summary"]),
        "",
        "## Circuit",
        *_bullet_mapping(data["input_config"]["circuit"]),
        "",
        "## Environment",
        *_bullet_mapping(data["input_config"]["environment"]),
        "",
        "## Derived Parameters",
        *_bullet_mapping(data["derived_parameters"]),
        "",
        "## Diagnostics",
        *_bullet_mapping(data["diagnostics"]),
        "",
        "## Output Probabilities",
        *_bullet_mapping(data["output_probabilities"]),
        "",
        "## Model Assumptions",
        *[f"- {assumption}" for assumption in expert["assumptions"]],
        "",
        "## Warnings",
        *_warnings(data["warnings"]),
    ]
    return "\n".join(lines) + "\n"


def export_markdown_report(result: SimulationResult, path: str | Path) -> None:
    Path(path).write_text(markdown_report_text(result), encoding="utf-8")


def comparison_markdown_report_text(comparison_result: ComparisonResult) -> str:
    data = comparison_result_to_dict(comparison_result)
    lines = [
        "# Yuragi-Strider Comparison Report",
        "",
        "## Delta Metrics",
        *_bullet_mapping(data["delta_metrics"]),
        "",
        "## Condition A",
        f"- Label: {data['condition_a']['label']}",
        *_bullet_mapping(data["condition_a"]["summary"]),
        "",
        "## Condition B",
        f"- Label: {data['condition_b']['label']}",
        *_bullet_mapping(data["condition_b"]["summary"]),
        "",
        "## Environment A",
        *_bullet_mapping(data["condition_a"]["environment"]),
        "",
        "## Environment B",
        *_bullet_mapping(data["condition_b"]["environment"]),
        "",
        "## Warnings",
        *_warnings(data["warnings"]),
    ]
    return "\n".join(lines) + "\n"


def export_comparison_markdown_report(
    comparison_result: ComparisonResult,
    path: str | Path,
) -> None:
    Path(path).write_text(
        comparison_markdown_report_text(comparison_result),
        encoding="utf-8",
    )


def _bullet_mapping(mapping: dict[str, Any]) -> list[str]:
    if not mapping:
        return ["- not available"]
    return [f"- {key}: {_format_value(value)}" for key, value in mapping.items()]


def _warnings(warnings: list[str]) -> list[str]:
    if not warnings:
        return ["- none"]
    return [f"- {warning}" for warning in warnings]


def _format_value(value: Any) -> str:
    if isinstance(value, dict):
        return ", ".join(f"{key}={item}" for key, item in value.items())
    if isinstance(value, list):
        return f"{len(value)} item(s)"
    if value is None:
        return "not available"
    return str(value)
