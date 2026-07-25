"""Generate Pulse Extension B-5 QuTiP qutrit validation artifacts."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_pulse.qutrit_qutip import run_qutrit_qutip_comparison


RESULTS = ROOT / "validation_results"


def main() -> int:
    report, rows = run_qutrit_qutip_comparison()
    RESULTS.mkdir(parents=True, exist_ok=True)
    (RESULTS / "pulse_b_qutip_qutrit.json").write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    fieldnames = sorted({key for row in rows for key in row})
    with (RESULTS / "pulse_b_qutip_qutrit.csv").open(
        "w", newline="", encoding="utf-8"
    ) as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    _plot(report)
    print(json.dumps({
        "pass": report["pass"],
        "maximum_errors": report["maximum_errors"],
        "case_count": len(report["cases"]),
    }, indent=2))
    return 0 if report["pass"] else 1


def _plot(report: dict[str, object]) -> None:
    cases = report["cases"]
    labels = [case["name"] for case in cases]
    errors = [
        case["maximum_density_matrix_element_error"] for case in cases
    ]
    figure, axis = plt.subplots(figsize=(10, 5.5))
    axis.bar(range(len(labels)), errors, color="#2d8c83")
    axis.axhline(
        report["tolerance"],
        color="#c6533f",
        linestyle="--",
        label="preregistered tolerance",
    )
    axis.set_yscale("log")
    axis.set_ylabel("Maximum density-matrix element error")
    axis.set_xticks(range(len(labels)), labels, rotation=35, ha="right")
    axis.set_title("QuantaScope vs QuTiP: qutrit checkpoints")
    axis.legend()
    figure.tight_layout()
    figure.savefig(
        RESULTS / "pulse_b_qutip_qutrit_error.png",
        dpi=160,
    )
    plt.close(figure)


if __name__ == "__main__":
    raise SystemExit(main())
