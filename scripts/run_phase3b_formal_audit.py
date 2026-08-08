"""Run the protocol-defined Phase 3B formal-audit candidate job."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from qiskit import QuantumCircuit, transpile
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.run_phase3b_pilot import backend_metadata, logical_to_physical_mapping
from validation_hardware.pilot_manifest import load_and_validate_pilot_manifest

DEFAULT_MANIFEST = ROOT / "validation_hardware" / "phase3b_formal_audit_manifest.json"
DEFAULT_SOURCE_MANIFEST = ROOT / "validation_hardware" / "phase3b_pilot_manifest.json"
DEFAULT_OUTPUT_DIR = ROOT / "validation_hardware" / "raw"
CONFIRMATION = "RUN_PHASE3B_FORMAL_AUDIT"
SHOTS = 1024
DELAY_GRID_DT = tuple(range(0, 100001, 5000))


def build_circuit(kind: str, delay_dt: int) -> QuantumCircuit:
    circuit = QuantumCircuit(1, 1)
    if kind == "readout_one":
        circuit.x(0)
    elif kind == "t1":
        circuit.x(0)
        circuit.delay(delay_dt, 0, unit="dt")
    elif kind == "t2_ramsey":
        circuit.h(0)
        circuit.delay(delay_dt, 0, unit="dt")
        circuit.h(0)
    circuit.measure(0, 0)
    return circuit


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--source-manifest", type=Path, default=DEFAULT_SOURCE_MANIFEST)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--submit", action="store_true")
    parser.add_argument("--confirm", default="")
    args = parser.parse_args()

    formal = json.loads(args.manifest.read_text(encoding="utf-8"))
    source = load_and_validate_pilot_manifest(args.source_manifest)
    provider = formal["provider"]
    backend = QiskitRuntimeService().backend(provider["backend_id"])
    metadata = backend_metadata(backend)
    if metadata["backend_version"] != provider["backend_version"]:
        raise RuntimeError("backend version differs from formal manifest")
    if abs(metadata["dt_seconds"] - provider["native_dt_seconds"]) > 1e-18:
        raise RuntimeError("backend dt differs from formal manifest")

    physical_q0 = provider["physical_qubit"]
    plan = [("readout_zero", 0), ("readout_one", 0)]
    plan += [("t1", delay) for delay in DELAY_GRID_DT]
    plan += [("t2_ramsey", delay) for delay in DELAY_GRID_DT]
    records = []
    circuits = []
    for kind, delay_dt in plan:
        circuit = build_circuit(kind, delay_dt)
        compiled = transpile(
            circuit,
            backend=backend,
            initial_layout={circuit.qubits[0]: physical_q0},
            optimization_level=0,
        )
        mapping = logical_to_physical_mapping(
            compiled, circuit.qubits, {"q0": physical_q0}
        )
        if mapping.get("q0") != physical_q0:
            raise RuntimeError("transpilation moved the formal physical qubit")
        records.append({
            "kind": kind,
            "delay_dt": delay_dt,
            "delay_us": delay_dt * metadata["dt_seconds"] * 1e6,
            "shots": SHOTS,
            "mapping": mapping,
            "depth": compiled.depth(),
            "gate_counts": {str(k): int(v) for k, v in compiled.count_ops().items()},
            "compiled_circuit": str(compiled),
        })
        circuits.append(compiled)

    summary = {
        "audit_id": "phase3b_formal_gate_aware_qpu_audit_v1",
        "backend": metadata,
        "circuits": len(circuits),
        "shots_per_circuit": SHOTS,
        "total_shots": len(circuits) * SHOTS,
        "formal_holdout_eligible": False,
        "protocol_committed": False,
        "submit": bool(args.submit),
    }
    print(json.dumps(summary, indent=2, ensure_ascii=True))
    if not args.submit:
        print("DRY-RUN: no QPU job submitted")
        return 0
    if args.confirm != CONFIRMATION:
        raise RuntimeError(f"submission requires --confirm {CONFIRMATION}")

    started_at = datetime.now(timezone.utc)
    job = SamplerV2(mode=backend).run(circuits, shots=SHOTS)
    job_id = job.job_id()
    print(f"SUBMITTED: {job_id}", flush=True)
    result = job.result(timeout=8 * 60)
    finished_at = datetime.now(timezone.utc)
    raw_counts = []
    for record, pub_result in zip(records, result):
        counts = pub_result.data.c.get_counts()
        raw_counts.append({
            "kind": record["kind"],
            "delay_dt": record["delay_dt"],
            "delay_us": record["delay_us"],
            "shots": SHOTS,
            "counts": {str(k): int(v) for k, v in counts.items()},
        })
    output = {
        "audit_id": "phase3b_formal_gate_aware_qpu_audit_v1",
        "provider": "IBM Quantum",
        "device_id": backend.name,
        "job_id": job_id,
        "execution_started_at_utc": started_at.isoformat(),
        "execution_finished_at_utc": finished_at.isoformat(),
        "backend_properties": metadata,
        "native_dt_seconds": metadata["dt_seconds"],
        "compiled_circuits": records,
        "raw_counts": raw_counts,
        "shot_count": SHOTS,
        "source_revision": formal["source_revision"],
        "protocol": formal["protocol"],
        "yuragi_strider_commit": source["source_revision"]["freeze_commit"],
        "formal_holdout_eligible": False,
        "protocol_committed": False,
        "model_refit_after_run": False,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    path = args.output_dir / f"phase3b_formal_audit_{job_id}.json"
    path.write_text(json.dumps(output, indent=2, ensure_ascii=True), encoding="utf-8")
    print(f"RESULT_COMPLETE: {job_id}")
    print(f"RAW_RESULT: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
