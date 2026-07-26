"""Piecewise-constant CPTP evolution for time-dependent GKSL segments."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np

from core.cptp import (
    DEFAULT_CP_TOLERANCE,
    DEFAULT_TP_TOLERANCE,
    ChoiAudit,
    audit_choi_matrix,
)
from core.cptp_liouvillian import (
    GKSLExponentialMap,
    apply_superoperator,
    gksl_exponential_map,
    superoperator_to_choi,
)
from core.gates import Matrix


PIECEWISE_SAMPLING_ID = "midpoint_piecewise_constant_v1"


class TimeDependentHamiltonian(Protocol):
    """Provide a Hamiltonian in rad/us at a local segment time."""

    def evaluate(self, local_time_us: float) -> Matrix:
        """Return the Hamiltonian at the requested local time."""


@dataclass(frozen=True)
class PiecewiseGKSLInterval:
    """One midpoint-frozen interval and its audited exponential map."""

    index: int
    start_time_us: float
    end_time_us: float
    sample_time_us: float
    channel: GKSLExponentialMap

    @property
    def duration_us(self) -> float:
        return self.end_time_us - self.start_time_us

    def to_metadata(self) -> dict[str, object]:
        return {
            "index": self.index,
            "start_time_us": self.start_time_us,
            "end_time_us": self.end_time_us,
            "sample_time_us": self.sample_time_us,
            "duration_us": self.duration_us,
            "vectorization_id": self.channel.vectorization_id,
            "exponential_method": self.channel.exponential_method,
            "audit": self.channel.audit.to_dict(),
        }


@dataclass(frozen=True)
class PiecewiseGKSLMap:
    """Time-ordered composition of midpoint-frozen GKSL intervals."""

    name: str
    dimension: int
    duration_us: float
    max_interval_us: float
    intervals: tuple[PiecewiseGKSLInterval, ...]
    superoperator: Matrix
    choi_matrix: Matrix
    audit: ChoiAudit
    sampling_id: str = PIECEWISE_SAMPLING_ID

    def apply(self, state: Matrix) -> Matrix:
        """Apply the composed map without density-matrix cleanup."""

        return apply_superoperator(
            self.superoperator,
            state,
            self.dimension,
        )

    def to_metadata(self) -> dict[str, object]:
        durations = tuple(interval.duration_us for interval in self.intervals)
        return {
            "name": self.name,
            "dimension": self.dimension,
            "duration_us": self.duration_us,
            "max_interval_us": self.max_interval_us,
            "sampling_id": self.sampling_id,
            "interval_count": len(self.intervals),
            "minimum_interval_us": min(durations),
            "maximum_interval_us": max(durations),
            "intervals": [
                interval.to_metadata() for interval in self.intervals
            ],
            "audit": self.audit.to_dict(),
        }


def piecewise_gksl_exponential_map(
    hamiltonian: TimeDependentHamiltonian,
    collapse_operators: Sequence[Matrix],
    duration_us: float,
    max_interval_us: float,
    *,
    name: str = "piecewise_time_dependent_gksl",
    cp_tolerance: float = DEFAULT_CP_TOLERANCE,
    tp_tolerance: float = DEFAULT_TP_TOLERANCE,
) -> PiecewiseGKSLMap:
    """Compose midpoint-frozen GKSL exponentials in execution order."""

    duration = _positive_finite(duration_us, "duration_us")
    max_interval = _positive_finite(
        max_interval_us,
        "max_interval_us",
    )
    boundaries = piecewise_interval_boundaries(duration, max_interval)
    intervals: list[PiecewiseGKSLInterval] = []
    composed: np.ndarray | None = None
    dimension: int | None = None

    for index, (start_time, end_time) in enumerate(boundaries):
        sample_time = start_time + 0.5 * (end_time - start_time)
        interval_map = gksl_exponential_map(
            hamiltonian.evaluate(sample_time),
            collapse_operators,
            end_time - start_time,
            name=f"{name}_interval_{index}",
            cp_tolerance=cp_tolerance,
            tp_tolerance=tp_tolerance,
        )
        if dimension is None:
            dimension = interval_map.dimension
            composed = np.eye(
                dimension * dimension,
                dtype=np.complex128,
            )
        elif interval_map.dimension != dimension:
            raise ValueError(
                "hamiltonian dimension must remain constant across intervals"
            )

        interval_superoperator = np.asarray(
            interval_map.superoperator,
            dtype=np.complex128,
        )
        composed = interval_superoperator @ composed
        intervals.append(PiecewiseGKSLInterval(
            index=index,
            start_time_us=start_time,
            end_time_us=end_time,
            sample_time_us=sample_time,
            channel=interval_map,
        ))

    if dimension is None or composed is None:
        raise RuntimeError("piecewise evolution produced no intervals")

    superoperator = _to_matrix(composed)
    choi = superoperator_to_choi(superoperator, dimension)
    audit = audit_choi_matrix(
        choi,
        dimension,
        cp_tolerance=cp_tolerance,
        tp_tolerance=tp_tolerance,
    )
    if not audit.is_cptp:
        raise RuntimeError(
            "composed piecewise GKSL map failed the configured CPTP audit"
        )

    return PiecewiseGKSLMap(
        name=name,
        dimension=dimension,
        duration_us=duration,
        max_interval_us=max_interval,
        intervals=tuple(intervals),
        superoperator=superoperator,
        choi_matrix=choi,
        audit=audit,
    )


def piecewise_interval_boundaries(
    duration_us: float,
    max_interval_us: float,
) -> tuple[tuple[float, float], ...]:
    """Return ordered intervals covering one positive segment exactly."""

    ratio = duration_us / max_interval_us
    nearest_integer = round(ratio)
    if math.isclose(
        ratio,
        nearest_integer,
        rel_tol=1e-12,
        abs_tol=1e-12,
    ):
        interval_count = max(1, int(nearest_integer))
    else:
        interval_count = max(1, math.ceil(ratio))

    return tuple(
        (
            index * max_interval_us,
            (
                duration_us
                if index == interval_count - 1
                else (index + 1) * max_interval_us
            ),
        )
        for index in range(interval_count)
    )


def _positive_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted <= 0.0:
        raise ValueError(f"{field_name} must be finite and positive")
    return converted


def _to_matrix(array: np.ndarray) -> Matrix:
    return tuple(
        tuple(complex(value) for value in row)
        for row in array
    )
