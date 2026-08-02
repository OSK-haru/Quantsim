"""Analyze the protocol-defined formal-audit candidate result."""

from __future__ import annotations

import argparse
import json
import math
import random
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


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        raise ValueError("cannot compute percentile of empty values")
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1.0 - weight) + ordered[upper] * weight


def _bootstrap(
    *,
    readout_zero: dict[str, object],
    readout_one: dict[str, object],
    t1_records: list[dict[str, object]],
    t2_records: list[dict[str, object]],
    replicates: int,
    model_t1_us: float,
    model_t2_us: float,
    observed_t2_fit: dict[str, object],
) -> dict[str, object]:
    rng = random.Random(20260803)
    t1_values: list[float] = []
    t2_values: list[float] = []
    t1_point_values = [[] for _ in t1_records]
    t2_point_values = [[] for _ in t2_records]
    base_frequency = float(observed_t2_fit.get("frequency_cycles_per_us", 0.0))
    base_phase = float(observed_t2_fit.get("phase_rad", 0.0))

    for _ in range(replicates):
        zero_shots = int(readout_zero["shots"])
        one_shots = int(readout_one["shots"])
        sampled_p10 = sum(
            1 for _ in range(zero_shots)
            if rng.random() < int(readout_zero["counts"].get("1", 0)) / zero_shots
        ) / zero_shots
        sampled_p11 = sum(
            1 for _ in range(one_shots)
            if rng.random() < int(readout_one["counts"].get("1", 0)) / one_shots
        ) / one_shots
        span = sampled_p11 - sampled_p10
        if span <= 0.0:
            continue

        def corrected(record: dict[str, object]) -> float:
            shots = int(record["shots"])
            observed = sum(
                1 for _ in range(shots)
                if rng.random() < int(record["counts"].get("1", 0)) / shots
            ) / shots
            return min(1.0, max(0.0, (observed - sampled_p10) / span))

        t1_points = []
        for index, record in enumerate(t1_records):
            value = corrected(record)
            t1_points.append((float(record["delay_us"]), value))
            t1_point_values[index].append(value)
        t1_fit = _fit_decay(t1_points, "corrected P1")
        if t1_fit.get("status") == "fit":
            t1_values.append(float(t1_fit["decay_time_us"]))

        t2_points = []
        for index, record in enumerate(t2_records):
            value = 1.0 - 2.0 * corrected(record)
            t2_points.append((float(record["delay_us"]), value))
            t2_point_values[index].append(value)
        t2_fit = _fit_damped_oscillation(
            t2_points,
            frequency_steps=81,
            t2_steps=81,
        )
        if t2_fit.get("status") == "fit":
            t2_values.append(float(t2_fit["t2_us"]))

    def interval(values: list[float]) -> dict[str, float | int]:
        return {
            "samples": len(values),
            "lower_95": _percentile(values, 0.025),
            "upper_95": _percentile(values, 0.975),
        }

    t1_interval = interval(t1_values)
    t2_interval = interval(t2_values)
    t1_coverage = sum(
        _percentile(values, 0.025) <= math.exp(-float(record["delay_us"]) / model_t1_us) <= _percentile(values, 0.975)
        for values, record in zip(t1_point_values, t1_records)
        if values
    ) / len(t1_records)
    t2_coverage = 0.0
    if observed_t2_fit.get("status") == "fit":
        amplitude = float(observed_t2_fit["amplitude"])
        for values, record in zip(t2_point_values, t2_records):
            if not values:
                continue
            time_us = float(record["delay_us"])
            model_contrast = amplitude * math.exp(-time_us / model_t2_us) * math.cos(
                2.0 * math.pi * base_frequency * time_us + base_phase
            )
            t2_coverage += _percentile(values, 0.025) <= model_contrast <= _percentile(values, 0.975)
        t2_coverage /= len(t2_records)
    t1_compatible = t1_interval["lower_95"] <= model_t1_us <= t1_interval["upper_95"]
    t2_compatible = t2_interval["lower_95"] <= model_t2_us <= t2_interval["upper_95"]
    if t1_coverage >= 0.9 and t2_coverage >= 0.9 and t1_compatible and t2_compatible:
        decision = "PASS"
    elif t1_values and t2_values:
        decision = "CONDITIONAL_PASS"
    else:
        decision = "FAIL"
    return {
        "replicates_requested": replicates,
        "t1_interval_us": t1_interval,
        "t2_interval_us": t2_interval,
        "t1_model_coverage": t1_coverage,
        "t2_model_coverage": t2_coverage,
        "t1_model_compatible": t1_compatible,
        "t2_model_compatible": t2_compatible,
        "decision": decision,
        "method": "deterministic binomial bootstrap including same-job readout calibration",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--model-t1-us", type=float, default=303.33)
    parser.add_argument("--model-t2-us", type=float, default=339.99)
    parser.add_argument("--bootstrap-replicates", type=int, default=200)
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
    t1_records = []
    t2_records = []
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
            t1_records.append(record)
            t1_points.append((float(record["delay_us"]), corrected))
            row["model_p1"] = __import__("math").exp(-float(record["delay_us"]) / args.model_t1_us)
        else:
            t2_records.append(record)
            contrast = 1.0 - 2.0 * corrected
            t2_points.append((float(record["delay_us"]), contrast))
            row["contrast"] = contrast
        rows.append(row)

    t1_fit = _fit_decay(t1_points, "corrected P1")
    t2_fit = _fit_damped_oscillation(t2_points)
    bootstrap = _bootstrap(
        readout_zero=zero,
        readout_one=one,
        t1_records=t1_records,
        t2_records=t2_records,
        replicates=args.bootstrap_replicates,
        model_t1_us=args.model_t1_us,
        model_t2_us=args.model_t2_us,
        observed_t2_fit=t2_fit,
    )
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
        "bootstrap": bootstrap,
        "limitations": [
            "Protocol was not committed before execution, so the result cannot be promoted to formal holdout.",
            "The bootstrap decision is statistical evidence only; formal promotion still requires protocol provenance.",
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
