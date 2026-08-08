"""Run the bounded Phase 3B Gate-aware QPU pilot.

The command is dry-run by default. Submission requires both --submit and the
exact confirmation string so that inspecting the circuit cannot accidentally
consume QPU time.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from qiskit import QuantumCircuit, transpile
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
DEFAULT_MANIFEST = ROOT / "validation_hardware" / "phase3b_pilot_manifest.json"
DEFAULT_OUTPUT_DIR = ROOT / "validation_hardware" / "raw"
CONFIRMATION = "RUN_PHASE3B_PILOT"

from validation_hardware.pilot_manifest import (
    load_and_validate_pilot_manifest,
)


def build_circuit(case: dict[str, Any], delay_dt: int) -> QuantumCircuit:
    circuit = QuantumCircuit(1, 1)
    case_id = case["case_id"]
    initial_state = case["initial_states"][0]

    if initial_state == "1":
        circuit.x(0)
    if case_id == "single_qubit_gate_idle_pilot":
        circuit.h(0)
    if case_id in {"t1_delay_pilot", "single_qubit_gate_idle_pilot"}:
        circuit.delay(delay_dt, 0, unit="dt")
    circuit.measure(0, 0)
    return circuit


def logical_to_physical_mapping(
    compiled: QuantumCircuit,
    logical_qubits: list[Any],
    requested_mapping: dict[str, int],
) -> dict[str, int]:
    layout = getattr(compiled, "layout", None)
    initial_layout = getattr(layout, "initial_layout", None)
    if initial_layout is None:
        return requested_mapping
    physical_bits = initial_layout.get_virtual_bits()
    mapping = {
        f"q{index}": physical
        for physical, virtual in physical_bits.items()
        for index, logical in enumerate(logical_qubits)
        if virtual == logical
    }
    return mapping or requested_mapping


def compile_cases(
    manifest: dict[str, Any],
    backend: Any,
) -> tuple[list[dict[str, Any]], list[QuantumCircuit]]:
    provider = manifest["provider"]
    candidate_qubits = provider["candidate_physical_qubits"]
    physical_q0 = candidate_qubits[0]
    compiled_records: list[dict[str, Any]] = []
    compiled_circuits: list[QuantumCircuit] = []

    for case in manifest["cases"]:
        for delay_dt in case["delay_grid_dt"]:
            circuit = build_circuit(case, delay_dt)
            compiled = transpile(
                circuit,
                backend=backend,
                initial_layout={circuit.qubits[0]: physical_q0},
                optimization_level=0,
            )
            mapping = logical_to_physical_mapping(
                compiled,
                circuit.qubits,
                {"q0": physical_q0},
            )
            if mapping.get("q0") != physical_q0:
                raise RuntimeError(
                    f"transpilation moved q0: expected {physical_q0}, got {mapping}"
                )
            compiled_records.append(
                {
                    "case_id": case["case_id"],
                    "delay_dt": delay_dt,
                    "shots": case["shots"],
                    "mapping": mapping,
                    "depth": compiled.depth(),
                    "gate_counts": {
                        str(name): int(count)
                        for name, count in compiled.count_ops().items()
                    },
                    "compiled_circuit": str(compiled),
                }
            )
            compiled_circuits.append(compiled)
    return compiled_records, compiled_circuits


def backend_metadata(backend: Any) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "backend": backend.name,
        "backend_version": backend.backend_version,
        "dt_seconds": getattr(backend, "dt", None),
    }
    properties = backend.properties()
    if properties is not None:
        metadata["calibration_timestamp"] = (
            properties.last_update_date.isoformat()
            if properties.last_update_date is not None
            else None
        )
    return metadata


def run(args: argparse.Namespace) -> int:
    manifest = load_and_validate_pilot_manifest(args.manifest)
    policy = manifest["execution_policy"]
    provider = manifest["provider"]
    if provider["backend_id"] != "ibm_kingston":
        raise RuntimeError("this pilot runner is frozen for ibm_kingston")

    service = QiskitRuntimeService()
    backend = service.backend(provider["backend_id"])
    metadata = backend_metadata(backend)
    if metadata["backend_version"] != provider["backend_version"]:
        raise RuntimeError("backend version differs from the frozen manifest")
    if abs(metadata["dt_seconds"] - provider["native_dt_seconds"]) > 1e-18:
        raise RuntimeError("backend dt differs from the frozen manifest")

    compiled_records, compiled_circuits = compile_cases(manifest, backend)
    shots = policy["shots_per_circuit_max"]
    if len(compiled_circuits) != policy["total_circuits_max"]:
        raise RuntimeError("compiled circuit count differs from the frozen manifest")

    summary = {
        "backend": metadata,
        "circuits": compiled_records,
        "total_circuits": len(compiled_circuits),
        "shots_per_circuit": shots,
        "total_shots": len(compiled_circuits) * shots,
        "submit": bool(args.submit),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=True))

    if not args.submit:
        print("DRY-RUN: no QPU job submitted")
        return 0
    if args.confirm != CONFIRMATION:
        raise RuntimeError(
            f"submission requires --confirm {CONFIRMATION}"
        )

    started_at = datetime.now(timezone.utc)
    sampler = SamplerV2(mode=backend)
    job = sampler.run(compiled_circuits, shots=shots)
    job_id = job.job_id()
    print(f"SUBMITTED: {job_id}", flush=True)
    try:
        result = job.result(timeout=policy["timeout_minutes"] * 60)
    except Exception as exc:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        incomplete_path = args.output_dir / f"phase3b_pilot_{job_id}_incomplete.json"
        incomplete_path.write_text(
            json.dumps(
                {
                    "manifest_id": manifest["manifest_id"],
                    "device_id": backend.name,
                    "job_id": job_id,
                    "execution_started_at_utc": started_at.isoformat(),
                    "backend_properties": metadata,
                    "status": "result_timeout_or_provider_failure",
                    "error_type": type(exc).__name__,
                    "error": str(exc),
                },
                indent=2,
                ensure_ascii=True,
            ),
            encoding="utf-8",
        )
        print(f"INCOMPLETE_RESULT: {incomplete_path}")
        raise
    finished_at = datetime.now(timezone.utc)

    raw_counts: list[dict[str, Any]] = []
    for record, pub_result in zip(compiled_records, result):
        counts = pub_result.data.c.get_counts()
        raw_counts.append(
            {
                "case_id": record["case_id"],
                "delay_dt": record["delay_dt"],
                "shots": record["shots"],
                "counts": {str(key): int(value) for key, value in counts.items()},
            }
        )

    output = {
        "manifest_id": manifest["manifest_id"],
        "provider": "IBM Quantum",
        "device_id": backend.name,
        "job_id": job_id,
        "execution_started_at_utc": started_at.isoformat(),
        "execution_finished_at_utc": finished_at.isoformat(),
        "backend_properties": metadata,
        "native_dt_seconds": metadata["dt_seconds"],
        "compiled_circuits": compiled_records,
        "raw_counts": raw_counts,
        "shot_count": shots,
        "qubit_mapping": provider["transpilation_preview"][
            "logical_to_physical_mapping"
        ],
        "bit_order": manifest["conventions"]["bit_order"],
        "delay_grid_dt": sorted(
            {
                record["delay_dt"]
                for record in compiled_records
            }
        ),
        "yuragi_strider_commit": manifest["source_revision"]["freeze_commit"],
        "model_refit_after_pilot": policy["model_refit_after_pilot"],
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / f"phase3b_pilot_{job.job_id()}.json"
    output_path.write_text(
        json.dumps(output, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )
    print(f"RESULT_COMPLETE: {job_id}")
    print(f"RAW_RESULT: {output_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
    )
    parser.add_argument(
        "--submit",
        action="store_true",
        help="submit one bounded QPU job instead of dry-run",
    )
    parser.add_argument("--confirm", default="")
    return run(parser.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
