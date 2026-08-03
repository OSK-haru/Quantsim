"""Validate the Phase 3B pilot manifest without network access."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "validation_hardware" / "phase3b_pilot_manifest.json"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_hardware.pilot_manifest import load_and_validate_pilot_manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", nargs="?", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--dry-run", action="store_true", help="print the bounded plan")
    args = parser.parse_args()
    manifest = load_and_validate_pilot_manifest(args.manifest)
    policy = manifest["execution_policy"]
    print(f"VALID {manifest['manifest_id']}")
    if args.dry_run:
        print("NETWORK: disabled")
        print(f"CASES: {len(manifest['cases'])}")
        print(f"CIRCUITS: {policy['total_circuits_max']} maximum")
        print(f"SHOTS: {policy['total_shots_max']} maximum")
        print(f"JOBS: {policy['jobs_max']} maximum")
        print(f"RETRY: {policy['retry_max']} maximum")
        print(f"TIMEOUT: {policy['timeout_minutes']} minutes per job")
        print(f"SOURCE: {manifest['source_revision']['freeze_tag']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
