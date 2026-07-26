"""Audited Rust-backed CPTP maps with the frozen Python contracts."""

from __future__ import annotations

import math
from collections.abc import Sequence

from core.cptp import (
    DEFAULT_CP_TOLERANCE,
    DEFAULT_TP_TOLERANCE,
    audit_choi_matrix,
)
from core.cptp_liouvillian import (
    GKSLExponentialMap,
    superoperator_to_choi,
)
from core.cptp_piecewise import (
    PiecewiseGKSLInterval,
    PiecewiseGKSLMap,
    TimeDependentHamiltonian,
    piecewise_interval_boundaries,
)
from core.gates import Matrix
from core.rust_dense_kernel import (
    rust_gksl_exponential_superoperator,
    rust_gksl_piecewise_superoperator,
)


RUST_EXPONENTIAL_METHOD = "scaling_squaring_pade13_rust_v1"


def rust_gksl_exponential_map(
    hamiltonian: Matrix,
    collapse_operators: Sequence[Matrix],
    duration_us: float,
    *,
    name: str = "rust_time_independent_gksl_exponential",
    cp_tolerance: float = DEFAULT_CP_TOLERANCE,
    tp_tolerance: float = DEFAULT_TP_TOLERANCE,
) -> GKSLExponentialMap:
    """Construct a Rust-backed map and audit it with the frozen Choi path."""

    duration = _nonnegative_finite(duration_us, "duration_us")
    superoperator = rust_gksl_exponential_superoperator(
        hamiltonian,
        collapse_operators,
        duration,
    )
    return _audited_rust_map(
        name=name,
        dimension=len(hamiltonian),
        duration_us=duration,
        superoperator=superoperator,
        cp_tolerance=cp_tolerance,
        tp_tolerance=tp_tolerance,
    )


def rust_piecewise_gksl_exponential_map(
    hamiltonian: TimeDependentHamiltonian,
    collapse_operators: Sequence[Matrix],
    duration_us: float,
    max_interval_us: float,
    *,
    name: str = "rust_piecewise_time_dependent_gksl",
    cp_tolerance: float = DEFAULT_CP_TOLERANCE,
    tp_tolerance: float = DEFAULT_TP_TOLERANCE,
) -> PiecewiseGKSLMap:
    """Evaluate interval Hamiltonians in Python and compose maps in Rust."""

    duration = _positive_finite(duration_us, "duration_us")
    max_interval = _positive_finite(
        max_interval_us,
        "max_interval_us",
    )
    boundaries = piecewise_interval_boundaries(duration, max_interval)
    hamiltonians: list[Matrix] = []
    interval_durations: list[float] = []
    sample_times: list[float] = []
    for start_time, end_time in boundaries:
        sample_time = start_time + 0.5 * (end_time - start_time)
        hamiltonians.append(hamiltonian.evaluate(sample_time))
        interval_durations.append(end_time - start_time)
        sample_times.append(sample_time)

    superoperator = rust_gksl_piecewise_superoperator(
        hamiltonians,
        interval_durations,
        collapse_operators,
    )
    dimension = len(hamiltonians[0])
    intervals = tuple(
        PiecewiseGKSLInterval(
            index=index,
            start_time_us=start_time,
            end_time_us=end_time,
            sample_time_us=sample_times[index],
            channel=rust_gksl_exponential_map(
                hamiltonians[index],
                collapse_operators,
                interval_durations[index],
                name=f"{name}_interval_{index}",
                cp_tolerance=cp_tolerance,
                tp_tolerance=tp_tolerance,
            ),
        )
        for index, (start_time, end_time) in enumerate(boundaries)
    )
    choi = superoperator_to_choi(superoperator, dimension)
    audit = audit_choi_matrix(
        choi,
        dimension,
        cp_tolerance=cp_tolerance,
        tp_tolerance=tp_tolerance,
    )
    if not audit.is_cptp:
        raise RuntimeError(
            "Rust piecewise GKSL map failed the configured CPTP audit"
        )
    return PiecewiseGKSLMap(
        name=name,
        dimension=dimension,
        duration_us=duration,
        max_interval_us=max_interval,
        intervals=intervals,
        superoperator=superoperator,
        choi_matrix=choi,
        audit=audit,
    )


def _audited_rust_map(
    *,
    name: str,
    dimension: int,
    duration_us: float,
    superoperator: Matrix,
    cp_tolerance: float,
    tp_tolerance: float,
) -> GKSLExponentialMap:
    choi = superoperator_to_choi(superoperator, dimension)
    audit = audit_choi_matrix(
        choi,
        dimension,
        cp_tolerance=cp_tolerance,
        tp_tolerance=tp_tolerance,
    )
    if not audit.is_cptp:
        raise RuntimeError(
            "Rust GKSL exponential failed the configured CPTP audit"
        )
    return GKSLExponentialMap(
        name=name,
        dimension=dimension,
        duration_us=duration_us,
        superoperator=superoperator,
        choi_matrix=choi,
        audit=audit,
        exponential_method=RUST_EXPONENTIAL_METHOD,
    )


def _positive_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted <= 0.0:
        raise ValueError(f"{field_name} must be finite and positive")
    return converted


def _nonnegative_finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted) or converted < 0.0:
        raise ValueError(f"{field_name} must be finite and non-negative")
    return converted
