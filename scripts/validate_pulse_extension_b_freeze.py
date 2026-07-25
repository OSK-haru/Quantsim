"""Write the consolidated Pulse Extension B freeze artifact."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_pulse.extension_b_freeze import write_freeze_report


def main() -> int:
    args = _parse_args()
    report = write_freeze_report(args.output_path)
    print(
        "validation | PULSE-EXTENSION-B-FREEZE | "
        f"decision={report['decision']} | "
        f"overall_pass={report['overall_pass']}"
    )
    print(
        "artifacts | "
        f"{len(report['artifact_audit'])} validation files | "
        f"{len(report['document_audit'])} documents"
    )
    print(
        "pulse_openapi_contract_sha256 | "
        f"{report['qutrit_api_audit']['openapi_contract_sha256']}"
    )
    print(f"output | {args.output_path}")
    return 0 if report["overall_pass"] else 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-path",
        type=Path,
        default=(
            ROOT
            / "validation_results"
            / "pulse_extension_b_freeze.json"
        ),
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
