"""Windows-friendly local launcher for the built QuantaScope application.

The launcher serves the Vite build and the FastAPI endpoints from one local
address, then opens the default browser. It is intentionally free of external
network calls so a packaged submission can run without API keys.
"""

from __future__ import annotations

import argparse
import logging
import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

# PyInstaller's windowed bootloader sets these streams to None. Uvicorn and
# some dependencies expect file-like objects during startup.
if sys.stdin is None:
    sys.stdin = open(os.devnull, "r", encoding="utf-8")
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

import uvicorn
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api.main import app


def configure_launcher_logging() -> None:
    """Keep diagnostics available when the packaged app has no console."""

    log_root = Path(os.environ.get("LOCALAPPDATA", resource_root())) / "QuantaScope"
    log_root.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=log_root / "launcher.log",
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        force=True,
    )


def resource_root() -> Path:
    """Resolve the source root or the PyInstaller extraction directory."""

    frozen_root = getattr(sys, "_MEIPASS", None)
    if frozen_root:
        return Path(frozen_root)
    return Path(__file__).resolve().parent


def find_available_port(host: str, preferred_port: int) -> int:
    for port in range(preferred_port, preferred_port + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError("No local port is available for QuantaScope.")


def configure_static_ui(ui_directory: Path) -> None:
    if not ui_directory.is_dir():
        raise RuntimeError(
            "The built frontend is missing. Run `npm.cmd run build` in frontend first."
        )

    assets_directory = ui_directory / "assets"
    if not assets_directory.is_dir():
        raise RuntimeError("The built frontend assets directory is missing.")

    app.mount("/assets", StaticFiles(directory=assets_directory), name="desktop-assets")

    @app.get("/{requested_path:path}", include_in_schema=False)
    def desktop_spa(requested_path: str) -> FileResponse:
        if requested_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found.")

        candidate = ui_directory / requested_path
        if requested_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(ui_directory / "index.html")


def open_when_ready(url: str, host: str, port: int) -> None:
    def wait_for_server() -> None:
        for _ in range(100):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.settimeout(0.1)
                if probe.connect_ex((host, port)) == 0:
                    webbrowser.open(url)
                    return
            time.sleep(0.1)

    threading.Thread(target=wait_for_server, daemon=True).start()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    configure_launcher_logging()
    logging.info("Starting QuantaScope desktop launcher.")
    ui_directory = resource_root() / "frontend" / "dist"
    configure_static_ui(ui_directory)
    port = find_available_port(args.host, args.port)
    url = f"http://{args.host}:{port}/"
    if not args.no_browser:
        open_when_ready(url, args.host, port)

    server = uvicorn.Server(
        uvicorn.Config(
            app,
            host=args.host,
            port=port,
            log_config=None,
            access_log=False,
        )
    )
    logging.info("Serving QuantaScope at %s", url)
    server.run()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        logging.exception("QuantaScope desktop launcher failed.")
        raise
