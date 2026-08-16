"""Generate the Phase 3A explicit-CPTP to QuTiP audit artifacts."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_cptp.qutip_audit import run_cptp_qutip_audit


DEFAULT_JSON_PATH = Path(
    "validation_results/cptp_qutip_comparison.json"
)
DEFAULT_CSV_PATH = Path(
    "validation_results/cptp_qutip_comparison.csv"
)
DEFAULT_MARKDOWN_PATH = Path(
    "docs_for_develop/validation/cptp-qutip-comparison.md"
)


def main() -> int:
    arguments = _parse_arguments()
    report, rows = run_cptp_qutip_audit(
        include_rust=not arguments.python_only,
    )
    report["generated_at_utc"] = datetime.now(timezone.utc).isoformat()

    for path in (
        arguments.json_path,
        arguments.csv_path,
        arguments.markdown_path,
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
    arguments.json_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    _write_csv(arguments.csv_path, rows)
    arguments.markdown_path.write_text(
        _markdown(report),
        encoding="utf-8",
    )
    print(json.dumps({
        "audit_id": report["audit_id"],
        "decision": report["decision"],
        "case_count": len(report["cases"]),
        "rust_requirement_pass": report["rust_requirement_pass"],
        "maximum_observed_errors": report["maximum_observed_errors"],
    }, indent=2))
    return 0 if report["overall_pass"] else 1


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    fieldnames = sorted({key for row in rows for key in row})
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _markdown(report: dict[str, object]) -> str:
    lines = [
        "# Phase 3A: Explicit CPTP to QuTiP Audit",
        "",
        "## Decision",
        "",
        f"**{report['decision']}**",
        "",
        "## Frozen Contract",
        "",
        f"- Freeze ID: `{report['frozen_contract']['freeze_id']}`",
        (
            "- Evolution method: "
            f"`{report['frozen_contract']['evolution_method_id']}`"
        ),
        "- Time-dependent policy: midpoint piecewise constant.",
        "- Density-matrix cleanup: not applied.",
        "",
        "## Method",
        "",
        "- Yuragi-Strider and QuTiP receive identical initial density matrices.",
        "- QuTiP receives the exact Yuragi-Strider Hamiltonian matrices and collapse-operator matrices.",
        "- Temperature and device parameters are not independently reinterpreted by QuTiP.",
        "- Every CPTP interval boundary is compared with QuTiP `mesolve` using DOP853.",
        "- Three interval sizes are preregistered for each case.",
        "- Python and Rust CPTP trajectories are compared against the same QuTiP trajectory.",
        "",
        "## Preregistered Acceptance",
        "",
        (
            "- Physicality tolerance: "
            f"`{report['preregistered_acceptance']['physicality_tolerance']:.1e}`"
        ),
        (
            "- Python/Rust parity tolerance: "
            f"`{report['preregistered_acceptance']['python_rust_parity_tolerance']:.1e}`"
        ),
        "- Maximum trajectory trace distance must decrease under interval refinement.",
        "- Finest-grid maximum trajectory trace distance must remain below the case-specific limit.",
        "",
        "## Results",
        "",
        "| Case | Backend | Interval [us] | Intervals | Max element | Frobenius | Trace distance | Min state eig |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for case in report["cases"]:
        for backend in case["backends"]:
            for row in backend["refinement"]:
                lines.append(
                    f"| `{case['case_id']}` | `{backend['backend']}` | "
                    f"{row['max_interval_us']:.6g} | "
                    f"{row['interval_count']} | "
                    f"{row['maximum_max_element_difference']:.6e} | "
                    f"{row['maximum_frobenius_difference']:.6e} | "
                    f"{row['maximum_trace_distance']:.6e} | "
                    f"{row['minimum_cptp_state_eigenvalue']:.6e} |"
                )
    lines.extend([
        "",
        "## Case Decisions",
        "",
        "| Case | Python/Rust max element | Parity | Case decision |",
        "|---|---:|---|---|",
    ])
    for case in report["cases"]:
        lines.append(
            f"| `{case['case_id']}` | "
            f"{case['python_rust_max_element_difference']:.6e} | "
            f"{'PASS' if case['python_rust_parity_pass'] else 'FAIL'} | "
            f"{'PASS' if case['case_pass'] else 'FAIL'} |"
        )
    lines.extend([
        "",
        "## Interpretation",
        "",
        "- A pass establishes agreement for the shared equations and tested discretizations.",
        "- It confirms refinement behavior of the frozen midpoint CPTP approximation.",
        "- It does not validate calibration against real hardware.",
        "- It does not add an explicit CPTP path to gate-aware execution.",
        "",
        "## Artifacts",
        "",
        "- Machine-readable summary: `validation_results/cptp_qutip_comparison.json`",
        "- Checkpoint metrics: `validation_results/cptp_qutip_comparison.csv`",
        "",
    ])
    return "\n".join(lines)


def _parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--json-path",
        type=Path,
        default=DEFAULT_JSON_PATH,
    )
    parser.add_argument(
        "--csv-path",
        type=Path,
        default=DEFAULT_CSV_PATH,
    )
    parser.add_argument(
        "--markdown-path",
        type=Path,
        default=DEFAULT_MARKDOWN_PATH,
    )
    parser.add_argument(
        "--python-only",
        action="store_true",
        help="Run a local Python-only diagnostic, not full acceptance.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
