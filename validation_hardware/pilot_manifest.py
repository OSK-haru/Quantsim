"""Provider-neutral Phase 3B pilot manifest contract and validator."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


PILOT_MANIFEST_SCHEMA_VERSION = 1
PILOT_MANIFEST_ID = "phase3b_gate_aware_pilot_manifest_v1"
FREEZE_TAG = "yuragi-strider-gate-aware-cptp-v1"
FREEZE_COMMIT = "f306fbf6eb2083d9098ab0ade079e2681920ac4e"
EXPECTED_CASE_IDS = (
    "readout_zero_calibration",
    "readout_one_calibration",
    "t1_delay_pilot",
    "single_qubit_gate_idle_pilot",
)
EXPECTED_DELAY_GRID_DT = (0, 5000, 20000, 50000, 100000)
EXPECTED_CASE_DELAY_GRIDS = {
    "readout_zero_calibration": (0,),
    "readout_one_calibration": (0,),
    "t1_delay_pilot": EXPECTED_DELAY_GRID_DT,
    "single_qubit_gate_idle_pilot": EXPECTED_DELAY_GRID_DT,
}
EXPECTED_CASE_SHOTS = {
    "readout_zero_calibration": 32,
    "readout_one_calibration": 32,
    "t1_delay_pilot": 32,
    "single_qubit_gate_idle_pilot": 32,
}
PILOT_CASE_SHOTS = 32
PILOT_TOTAL_CIRCUITS = 12
PILOT_TOTAL_SHOTS = 384
PILOT_QPU_MINUTES = 8
ALLOWED_GATE_TYPES = {"H", "X", "Z", "CNOT", "DELAY", "MEASURE"}
FORBIDDEN_SECRET_KEYS = {
    "api_key",
    "password",
    "secret",
    "token",
    "credentials",
}


def load_and_validate_pilot_manifest(path: str | Path) -> dict[str, Any]:
    manifest_path = Path(path)
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    errors = validate_pilot_manifest(payload)
    if errors:
        raise ValueError("invalid Phase 3B pilot manifest:\n- " + "\n- ".join(errors))
    return payload


def validate_pilot_manifest(payload: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if payload.get("schema_version") != PILOT_MANIFEST_SCHEMA_VERSION:
        errors.append("unsupported schema_version")
    if payload.get("manifest_id") != PILOT_MANIFEST_ID:
        errors.append("unexpected manifest_id")

    revision = payload.get("source_revision")
    if not isinstance(revision, dict):
        errors.append("source_revision must be an object")
    else:
        if revision.get("freeze_tag") != FREEZE_TAG:
            errors.append("source_revision.freeze_tag must identify the frozen tag")
        if revision.get("freeze_commit") != FREEZE_COMMIT:
            errors.append("source_revision.freeze_commit must identify the frozen commit")
        if not re.fullmatch(r"[0-9a-f]{40}", str(revision.get("freeze_commit", ""))):
            errors.append("source_revision.freeze_commit must be a full commit hash")

    provider = payload.get("provider")
    if not isinstance(provider, dict) or not provider.get("name"):
        errors.append("provider.name is required")

    policy = payload.get("execution_policy")
    if not isinstance(policy, dict):
        errors.append("execution_policy must be an object")
    else:
        _require_positive_int(policy, "jobs_max", errors)
        _require_positive_int(policy, "circuits_per_job_max", errors)
        _require_positive_int(policy, "shots_per_circuit_max", errors)
        _require_positive_int(policy, "total_circuits_max", errors)
        _require_positive_int(policy, "timeout_minutes", errors)
        if policy.get("retry_max") is None or not isinstance(policy.get("retry_max"), int):
            errors.append("execution_policy.retry_max must be an integer")
        if policy.get("jobs_max") != 1:
            errors.append("execution_policy.jobs_max must be 1")
        if policy.get("retry_max") != 0:
            errors.append("execution_policy.retry_max must be 0")
        if policy.get("circuits_per_job_max") != PILOT_TOTAL_CIRCUITS:
            errors.append(
                f"execution_policy.circuits_per_job_max must be {PILOT_TOTAL_CIRCUITS}"
            )
        if policy.get("shots_per_circuit_max") != PILOT_CASE_SHOTS:
            errors.append(
                f"execution_policy.shots_per_circuit_max must be {PILOT_CASE_SHOTS}"
            )
        if policy.get("total_circuits_max") != PILOT_TOTAL_CIRCUITS:
            errors.append(
                f"execution_policy.total_circuits_max must be {PILOT_TOTAL_CIRCUITS}"
            )
        if policy.get("total_shots_max") != PILOT_TOTAL_SHOTS:
            errors.append(
                f"execution_policy.total_shots_max must be {PILOT_TOTAL_SHOTS}"
            )
        if policy.get("qpu_minutes_max") != PILOT_QPU_MINUTES:
            errors.append(
                f"execution_policy.qpu_minutes_max must be {PILOT_QPU_MINUTES}"
            )
        if policy.get("provider_allowance_minutes") != 10:
            errors.append("execution_policy.provider_allowance_minutes must be 10")
        if policy.get("safety_reserve_minutes") != 2:
            errors.append("execution_policy.safety_reserve_minutes must be 2")

    conventions = payload.get("conventions")
    if not isinstance(conventions, dict):
        errors.append("conventions must be an object")
    else:
        if conventions.get("bit_order") != "q0_msb_leftmost":
            errors.append("conventions.bit_order must be q0_msb_leftmost")
        if conventions.get("delay_unit") != "backend_dt":
            errors.append("conventions.delay_unit must be backend_dt")

    required_fields = payload.get("required_raw_provenance_fields")
    if not isinstance(required_fields, list) or not required_fields:
        errors.append("required_raw_provenance_fields must be non-empty")

    cases = payload.get("cases")
    if not isinstance(cases, list):
        errors.append("cases must be a list")
    else:
        case_ids = [case.get("case_id") for case in cases if isinstance(case, dict)]
        if tuple(case_ids) != EXPECTED_CASE_IDS:
            errors.append("cases must contain the frozen four case IDs in order")
        if len(cases) != len(EXPECTED_CASE_IDS):
            errors.append("cases must contain exactly four cases")
        for index, case in enumerate(cases):
            if not isinstance(case, dict):
                errors.append(f"cases[{index}] must be an object")
                continue
            _validate_case(case, index, errors)

    if payload.get("formal_holdout_eligible") is not False:
        errors.append("formal_holdout_eligible must be false for the pilot")
    if _contains_forbidden_secret_key(payload):
        errors.append("manifest must not contain secret-bearing fields")
    return errors


def _validate_case(case: dict[str, Any], index: int, errors: list[str]) -> None:
    label = f"cases[{index}]"
    case_id = case.get("case_id")
    if case.get("shots") != EXPECTED_CASE_SHOTS.get(case_id):
        errors.append(f"{label}.shots does not match the frozen case budget")
    if case.get("formal_holdout_eligible") is not False:
        errors.append(f"{label}.formal_holdout_eligible must be false")
    if tuple(case.get("delay_grid_dt", ())) != EXPECTED_CASE_DELAY_GRIDS.get(case_id, ()):
        errors.append(f"{label}.delay_grid_dt does not match the frozen grid")
    circuit = case.get("circuit")
    if not isinstance(circuit, list) or not circuit:
        errors.append(f"{label}.circuit must be non-empty")
        return
    for operation_index, operation in enumerate(circuit):
        if not isinstance(operation, dict):
            errors.append(f"{label}.circuit[{operation_index}] must be an object")
            continue
        gate_type = operation.get("type")
        if gate_type not in ALLOWED_GATE_TYPES:
            errors.append(f"{label}.circuit[{operation_index}] has unsupported gate type")
        for field in ("targets", "controls"):
            values = operation.get(field, [])
            if not isinstance(values, list) or any(
                not isinstance(value, int) or value < 0 or value > 1
                for value in values
            ):
                errors.append(f"{label}.circuit[{operation_index}].{field} is invalid")
        if gate_type == "CNOT":
            if operation.get("controls") != [0] or operation.get("targets") != [1]:
                errors.append(f"{label}.circuit[{operation_index}] CNOT must be control 0 target 1")


def _require_positive_int(payload: dict[str, Any], key: str, errors: list[str]) -> None:
    value = payload.get(key)
    if not isinstance(value, int) or value <= 0:
        errors.append(f"execution_policy.{key} must be a positive integer")


def _contains_forbidden_secret_key(value: Any) -> bool:
    if isinstance(value, dict):
        return any(
            str(key).lower() in FORBIDDEN_SECRET_KEYS
            or _contains_forbidden_secret_key(child)
            for key, child in value.items()
        )
    if isinstance(value, list):
        return any(_contains_forbidden_secret_key(child) for child in value)
    return False
