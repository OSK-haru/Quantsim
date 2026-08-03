"""Collect runtime IBM calibration metadata for the Phase 3B comparison."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from qiskit_ibm_runtime import QiskitRuntimeService

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RAW = ROOT / "validation_hardware" / "raw" / (
    "phase3b_formal_audit_d9nlh5ssfqic73ar6f30.json"
)
DEFAULT_OUTPUT = ROOT / "validation_results" / "phase3b_runtime_calibration.json"


def _qubit_values(properties: Any, qubit: int) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for item in properties.qubits[qubit]:
        name = str(getattr(item, "name", ""))
        values[name] = {
            "value": float(item.value),
            "unit": str(item.unit),
        }
    return values


def _gate_values(properties: Any, qubit: int) -> list[dict[str, Any]]:
    values = []
    for gate in properties.gates:
        qubits = list(getattr(gate, "qubits", []))
        if qubits != [qubit]:
            continue
        parameters = {}
        for parameter in getattr(gate, "parameters", []):
            parameters[str(parameter.name)] = {
                "value": float(parameter.value),
                "unit": str(parameter.unit),
            }
        values.append({"gate": str(gate.gate), "parameters": parameters})
    return values


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=DEFAULT_RAW)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--qubit", type=int, default=150)
    args = parser.parse_args()

    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    backend_id = raw["device_id"]
    backend = QiskitRuntimeService().backend(backend_id)
    properties = backend.properties()
    if properties is None:
        raise RuntimeError("backend properties are unavailable")
    compiled_counts: dict[str, int] = {}
    for record in raw["compiled_circuits"]:
        for name, count in record["gate_counts"].items():
            compiled_counts[name] = compiled_counts.get(name, 0) + int(count)

    calibration = {
        "analysis_id": "phase3b_runtime_calibration_snapshot_v1",
        "collected_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_raw_result": str(args.raw.resolve().relative_to(ROOT)),
        "source_job_id": raw["job_id"],
        "backend": backend.name,
        "backend_version": backend.backend_version,
        "dt_seconds": getattr(backend, "dt", None),
        "calibration_timestamp": (
            properties.last_update_date.isoformat()
            if properties.last_update_date is not None
            else None
        ),
        "physical_qubit": args.qubit,
        "qubit_properties": _qubit_values(properties, args.qubit),
        "single_qubit_gate_properties": _gate_values(properties, args.qubit),
        "compiled_gate_counts_in_source_job": compiled_counts,
        "interpretation": [
            "Use this snapshot instead of the older 2026-07-30 CSV when comparing the formal candidate job.",
            "RZ is virtual on this backend; its listed duration/error must not be treated as SX pulse duration.",
            "The current gate-aware logical model does not reproduce every native pulse calibration parameter.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(calibration, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(json.dumps(calibration, indent=2, ensure_ascii=True))
    print(f"WROTE: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
