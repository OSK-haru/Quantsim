"""Write readout-error validation artifacts from direct production-path runs.

The readout model is an observation-stage affine map, so the checks here differ
from the density-matrix validations: they confirm the algebra of the confusion
matrix, that probability is conserved, that errors act on the intended qubit,
and - most importantly - that state-level metrics stay untouched.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.gates import apply_readout_error, output_probabilities
from core.results import SimulationConfig
from core.simulator import run_simulation

MAX_IDENTITY_ERROR = 1e-15
MAX_ANALYTIC_ERROR = 1e-12
MAX_TRACE_ERROR = 1e-12
MAX_STATE_METRIC_DRIFT = 1e-15

ANALYTIC_CASES = [
    {"case": "A1", "p1": 0.3, "p10": 0.01, "p01": 0.05},
    {"case": "A2", "p1": 0.0, "p10": 0.005, "p01": 0.013},
    {"case": "A3", "p1": 1.0, "p10": 0.005, "p01": 0.013},
    {"case": "A4", "p1": 0.5, "p10": 0.05, "p01": 0.05},
]

CONSERVATION_CASES = [
    {
        "case": "C1",
        "n_qubits": 2,
        "distribution": [0.5, 0.2, 0.2, 0.1],
        "errors": [(0.01, 0.02), (0.005, 0.013)],
    },
    {
        "case": "C2",
        "n_qubits": 3,
        "distribution": [0.31, 0.04, 0.17, 0.09, 0.11, 0.02, 0.20, 0.06],
        "errors": [(0.02, 0.07), (0.005, 0.013), (0.03, 0.02)],
    },
]

SNAPSHOT_FIELDS = [
    "case", "kind", "label", "true_probability", "observed_probability",
    "expected_probability", "absolute_error",
]


def main() -> int:
    args = _parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    csv_rows: list[dict[str, object]] = []
    report: dict[str, object] = {
        "validation": "readout-error",
        "model": "affine_two_point_readout_v1",
        "tolerances": {
            "identity": MAX_IDENTITY_ERROR,
            "analytic": MAX_ANALYTIC_ERROR,
            "trace": MAX_TRACE_ERROR,
            "state_metric_drift": MAX_STATE_METRIC_DRIFT,
        },
    }

    identity = _check_identity(csv_rows)
    analytic = _check_analytic(csv_rows)
    conservation = _check_conservation(csv_rows)
    locality = _check_locality(csv_rows)
    isolation = _check_state_isolation(csv_rows)

    report["identity"] = identity
    report["analytic"] = analytic
    report["conservation"] = conservation
    report["locality"] = locality
    report["state_isolation"] = isolation
    report["overall_pass"] = all(
        section["pass"]
        for section in (identity, analytic, conservation, locality, isolation)
    )

    json_path = args.output_dir / "readout_error_validation.json"
    csv_path = args.output_dir / "readout_error_validation.csv"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SNAPSHOT_FIELDS)
        writer.writeheader()
        writer.writerows(csv_rows)

    print(f"overall_pass: {report['overall_pass']}")
    print(f"wrote {json_path}")
    print(f"wrote {csv_path}")
    return 0 if report["overall_pass"] else 1


def _check_identity(csv_rows: list[dict[str, object]]) -> dict[str, object]:
    """Zero error must reproduce the input distribution exactly."""

    probabilities = {"00": 0.5, "01": 0.2, "10": 0.2, "11": 0.1}
    observed = apply_readout_error(probabilities, 2, [(0.0, 0.0), (0.0, 0.0)])
    worst = max(abs(observed[key] - value) for key, value in probabilities.items())
    for label, value in probabilities.items():
        csv_rows.append({
            "case": "I1", "kind": "identity", "label": label,
            "true_probability": value, "observed_probability": observed[label],
            "expected_probability": value,
            "absolute_error": abs(observed[label] - value),
        })
    return {"maximum_error": worst, "pass": worst <= MAX_IDENTITY_ERROR}


def _check_analytic(csv_rows: list[dict[str, object]]) -> dict[str, object]:
    """Single-qubit observation must match the affine relation exactly."""

    worst = 0.0
    cases: list[dict[str, object]] = []
    for case in ANALYTIC_CASES:
        p1 = float(case["p1"])
        p10 = float(case["p10"])
        p01 = float(case["p01"])
        observed = apply_readout_error({"0": 1.0 - p1, "1": p1}, 1, [(p10, p01)])
        expected_one = p10 * (1.0 - p1) + (1.0 - p01) * p1
        expected_zero = 1.0 - expected_one
        error = max(
            abs(observed["1"] - expected_one),
            abs(observed["0"] - expected_zero),
        )
        worst = max(worst, error)
        cases.append({
            "case": case["case"], "p1": p1, "p10": p10, "p01": p01,
            "observed_p1": observed["1"], "expected_p1": expected_one,
            "absolute_error": error,
        })
        csv_rows.append({
            "case": case["case"], "kind": "analytic", "label": "1",
            "true_probability": p1, "observed_probability": observed["1"],
            "expected_probability": expected_one, "absolute_error": error,
        })
    return {"cases": cases, "maximum_error": worst, "pass": worst <= MAX_ANALYTIC_ERROR}


def _check_conservation(csv_rows: list[dict[str, object]]) -> dict[str, object]:
    """The confusion matrix is column-stochastic, so probability is conserved."""

    worst = 0.0
    cases: list[dict[str, object]] = []
    for case in CONSERVATION_CASES:
        n_qubits = int(case["n_qubits"])
        distribution = {
            format(index, f"0{n_qubits}b"): value
            for index, value in enumerate(case["distribution"])
        }
        observed = apply_readout_error(distribution, n_qubits, case["errors"])
        error = abs(sum(observed.values()) - 1.0)
        worst = max(worst, error)
        cases.append({
            "case": case["case"], "n_qubits": n_qubits,
            "observed_sum": sum(observed.values()), "absolute_error": error,
        })
        for label, value in observed.items():
            csv_rows.append({
                "case": case["case"], "kind": "conservation", "label": label,
                "true_probability": distribution[label],
                "observed_probability": value, "expected_probability": "",
                "absolute_error": "",
            })
    return {"cases": cases, "maximum_error": worst, "pass": worst <= MAX_TRACE_ERROR}


def _check_locality(csv_rows: list[dict[str, object]]) -> dict[str, object]:
    """An error on one qubit must not move weight on any other qubit.

    Qubit 0 is the most significant bit, so a p10 error on qubit 0 applied to
    |01> must leak into |11> and leave the q1 index alone.
    """

    observed = apply_readout_error(
        {"00": 0.0, "01": 1.0, "10": 0.0, "11": 0.0},
        2,
        [(0.1, 0.0), (0.0, 0.0)],
    )
    expected = {"00": 0.0, "01": 0.9, "10": 0.0, "11": 0.1}
    worst = max(abs(observed[key] - value) for key, value in expected.items())
    for label, value in expected.items():
        csv_rows.append({
            "case": "L1", "kind": "locality", "label": label,
            "true_probability": 1.0 if label == "01" else 0.0,
            "observed_probability": observed[label], "expected_probability": value,
            "absolute_error": abs(observed[label] - value),
        })
    return {
        "basis_convention": "q0_most_significant_bit",
        "maximum_error": worst,
        "pass": worst <= MAX_ANALYTIC_ERROR,
    }


def _check_state_isolation(csv_rows: list[dict[str, object]]) -> dict[str, object]:
    """Readout error must leave every state-level metric untouched.

    This is the design claim of the model: readout describes the apparatus, not
    the state, so it is applied to the observation stage only.
    """

    baseline = run_simulation(_bell_config())
    observed = run_simulation(_bell_config({"p10": 0.01, "p01": 0.02}))

    fidelity_drift = abs(observed.fidelity[-1] - baseline.fidelity[-1])
    purity_drift = abs(observed.purity[-1] - baseline.purity[-1])
    probability_shift = max(
        abs(observed.output_probabilities[key] - baseline.output_probabilities[key])
        for key in baseline.output_probabilities
    )
    observed_sum_error = abs(sum(observed.output_probabilities.values()) - 1.0)

    for label, value in baseline.output_probabilities.items():
        csv_rows.append({
            "case": "S1", "kind": "state_isolation", "label": label,
            "true_probability": value,
            "observed_probability": observed.output_probabilities[label],
            "expected_probability": "",
            "absolute_error": abs(observed.output_probabilities[label] - value),
        })

    disabled = run_simulation(_bell_config({"p10": 0.0, "p01": 0.0}))
    disabled_matches_baseline = max(
        abs(disabled.output_probabilities[key] - baseline.output_probabilities[key])
        for key in baseline.output_probabilities
    )

    return {
        "fidelity_drift": fidelity_drift,
        "purity_drift": purity_drift,
        "observed_probability_shift": probability_shift,
        "observed_sum_error": observed_sum_error,
        "disabled_configuration_drift": disabled_matches_baseline,
        "pass": (
            fidelity_drift <= MAX_STATE_METRIC_DRIFT
            and purity_drift <= MAX_STATE_METRIC_DRIFT
            and observed_sum_error <= MAX_TRACE_ERROR
            and disabled_matches_baseline <= MAX_IDENTITY_ERROR
            # The observation must actually change, otherwise the check is vacuous.
            and probability_shift > 1e-6
        ),
    }


def _bell_config(readout_error: dict[str, float] | None = None) -> SimulationConfig:
    return SimulationConfig(
        circuit=CircuitConfig(
            logical_qubits=2,
            initial_states=["0", "0"],
            columns=[
                GateColumn(
                    step=0,
                    gates=[GateOperation(type="H", targets=[0], controls=[], params={})],
                ),
                GateColumn(
                    step=1,
                    gates=[
                        GateOperation(type="CNOT", targets=[1], controls=[0], params={})
                    ],
                ),
            ],
        ),
        readout_error=readout_error,
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "validation_results",
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
