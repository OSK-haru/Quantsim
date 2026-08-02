"""Analyze the protocol-defined formal-audit candidate result."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.analyze_phase3b_decomposed_followup import _fit_decay, _fit_damped_oscillation

DEFAULT_RAW = ROOT / "validation_hardware" / "raw" / (
    "phase3b_formal_audit_d9nlh5ssfqic73ar6f30.json"
)
DEFAULT_OUTPUT = ROOT / "validation_results" / "phase3b_formal_audit_analysis.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model-t1-us", type=float, default=303.33)
    parser.add_argument("--model-t2-us", type=float, default=339.99)
    args = parser.parse_args()

    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    records = raw["raw_counts"]
    zero = next(record for record in records if record["kind"] == "readout_zero")
    one = next(record for record in records if record["kind"] == "readout_one")
    p10 = int(zero["counts"].get("1", 0)) / zero["shots"]
    p11 = int(one["counts"].get("1", 0)) / one["shots"]
    span = p11 - p10
    if span <= 0.0:
        raise ValueError("readout calibration span must be positive")

    rows = []
    t1_points = []
    t2_points = []
    for record in records:
        if record["kind"] not in {"t1", "t2_ramsey"}:
            continue
        observed = int(record["counts"].get("1", 0)) / record["shots"]
        corrected = min(1.0, max(0.0, (observed - p10) / span))
        row = {
            "kind": record["kind"],
            "delay_us": record["delay_us"],
            "observed_p1": observed,
            "readout_corrected_p1": corrected,
        }
        if record["kind"] == "t1":
            t1_points.append((float(record["delay_us"]), corrected))
            row["model_p1"] = __import__("math").exp(-float(record["delay_us"]) / args.model_t1_us)
        else:
            contrast = 1.0 - 2.0 * corrected
            t2_points.append((float(record["delay_us"]), contrast))
            row["contrast"] = contrast
        rows.append(row)

    t1_fit = _fit_decay(t1_points, "corrected P1")
    t2_fit = _fit_damped_oscillation(t2_points)
    tphi = None
    if t2_fit.get("status") == "fit" and t1_fit.get("status") == "fit":
        import math
        inverse = 1.0 / float(t2_fit["t2_us"]) - 1.0 / (2.0 * float(t1_fit["decay_time_us"]))
        if inverse > 0.0:
            tphi = 1.0 / inverse

    report = {
        "analysis_id": "phase3b_formal_audit_analysis_v1",
        "source_raw_result": str(args.raw.resolve().relative_to(ROOT)),
        "job_id": raw["job_id"],
        "backend": raw["backend_properties"],
        "formal_holdout_eligible": False,
        "protocol_committed_before_execution": False,
        "readout_calibration": {
            "p_observed_1_given_0": p10,
            "p_observed_1_given_1": p11,
            "assignment_span": span,
        },
        "t1": {"fit": t1_fit, "model_reference_us": args.model_t1_us},
        "t2_ramsey": {"fit": t2_fit, "model_reference_us": args.model_t2_us},
        "tphi_derived_us": tphi,
        "rows": rows,
        "decision": "CANDIDATE_NOT_FORMAL",
        "limitations": [
            "Protocol was not committed before execution, so the result cannot be promoted to formal holdout.",
            "Confidence intervals and bootstrap coverage checks are not yet implemented in this analysis pass.",
            "No model refit was performed.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "readout": report["readout_calibration"],
        "t1": report["t1"],
        "t2_ramsey": report["t2_ramsey"],
        "tphi_derived_us": tphi,
        "decision": report["decision"],
    }, indent=2, ensure_ascii=True))
    print(f"WROTE: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
