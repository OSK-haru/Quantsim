"""Generate the canonical C10 explicit-CPTP freeze artifact."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_cptp.model_freeze import write_freeze_report


def main() -> int:
    args = _parse_args()
    report = write_freeze_report(args.output_path)
    print(
        "validation | CPTP-MODEL-FREEZE-C10 | "
        f"decision={report['decision']} | "
        f"overall_pass={report['overall_pass']}"
    )
    print(
        "freeze_id | "
        f"{report['frozen_contract']['freeze_id']} | "
        f"{args.output_path}"
    )
    print(
        "critical_source_tree_sha256 | "
        f"{report['source_revision']['critical_source_tree_sha256']}"
    )
    return 0 if report["overall_pass"] else 1


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-path",
        type=Path,
        default=ROOT
        / "validation_results"
        / "cptp_model_freeze.json",
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
