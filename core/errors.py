"""Standard validation issue shape for core API callers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ValidationIssue:
    """A config or numerical issue that UI/export layers can display safely."""

    level: str
    code: str
    message: str
    detail: str | None = None
    suggestion: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "level": self.level,
            "code": self.code,
            "message": self.message,
            "detail": self.detail,
            "suggestion": self.suggestion,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ValidationIssue":
        return cls(
            level=str(data["level"]),
            code=str(data["code"]),
            message=str(data["message"]),
            detail=data.get("detail"),
            suggestion=data.get("suggestion"),
        )
