from __future__ import annotations

from typing import Iterable

import streamlit as st

from core.errors import ValidationIssue


def render_error_display(
    issues: Iterable[ValidationIssue] | None = None,
    warnings: Iterable[str] | None = None,
) -> None:
    messages = [_beginner_message(issue) for issue in issues or []]
    messages.extend(str(warning) for warning in warnings or [])

    if not messages:
        return

    for message in messages:
        st.warning(message)


def _beginner_message(issue: ValidationIssue) -> str:
    if issue.suggestion:
        return f"{issue.message} {issue.suggestion}"
    return issue.message
