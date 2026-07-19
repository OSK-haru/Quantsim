"""Validate the zero-dissipation gate-aware unitary limit."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.gates import trace
from core.simulator import run_simulation
from tests.test_validation_zero_dissipation_unitary_limit import (
    FIDELITY_TOLERANCE,
    FROBENIUS_TOLERANCE,
    HERMITICITY_TOLERANCE,
    MAX_ELEMENT_TOLERANCE,
    TRACE_DISTANCE_TOLERANCE,
    TRACE_TOLERANCE,
    _final_density_matrix,
    _frobenius_error,
    _hermiticity_error,
    _max_element_error,
    _trace_distance,
    direct_unitary_reference,
    validation_cases,
)


CSV_FIELDS = [
    "case",
    "qubits",
    "columns",
    "max_abs",
    "frobenius",
    "trace_distance",
    "fidelity",
    "trace_error",
    "hermiticity_error",
    "idle_duration_us",
    "result",
]


def main() -> int:
    arguments = _parse_args()
    output_dir = arguments.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, object]] = []
    failures = 0
    print("case | qubits | columns | max_abs | frobenius | trace_distance | fidelity | trace_error | result")

    for case in validation_cases():
        result = run_simulation(case.config)
        simulated = _final_density_matrix(result)
        ideal = direct_unitary_reference(case.config)
        max_abs = _max_element_error(simulated, ideal)
        frobenius = _frobenius_error(simulated, ideal)
        trace_distance = _trace_distance(simulated, ideal)
        fidelity = float(result.fidelity[-1])
        trace_error = float(abs(trace(simulated) - 1.0))
        hermiticity_error = _hermiticity_error(simulated)
        idle_duration = float(result.diagnostics.get("idle_duration_us", float("nan")))

        failure_reason = _failure_reason(
            result=result,
            max_abs=max_abs,
            frobenius=frobenius,
            trace_distance=trace_distance,
            fidelity=fidelity,
            trace_error=trace_error,
            hermiticity_error=hermiticity_error,
            idle_duration=idle_duration,
        )
        status = "PASS" if failure_reason is None else f"FAIL: {failure_reason}"
        if failure_reason is not None:
            failures += 1

        row = {
            "case": case.name,
            "qubits": case.config.circuit.logical_qubits,
            "columns": len(case.config.circuit.columns),
            "max_abs": max_abs,
            "frobenius": frobenius,
            "trace_distance": trace_distance,
            "fidelity": fidelity,
            "trace_error": trace_error,
            "hermiticity_error": hermiticity_error,
            "idle_duration_us": idle_duration,
            "result": status,
        }
        rows.append(row)
        print(
            " | ".join([
                case.name,
                str(row["qubits"]),
                str(row["columns"]),
                f"{max_abs:.3e}",
                f"{frobenius:.3e}",
                f"{trace_distance:.3e}",
                f"{fidelity:.12f}",
                f"{trace_error:.3e}",
                status,
            ])
        )

    time_step_comparison = _time_step_comparison()
    failures += sum(
        comparison["result"] != "PASS"
        for comparison in time_step_comparison
    )
    print("time-step comparison | case | coarse | medium | fine | coarse_vs_fine | medium_vs_fine | result")
    for comparison in time_step_comparison:
        print(
            " | ".join([
                "time-step comparison",
                str(comparison["case"]),
                str(comparison["coarse_steps"]),
                str(comparison["medium_steps"]),
                str(comparison["fine_steps"]),
                f"{comparison['coarse_vs_fine_max_abs']:.3e}",
                f"{comparison['medium_vs_fine_max_abs']:.3e}",
                str(comparison["result"]),
            ])
        )

    json_path = output_dir / "validation1_zero_dissipation.json"
    csv_path = output_dir / "validation1_zero_dissipation.csv"
    report = {
        "validation": "VALIDATION-1",
        "description": "Zero-dissipation gate-aware evolution versus direct unitary reference",
        "zero_dissipation": {
            "ideal_reference": True,
            "gamma_down_per_us": 0.0,
            "gamma_up_per_us": 0.0,
            "gamma_phi_per_us": 0.0,
            "collapse_operator_count": 0,
        },
        "hamiltonian_convention": "effective angular-frequency generator in rad/us (numerically 1/us)",
        "basis_convention": "q0 is the most significant bit; labels are |q0 q1 ...>",
        "tolerances": {
            "max_element": MAX_ELEMENT_TOLERANCE,
            "frobenius": FROBENIUS_TOLERANCE,
            "trace_distance": TRACE_DISTANCE_TOLERANCE,
            "one_minus_fidelity": FIDELITY_TOLERANCE,
            "trace": TRACE_TOLERANCE,
            "hermiticity": HERMITICITY_TOLERANCE,
        },
        "cases": rows,
        "time_step_comparison": time_step_comparison,
        "passed": failures == 0,
    }
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"artifacts | {json_path} | {csv_path}")
    return 1 if failures else 0


def _time_step_comparison() -> list[dict[str, object]]:
    selected_cases = {
        case.name: case
        for case in validation_cases()
        if case.name in {"V1-2 1q H", "V1-4 2q Bell"}
    }
    comparisons: list[dict[str, object]] = []
    for name, case in selected_cases.items():
        results = {
            steps: run_simulation(replace(case.config, time_steps=steps))
            for steps in (11, 51, 101)
        }
        states = {
            steps: _final_density_matrix(result)
            for steps, result in results.items()
        }
        coarse_error = _max_element_error(states[11], states[101])
        medium_error = _max_element_error(states[51], states[101])
        comparisons.append({
            "case": name,
            "coarse_steps": 11,
            "medium_steps": 51,
            "fine_steps": 101,
            "coarse_vs_fine_max_abs": coarse_error,
            "medium_vs_fine_max_abs": medium_error,
            "result": "PASS"
            if coarse_error <= MAX_ELEMENT_TOLERANCE and medium_error <= MAX_ELEMENT_TOLERANCE
            else "FAIL",
        })
    return comparisons


def _failure_reason(
    *,
    result,
    max_abs: float,
    frobenius: float,
    trace_distance: float,
    fidelity: float,
    trace_error: float,
    hermiticity_error: float,
    idle_duration: float,
) -> str | None:
    if result.issues:
        return "simulation issues"
    checks = [
        (max_abs <= MAX_ELEMENT_TOLERANCE, "max_abs"),
        (frobenius <= FROBENIUS_TOLERANCE, "frobenius"),
        (trace_distance <= TRACE_DISTANCE_TOLERANCE, "trace_distance"),
        (1.0 - fidelity <= FIDELITY_TOLERANCE, "fidelity"),
        (trace_error <= TRACE_TOLERANCE, "trace"),
        (hermiticity_error <= HERMITICITY_TOLERANCE, "hermiticity"),
        (abs(idle_duration) <= TRACE_TOLERANCE, "idle_duration"),
    ]
    for passed, label in checks:
        if not passed:
            return label
    return None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "validation_results",
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
