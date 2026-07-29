"""Explicit-CPTP interval evolution for the gate-aware simulator."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal, Sequence

from core.cptp import ChoiAudit
from core.cptp_liouvillian import GKSLExponentialMap, gksl_exponential_map
from core.cptp_rust import rust_gksl_exponential_map
from core.evolution_methods import (
    EXPLICIT_CPTP,
    FIXED_STEP_RK4,
    SUPPORTED_GATE_AWARE_EVOLUTION_METHODS,
)
from core.gates import CachedCollapseOperator, Matrix


GATE_AWARE_CPTP_EVOLUTION_ID = "gate_aware_constant_gksl_exponential_v1"
GateAwareCPTPBackend = Literal["python", "rust"]


@dataclass
class GateAwareCPTPEvolver:
    """Apply and audit reusable constant-GKSL maps without state cleanup."""

    backend: GateAwareCPTPBackend = "python"
    _cache: dict[
        tuple[Matrix, tuple[Matrix, ...], float],
        GKSLExponentialMap,
    ] = field(default_factory=dict)
    application_count: int = 0
    construction_count: int = 0
    _audits: list[ChoiAudit] = field(default_factory=list)

    def evolve(
        self,
        state: Matrix,
        hamiltonian: Matrix,
        collapse_ops: Sequence[CachedCollapseOperator],
        duration_us: float,
    ) -> Matrix:
        duration = float(duration_us)
        if not math.isfinite(duration) or duration < 0.0:
            raise ValueError("duration_us must be finite and non-negative")
        if duration == 0.0:
            return state

        collapse_matrices = tuple(item.operator for item in collapse_ops)
        # Timeline arithmetic can produce sub-femtosecond float differences for
        # mathematically identical intervals. Reuse those maps.
        cache_duration = round(duration, 14)
        key = (hamiltonian, collapse_matrices, cache_duration)
        channel = self._cache.get(key)
        if channel is None:
            constructor = (
                rust_gksl_exponential_map
                if self.backend == "rust"
                else gksl_exponential_map
            )
            channel = constructor(
                hamiltonian,
                collapse_matrices,
                cache_duration,
                name="gate_aware_constant_gksl_interval",
            )
            self._cache[key] = channel
            self.construction_count += 1
            self._audits.append(channel.audit)
        self.application_count += 1
        return channel.apply(state)

    def diagnostics(self) -> dict[str, object]:
        if not self._audits:
            return {
                "cptp_backend": self.backend,
                "cptp_map_application_count": self.application_count,
                "cptp_map_construction_count": self.construction_count,
                "cptp_minimum_choi_eigenvalue": 0.0,
                "cptp_maximum_tp_frobenius_error": 0.0,
                "cptp_maximum_tp_max_abs_error": 0.0,
                "cptp_all_maps_passed_audit": True,
            }
        return {
            "cptp_backend": self.backend,
            "cptp_map_application_count": self.application_count,
            "cptp_map_construction_count": self.construction_count,
            "cptp_minimum_choi_eigenvalue": min(
                audit.choi_minimum_eigenvalue for audit in self._audits
            ),
            "cptp_maximum_tp_frobenius_error": max(
                audit.trace_preservation_frobenius_error
                for audit in self._audits
            ),
            "cptp_maximum_tp_max_abs_error": max(
                audit.trace_preservation_max_abs_error
                for audit in self._audits
            ),
            "cptp_all_maps_passed_audit": all(
                audit.is_cptp for audit in self._audits
            ),
        }
