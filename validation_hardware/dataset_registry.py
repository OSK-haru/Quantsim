"""Validate the frozen Phase 3B hardware-dataset registry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REGISTRY_SCHEMA_VERSION = 1
REGISTRY_ID = "phase3b_hardware_dataset_registry_v1"
PRIMARY_DATASET_ID = "quantascope_hardware_audit_dataset_v1"
FORBIDDEN_SECRET_KEYS = {
    "api_key",
    "password",
    "secret",
    "token",
    "credentials",
}
REQUIRED_PROVENANCE_FIELDS = {
    "provider",
    "device_id",
    "job_id",
    "execution_started_at_utc",
    "execution_finished_at_utc",
    "calibration_snapshot_at_utc",
    "backend_properties",
    "compiled_circuit",
    "qubit_mapping",
    "shot_count",
    "raw_counts",
    "software_versions",
    "quantascope_commit",
}


def load_and_validate_registry(
    path: str | Path,
) -> dict[str, Any]:
    """Load a registry JSON file and reject incomplete audit contracts."""

    registry_path = Path(path)
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    errors = validate_registry(payload)
    if errors:
        raise ValueError(
            "invalid Phase 3B dataset registry:\n- "
            + "\n- ".join(errors)
        )
    return payload


def validate_registry(payload: dict[str, Any]) -> list[str]:
    """Return all contract errors without mutating the registry."""

    errors: list[str] = []
    if payload.get("schema_version") != REGISTRY_SCHEMA_VERSION:
        errors.append("unsupported schema_version")
    if payload.get("registry_id") != REGISTRY_ID:
        errors.append("unexpected registry_id")

    primary = payload.get("primary_dataset")
    if not isinstance(primary, dict):
        errors.append("primary_dataset must be an object")
        return errors
    if primary.get("dataset_id") != PRIMARY_DATASET_ID:
        errors.append("unexpected primary dataset_id")
    if primary.get("status") != "selected_collection_not_started":
        errors.append("primary dataset must remain uncollected at contract freeze")
    if not primary.get("provider_documentation"):
        errors.append("primary dataset requires provider documentation")

    provenance = set(primary.get("required_provenance_fields", []))
    missing_provenance = REQUIRED_PROVENANCE_FIELDS - provenance
    if missing_provenance:
        errors.append(
            "missing provenance fields: "
            + ", ".join(sorted(missing_provenance))
        )

    splits = primary.get("data_splits", {})
    calibration = set(splits.get("calibration_case_ids", []))
    holdout = set(splits.get("holdout_case_ids", []))
    if not calibration or not holdout:
        errors.append("calibration and holdout case lists must be non-empty")
    overlap = calibration & holdout
    if overlap:
        errors.append(
            "calibration and holdout overlap: "
            + ", ".join(sorted(overlap))
        )
    if splits.get("pilot_reusable_as_formal_holdout") is not False:
        errors.append("pilot data must not be reusable as formal holdout")

    external = payload.get("external_evidence_datasets")
    if not isinstance(external, list) or len(external) < 2:
        errors.append("at least two external evidence datasets are required")
    else:
        roles = set()
        for index, dataset in enumerate(external):
            label = f"external_evidence_datasets[{index}]"
            if not dataset.get("doi"):
                errors.append(f"{label} requires a DOI")
            if not dataset.get("role"):
                errors.append(f"{label} requires a distinct evidence role")
            else:
                roles.add(dataset["role"])
            if not dataset.get("source_files"):
                errors.append(f"{label} requires checksummed source files")
            for source_file in dataset.get("source_files", []):
                if not source_file.get("checksum"):
                    errors.append(f"{label} contains a file without checksum")
            rights = dataset.get("rights", {})
            if rights.get("redistribution_allowed") is True and not rights.get(
                "license_id"
            ):
                errors.append(
                    f"{label} allows redistribution without a license_id"
                )
        if len(roles) != len(external):
            errors.append("external evidence roles must be distinct")

    if _find_forbidden_secret_keys(payload):
        errors.append("registry must not contain secret-bearing fields")
    return errors


def _find_forbidden_secret_keys(value: Any) -> bool:
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in FORBIDDEN_SECRET_KEYS:
                return True
            if _find_forbidden_secret_keys(child):
                return True
    elif isinstance(value, list):
        return any(_find_forbidden_secret_keys(child) for child in value)
    return False
