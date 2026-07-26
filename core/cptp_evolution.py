"""Checkpointed explicit-CPTP evolution for Pulse API integration."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from core.cptp_piecewise import (
    PIECEWISE_SAMPLING_ID,
    TimeDependentHamiltonian,
    piecewise_gksl_exponential_map,
)
from core.cptp_rust import rust_piecewise_gksl_exponential_map
from core.gates import CachedCollapseOperator, Matrix
from core.pulse_evolution import (
    PhysicalityMetrics,
    TimeDependentCheckpoint,
    TimeDependentEvolutionDiagnostics,
    TimeDependentEvolutionResult,
    physicality_metrics,
)


CPTPEvolutionBackend = Literal["python", "rust"]
TIME_TOLERANCE_US = 1e-15
EXPLICIT_CPTP_EVOLUTION_ID = "explicit_cptp_midpoint_gksl_v1"


@dataclass(frozen=True)
class CPTPSegmentAudit:
    """Aggregate the Choi audits used to produce one sampled segment."""

    map_count: int
    interval_count: int
    minimum_choi_eigenvalue: float
    maximum_trace_preservation_frobenius_error: float
    maximum_trace_preservation_max_abs_error: float
    all_maps_cptp: bool
    cleanup_applied: bool = False
    sampling_id: str = PIECEWISE_SAMPLING_ID

    def to_dict(self) -> dict[str, bool | float | int | str]:
        return {
            "map_count": self.map_count,
            "interval_count": self.interval_count,
            "minimum_choi_eigenvalue": self.minimum_choi_eigenvalue,
            "maximum_trace_preservation_frobenius_error": (
                self.maximum_trace_preservation_frobenius_error
            ),
            "maximum_trace_preservation_max_abs_error": (
                self.maximum_trace_preservation_max_abs_error
            ),
            "all_maps_cptp": self.all_maps_cptp,
            "cleanup_applied": self.cleanup_applied,
            "sampling_id": self.sampling_id,
        }


@dataclass(frozen=True)
class CPTPEvolutionResult:
    """Existing trajectory-compatible result plus explicit channel audit."""

    evolution: TimeDependentEvolutionResult
    audit: CPTPSegmentAudit


@dataclass(frozen=True)
class _OffsetHamiltonian:
    provider: TimeDependentHamiltonian
    offset_us: float

    def evaluate(self, local_time_us: float) -> Matrix:
        return self.provider.evaluate(self.offset_us + local_time_us)


def evolve_cptp_segment(
    state: Matrix,
    hamiltonian: TimeDependentHamiltonian,
    collapse_ops: Sequence[CachedCollapseOperator],
    duration_us: float,
    max_step_us: float,
    *,
    checkpoint_times_us: Sequence[float] = (),
    backend: CPTPEvolutionBackend = "python",
) -> CPTPEvolutionResult:
    """Evolve to requested checkpoints using audited GKSL exponentials.

    Each interval between output checkpoints is independently composed and
    Choi-audited. No density-matrix cleanup is performed.
    """

    duration = _positive_finite(duration_us, "duration_us")
    max_step = _positive_finite(max_step_us, "max_step_us")
    if backend not in ("python", "rust"):
        raise ValueError("backend must be 'python' or 'rust'")
    checkpoints = _normalize_checkpoint_times(
        checkpoint_times_us,
        duration,
    )
    collapse_matrices = tuple(item.operator for item in collapse_ops)

    evolved = state
    current_time = 0.0
    recorded: list[TimeDependentCheckpoint] = []
    step_sizes: list[float] = []
    map_audits = []
    interval_audits = []
    maximum_trace_error = 0.0
    maximum_hermiticity_error = 0.0
    minimum_eigenvalue = math.inf

    if checkpoints[0] == 0.0:
        metrics = physicality_metrics(state)
        recorded.append(_checkpoint(0.0, state, metrics))

    for boundary in checkpoints:
        if boundary <= current_time + TIME_TOLERANCE_US:
            continue
        block_duration = boundary - current_time
        provider = _OffsetHamiltonian(hamiltonian, current_time)
        if backend == "rust":
            channel = rust_piecewise_gksl_exponential_map(
                provider,
                collapse_matrices,
                block_duration,
                max_step,
                name="pulse_api_cptp_segment",
            )
        else:
            channel = piecewise_gksl_exponential_map(
                provider,
                collapse_matrices,
                block_duration,
                max_step,
                name="pulse_api_cptp_segment",
            )
        evolved = channel.apply(evolved)
        metrics = physicality_metrics(evolved)
        maximum_trace_error = max(maximum_trace_error, metrics.trace_error)
        maximum_hermiticity_error = max(
            maximum_hermiticity_error,
            metrics.hermiticity_error,
        )
        minimum_eigenvalue = min(
            minimum_eigenvalue,
            metrics.minimum_eigenvalue,
        )
        recorded.append(_checkpoint(boundary, evolved, metrics))
        step_sizes.extend(
            interval.duration_us for interval in channel.intervals
        )
        map_audits.append(channel.audit)
        interval_audits.extend(
            interval.channel.audit for interval in channel.intervals
        )
        current_time = boundary

    if not step_sizes:
        raise RuntimeError("CPTP evolution produced no intervals")
    all_audits = (*map_audits, *interval_audits)
    diagnostics = TimeDependentEvolutionDiagnostics(
        internal_step_count=len(step_sizes),
        rhs_evaluation_count=0,
        hamiltonian_evaluation_count=len(step_sizes),
        minimum_internal_step_us=min(step_sizes),
        maximum_internal_step_us=max(step_sizes),
        raw_trace_error=maximum_trace_error,
        raw_hermiticity_error=maximum_hermiticity_error,
        raw_minimum_eigenvalue=minimum_eigenvalue,
        cleanup_correction_norm=0.0,
        actual_duration_us=current_time,
    )
    return CPTPEvolutionResult(
        evolution=TimeDependentEvolutionResult(
            state=evolved,
            raw_final_state=evolved,
            checkpoints=tuple(recorded),
            diagnostics=diagnostics,
        ),
        audit=CPTPSegmentAudit(
            map_count=len(map_audits),
            interval_count=len(step_sizes),
            minimum_choi_eigenvalue=min(
                audit.choi_minimum_eigenvalue for audit in all_audits
            ),
            maximum_trace_preservation_frobenius_error=max(
                audit.trace_preservation_frobenius_error
                for audit in all_audits
            ),
            maximum_trace_preservation_max_abs_error=max(
                audit.trace_preservation_max_abs_error
                for audit in all_audits
            ),
            all_maps_cptp=all(audit.is_cptp for audit in all_audits),
        ),
    )


def _checkpoint(
    time_us: float,
    state: Matrix,
    metrics: PhysicalityMetrics,
) -> TimeDependentCheckpoint:
    return TimeDependentCheckpoint(
        time_us=time_us,
        raw_state=state,
        cleaned_state=state,
        raw_physicality=metrics,
        cleanup_correction_norm=0.0,
    )


def _normalize_checkpoint_times(
    values: Sequence[float],
    duration_us: float,
) -> tuple[float, ...]:
    normalized: list[float] = []
    previous = -math.inf
    for index, value in enumerate(values):
        time_us = float(value)
        if not math.isfinite(time_us):
            raise ValueError(
                f"checkpoint_times_us[{index}] must be finite"
            )
        if time_us < 0.0 or time_us > duration_us:
            raise ValueError(
                "checkpoint times must be within the segment duration"
            )
        if time_us <= previous:
            raise ValueError(
                "checkpoint_times_us must be strictly increasing"
            )
        normalized.append(time_us)
        previous = time_us
    if not normalized or normalized[-1] != duration_us:
        normalized.append(duration_us)
    return tuple(normalized)


def _positive_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted <= 0.0:
        raise ValueError(f"{field_name} must be finite and positive")
    return converted
