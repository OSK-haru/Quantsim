"""Generate the coupled-transmon QuTiP numerical-audit artifacts."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from validation_pulse.transmon_pair_qutip import run_pair_qutip_audit


DEFAULT_JSON = ROOT / "validation_results" / "pulse_transmon_pair_qutip_audit.json"
DEFAULT_CSV = ROOT / "validation_results" / "pulse_transmon_pair_qutip_audit.csv"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-output", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--csv-output", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()

    report, rows = run_pair_qutip_audit()
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    fieldnames = sorted({key for row in rows for key in row})
    with args.csv_output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(json.dumps({
        "pass": report["pass"],
        "case_count": report["case_count"],
        "checkpoint_count": report["checkpoint_count"],
        "maximum_errors": report["maximum_errors"],
        "json_output": str(args.json_output),
        "csv_output": str(args.csv_output),
    }, ensure_ascii=False, indent=2))
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
