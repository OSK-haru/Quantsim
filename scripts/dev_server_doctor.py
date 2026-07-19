"""python scripts/dev_server_doctor.py

Small local development server diagnostic for QuantaScope.
"""

from __future__ import annotations

import socket
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


SOCKET_TIMEOUT_SECONDS = 1.0
HTTP_TIMEOUT_SECONDS = 2.0


@dataclass(frozen=True)
class PortCheck:
    port: int
    reachable: bool


@dataclass(frozen=True)
class HealthCheck:
    name: str
    url: str
    ok: bool
    detail: str


def check_port(port: int) -> PortCheck:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=SOCKET_TIMEOUT_SECONDS):
            return PortCheck(port=port, reachable=True)
    except OSError:
        return PortCheck(port=port, reachable=False)


def check_health(name: str, url: str) -> HealthCheck:
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace").strip()
            if response.status == 200 and '"status"' in body and '"ok"' in body:
                return HealthCheck(name=name, url=url, ok=True, detail="ok")
            return HealthCheck(
                name=name,
                url=url,
                ok=False,
                detail=f"unexpected response {response.status}",
            )
    except urllib.error.HTTPError as error:
        return HealthCheck(
            name=name,
            url=url,
            ok=False,
            detail=f"http {error.code}",
        )
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", error)
        return HealthCheck(name=name, url=url, ok=False, detail=str(reason))
    except OSError as error:
        return HealthCheck(name=name, url=url, ok=False, detail=str(error))


def build_recommendation(
    port_8001: PortCheck,
    port_8000: PortCheck,
    port_5173: PortCheck,
    api_health: HealthCheck,
    vite_proxy_health: HealthCheck,
) -> str:
    if api_health.ok and vite_proxy_health.ok:
        return "FastAPI is running and the Vite proxy is connected to it."
    if port_5173.reachable and not vite_proxy_health.ok and api_health.ok:
        return "Vite is reachable but the proxy health check failed. The Vite proxy may be misconfigured or Vite should be restarted."
    if port_8001.reachable and not api_health.ok:
        return "Port 8001 is reachable but /api/health did not return ok. Something other than the QuantaScope API may be using port 8001."
    if port_8000.reachable and not api_health.ok:
        return "Port 8000 is reachable but /api/health did not return ok. Something other than the QuantaScope API may be using port 8000."
    if not port_8001.reachable and not port_8000.reachable and not port_5173.reachable:
        return "Both dev servers appear stopped."
    if api_health.ok:
        return "FastAPI is running. Start or restart Vite if the frontend is not reaching it."
    if port_5173.reachable and not port_8000.reachable:
        return "Vite appears to be running without FastAPI. API-backed views should fall back to fixture data."
    return "Server checks completed. If fallback testing is desired, FastAPI must be stopped and /api/health must fail."


def main() -> int:
    try:
        port_8001 = check_port(8001)
        port_8000 = check_port(8000)
        port_5173 = check_port(5173)
        api_health = check_health("Direct API health", "http://127.0.0.1:8001/api/health")
        vite_proxy_health = check_health("Vite proxy health", "http://127.0.0.1:5173/api/health")

        print("QuantaScope Dev Server Doctor")
        print(f"Port 8001: {'reachable' if port_8001.reachable else 'not reachable'}")
        print(f"Port 8000: {'reachable' if port_8000.reachable else 'not reachable'}")
        print(f"Port 5173: {'reachable' if port_5173.reachable else 'not reachable'}")
        print(
            f"Direct API health: {'ok' if api_health.ok else 'failed'}"
            f" ({api_health.detail})"
        )
        print(
            f"Vite proxy health: {'ok' if vite_proxy_health.ok else 'failed'}"
            f" ({vite_proxy_health.detail})"
        )
        print(
            "Recommendation: "
            + build_recommendation(
                port_8001,
                port_8000,
                port_5173,
                api_health,
                vite_proxy_health,
            )
        )
        if not api_health.ok:
            print(
                "Fallback testing note: FastAPI must be stopped and /api/health must fail."
            )
        return 0
    except Exception as error:  # pragma: no cover - defensive CLI guard
        print(f"Unexpected error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
