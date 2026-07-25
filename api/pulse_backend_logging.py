"""Structured runtime logging for Pulse API backend selection."""

from __future__ import annotations

import logging
from typing import Literal


LOGGER = logging.getLogger(__name__)


def log_pulse_backend_selection(
    *,
    model_id: str,
    requested: Literal["python", "rust", "auto"],
    resolved: Literal["python", "rust"],
) -> None:
    """Record which execution backend served a Pulse API request."""

    LOGGER.info(
        "pulse_backend_selected",
        extra={
            "pulse_backend": {
                "model_id": model_id,
                "requested": requested,
                "resolved": resolved,
                "fallback_used": requested == "auto" and resolved == "python",
            }
        },
    )
