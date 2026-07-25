"""Audit local Markdown links in the canonical Pulse Extension B documents."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
LINK_PATTERN = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")


def main() -> int:
    args = _parse_args()
    documents = _documents()
    broken: list[dict[str, str]] = []
    checked = 0
    for document in documents:
        text = document.read_text(encoding="utf-8")
        for raw_target in LINK_PATTERN.findall(text):
            target = raw_target.strip().split(maxsplit=1)[0].strip("<>")
            if (
                not target
                or target.startswith("#")
                or "://" in target
                or target.startswith("mailto:")
            ):
                continue
            relative_target = unquote(target.split("#", 1)[0])
            checked += 1
            resolved = (document.parent / relative_target).resolve()
            if not resolved.exists():
                broken.append(
                    {
                        "document": document.relative_to(ROOT).as_posix(),
                        "target": target,
                    }
                )
    report = {
        "validation": "PULSE-EXTENSION-B-MARKDOWN-LINKS",
        "document_count": len(documents),
        "local_link_count": checked,
        "broken_links": broken,
        "overall_pass": not broken,
    }
    args.output_path.parent.mkdir(parents=True, exist_ok=True)
    args.output_path.write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        "markdown links | "
        f"documents={len(documents)} | "
        f"local_links={checked} | "
        f"broken={len(broken)} | "
        f"pass={not broken}"
    )
    for item in broken:
        print(f"broken | {item['document']} -> {item['target']}")
    return 0 if not broken else 1


def _documents() -> list[Path]:
    patterns = (
        "docs/README.md",
        "docs/development/pulse-extension-b/*.md",
        "docs/development/physical-model-finalization/*.md",
        "docs/requirements/quantascope_physical_model_finalization_plan.md",
        "docs/physics/pulse-extension-b-*.md",
        "docs/architecture/pulse-api-contract.md",
        "docs/validation/pulse-b-*.md",
        "docs/validation/pulse-extension-b-report.md",
        "frontend/README.md",
    )
    return sorted(
        {
            path
            for pattern in patterns
            for path in ROOT.glob(pattern)
            if path.is_file()
        }
    )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output-path",
        type=Path,
        default=(
            ROOT
            / "validation_results"
            / "pulse_extension_b_markdown_links.json"
        ),
    )
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
