r"""Regenerate the application icons from frontend/public/favicon.svg.

The favicon SVG is the single source of truth for the Yuragi-Strider mark.
This script rasterises it once at high resolution with headless Chrome, then
derives every raster artefact the web app and the Windows package need:

    frontend/public/favicon.ico          browser tab fallback (16/32/48)
    frontend/public/apple-touch-icon.png iOS home screen
    frontend/public/icon-192.png         PWA / Android
    frontend/public/icon-512.png         PWA / Android
    packaging/windows/yuragi-strider.ico embedded in both Windows executables

Run after changing the mark:

    .\.venv\Scripts\python.exe scripts\generate_app_icons.py
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
SOURCE_SVG = REPOSITORY_ROOT / "frontend" / "public" / "favicon.svg"
PUBLIC_DIRECTORY = REPOSITORY_ROOT / "frontend" / "public"
WINDOWS_ICON = REPOSITORY_ROOT / "packaging" / "windows" / "yuragi-strider.ico"

MASTER_SIZE = 512
WEB_ICO_SIZES = [(16, 16), (32, 32), (48, 48)]
WINDOWS_ICO_SIZES = [
    (16, 16),
    (20, 20),
    (24, 24),
    (32, 32),
    (40, 40),
    (48, 48),
    (64, 64),
    (96, 96),
    (128, 128),
    (256, 256),
]
PNG_OUTPUTS = [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]

CHROME_CANDIDATES = [
    Path(r"C:/Program Files/Google/Chrome/Application/chrome.exe"),
    Path(r"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
    Path(r"C:/Program Files/Microsoft/Edge/Application/msedge.exe"),
]


def locate_browser(explicit: str | None) -> Path:
    if explicit:
        candidate = Path(explicit)
        if not candidate.is_file():
            raise SystemExit(f"Browser not found: {candidate}")
        return candidate
    for candidate in CHROME_CANDIDATES:
        if candidate.is_file():
            return candidate
    for name in ("chrome", "msedge", "chromium"):
        found = shutil.which(name)
        if found:
            return Path(found)
    raise SystemExit(
        "A Chromium-based browser is required to rasterise the SVG. "
        "Pass one explicitly with --browser."
    )


def rasterise(browser: Path, svg: Path, destination: Path) -> Image.Image:
    """Render the SVG at MASTER_SIZE using headless Chrome."""
    scale = MASTER_SIZE // 64
    subprocess.run(
        [
            str(browser),
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--force-device-scale-factor={scale}",
            f"--screenshot={destination}",
            "--window-size=64,64",
            svg.resolve().as_uri(),
        ],
        check=True,
        capture_output=True,
    )
    if not destination.is_file():
        raise SystemExit("Headless rendering produced no output.")
    image = Image.open(destination).convert("RGBA")
    if image.size != (MASTER_SIZE, MASTER_SIZE):
        raise SystemExit(f"Expected a {MASTER_SIZE}px master, got {image.size}.")
    return image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", help="Path to a Chromium-based browser.")
    arguments = parser.parse_args()

    if not SOURCE_SVG.is_file():
        raise SystemExit(f"Source SVG is missing: {SOURCE_SVG}")

    browser = locate_browser(arguments.browser)

    with tempfile.TemporaryDirectory() as temporary:
        master_path = Path(temporary) / "master.png"
        master = rasterise(browser, SOURCE_SVG, master_path)

        for size, name in PNG_OUTPUTS:
            master.resize((size, size), Image.LANCZOS).save(PUBLIC_DIRECTORY / name)
            print(f"wrote {PUBLIC_DIRECTORY / name}")

        master.save(PUBLIC_DIRECTORY / "favicon.ico", sizes=WEB_ICO_SIZES)
        print(f"wrote {PUBLIC_DIRECTORY / 'favicon.ico'}")

        WINDOWS_ICON.parent.mkdir(parents=True, exist_ok=True)
        master.save(WINDOWS_ICON, sizes=WINDOWS_ICO_SIZES)
        print(f"wrote {WINDOWS_ICON}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
