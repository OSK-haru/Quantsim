"""Analyze a same-job-calibrated spin-echo follow-up."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.analyze_phase3b_decomposed_followup import _fit_damped_oscillation


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    records = raw["raw_counts"]
    zero = next(record for record in records if record["kind"] == "readout_zero")
    one = next(record for record in records if record["kind"] == "readout_one")
    p1_given_zero = int(zero["counts"].get("1", 0)) / zero["shots"]
    p1_given_one = int(one["counts"].get("1", 0)) / one["shots"]
    span = p1_given_one - p1_given_zero
    if span <= 0.0:
        raise ValueError("readout calibration span must be positive")

    rows = []
    points = []
    for record in records:
        if record["kind"] != "spin_echo":
            continue
        observed = int(record["counts"].get("1", 0)) / record["shots"]
        corrected = min(1.0, max(0.0, (observed - p1_given_zero) / span))
        contrast = 1.0 - 2.0 * corrected
        points.append((float(record["delay_us"]), contrast))
        rows.append({
            "delay_us": record["delay_us"],
            "observed_p1": observed,
            "readout_corrected_p1": corrected,
            "contrast": contrast,
        })

    fit = _fit_damped_oscillation(points)
    report = {
        "analysis_id": "phase3b_spin_echo_analysis_v1",
        "source_raw_result": str(args.raw.resolve().relative_to(ROOT)),
        "job_id": raw["job_id"],
        "backend": raw["backend_properties"],
        "readout_calibration": {
            "p_observed_1_given_0": p1_given_zero,
            "p_observed_1_given_1": p1_given_one,
            "assignment_span": span,
        },
        "damped_oscillation_fit": fit,
        "rows": rows,
        "interpretation": (
            "Exploratory spin-echo result. Compare its fitted frequency and "
            "contrast decay with the Ramsey result; do not promote parameters "
            "to the production model."
        ),
        "limitations": [
            "The fit is exploratory and assumes one damped cosine with no offset.",
            "The result is not formal holdout data.",
            "No parameter was refit into the production model.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "readout_calibration": report["readout_calibration"],
        "damped_oscillation_fit": fit,
    }, indent=2, ensure_ascii=True))
    print(f"WROTE: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
