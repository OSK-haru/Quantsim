"""Closed-system qutrit pulse evolution for Pulse Extension B."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

from core.gates import Matrix, density_from_ket
from core.pulse_envelopes import GaussianPulseEnvelope, PulseEnvelope
from core.pulse_evolution import (
    ConstantHamiltonian,
    ResolvedTimeDependentEvolutionBackend,
    TimeDependentEvolutionResult,
    evolve_time_dependent_segment,
)
from core.pulse_qutrit_contract import (
    KET_ONE_QUTRIT,
    KET_TWO_QUTRIT,
    KET_ZERO_QUTRIT,
    QUTRIT_BASIS_LABELS,
    qutrit_rotating_frame_hamiltonian,
)


@dataclass(frozen=True)
class QutritPulseHamiltonian:
    """Three-level rotating-frame RWA Hamiltonian provider."""

    envelope: PulseEnvelope
    anharmonicity_rad_per_us: float
    phase_rad: float = 0.0
    detuning_rad_per_us: float = 0.0
    drag_beta_us: float = 0.0

    def __post_init__(self) -> None:
        _finite(self.anharmonicity_rad_per_us, "anharmonicity_rad_per_us")
        if self.anharmonicity_rad_per_us >= 0.0:
            raise ValueError(
                "anharmonicity_rad_per_us must be negative for the qutrit "
                "transmon model"
            )
        _finite(self.phase_rad, "phase_rad")
        _finite(self.detuning_rad_per_us, "detuning_rad_per_us")
        _finite(self.drag_beta_us, "drag_beta_us")
        if (
            self.drag_beta_us != 0.0
            and not isinstance(self.envelope, GaussianPulseEnvelope)
        ):
            raise ValueError(
                "nonzero drag_beta_us requires a Gaussian pulse"
            )

    def evaluate(self, local_time_us: float) -> Matrix:
        amplitude = self.envelope.amplitude_rad_per_us(local_time_us)
        quadrature = 0.0
        if self.drag_beta_us != 0.0:
            assert isinstance(self.envelope, GaussianPulseEnvelope)
            quadrature = (
                self.drag_beta_us
                * self.envelope.derivative_rad_per_us2(local_time_us)
            )
        cosine = math.cos(self.phase_rad)
        sine = math.sin(self.phase_rad)
        omega_x = amplitude * cosine - quadrature * sine
        omega_y = amplitude * sine + quadrature * cosine
        return qutrit_rotating_frame_hamiltonian(
            self.detuning_rad_per_us,
            self.anharmonicity_rad_per_us,
            omega_x,
            omega_y,
        )


@dataclass(frozen=True)
class QutritPopulationPoint:
    time_us: float
    segment: str
    population_0: float
    population_1: float
    population_2: float
    computational_population: float
    population_sum_error: float

    @property
    def leakage_probability(self) -> float:
        return self.population_2


@dataclass(frozen=True)
class QutritLeakageSummary:
    maximum_recorded_leakage_probability: float
    leakage_at_pulse_end: float
    leakage_at_final_time: float


@dataclass(frozen=True)
class ClosedQutritSequenceResult:
    pulse_result: TimeDependentEvolutionResult
    idle_result: TimeDependentEvolutionResult | None
    pulse_duration_us: float
    total_simulation_time_us: float
    trajectory: tuple[QutritPopulationPoint, ...]
    leakage: QutritLeakageSummary

    @property
    def pulse_end_state(self) -> Matrix:
        return self.pulse_result.state

    @property
    def final_state(self) -> Matrix:
        if self.idle_result is None:
            return self.pulse_result.state
        return self.idle_result.state

    @property
    def idle_duration_us(self) -> float:
        return self.total_simulation_time_us - self.pulse_duration_us


def qutrit_initial_density_matrix(initial_state: str) -> Matrix:
    """Return a basis-state qutrit density matrix."""

    label = str(initial_state)
    ket_by_label = {
        "0": KET_ZERO_QUTRIT,
        "1": KET_ONE_QUTRIT,
        "2": KET_TWO_QUTRIT,
    }
    ket = ket_by_label.get(label)
    if ket is None:
        raise ValueError(
            "qutrit initial_state must be one of "
            f"{', '.join(QUTRIT_BASIS_LABELS)}"
        )
    return density_from_ket(ket)


def evolve_closed_qutrit_sequence(
    state: Matrix,
    envelope: PulseEnvelope,
    anharmonicity_rad_per_us: float,
    total_simulation_time_us: float,
    max_step_us: float,
    *,
    phase_rad: float = 0.0,
    detuning_rad_per_us: float = 0.0,
    drag_beta_us: float = 0.0,
    pulse_checkpoint_times_us: Sequence[float] = (),
    idle_checkpoint_times_us: Sequence[float] = (),
    backend: ResolvedTimeDependentEvolutionBackend = "python",
) -> ClosedQutritSequenceResult:
    """Run a closed qutrit pulse followed by rotating-frame free evolution."""

    _validate_qutrit_state(state)
    total_duration = _positive_finite(
        total_simulation_time_us,
        "total_simulation_time_us",
    )
    pulse_duration = _positive_finite(
        envelope.duration_us,
        "pulse_duration_us",
    )
    if pulse_duration > total_duration:
        raise ValueError(
            "pulse duration must not exceed total_simulation_time_us"
        )

    pulse_result = evolve_time_dependent_segment(
        state,
        QutritPulseHamiltonian(
            envelope=envelope,
            anharmonicity_rad_per_us=anharmonicity_rad_per_us,
            phase_rad=phase_rad,
            detuning_rad_per_us=detuning_rad_per_us,
            drag_beta_us=drag_beta_us,
        ),
        (),
        duration_us=pulse_duration,
        max_step_us=max_step_us,
        checkpoint_times_us=pulse_checkpoint_times_us,
        backend=backend,
    )

    idle_duration = total_duration - pulse_duration
    idle_result = None
    if idle_duration > 0.0:
        idle_hamiltonian = qutrit_rotating_frame_hamiltonian(
            detuning_rad_per_us,
            anharmonicity_rad_per_us,
            0.0,
            0.0,
        )
        idle_result = evolve_time_dependent_segment(
            pulse_result.state,
            ConstantHamiltonian(idle_hamiltonian),
            (),
            duration_us=idle_duration,
            max_step_us=max_step_us,
            checkpoint_times_us=idle_checkpoint_times_us,
            backend=backend,
        )

    trajectory = _sequence_population_trajectory(
        pulse_result,
        idle_result,
        pulse_duration,
    )
    pulse_end_leakage = qutrit_populations(
        pulse_result.state,
        pulse_duration,
        "pulse",
    ).leakage_probability
    final_state = pulse_result.state if idle_result is None else idle_result.state
    final_leakage = qutrit_populations(
        final_state,
        total_duration,
        "idle" if idle_result is not None else "pulse",
    ).leakage_probability
    recorded_leakage = [
        point.leakage_probability for point in trajectory
    ]
    recorded_leakage.extend((pulse_end_leakage, final_leakage))

    return ClosedQutritSequenceResult(
        pulse_result=pulse_result,
        idle_result=idle_result,
        pulse_duration_us=pulse_duration,
        total_simulation_time_us=total_duration,
        trajectory=trajectory,
        leakage=QutritLeakageSummary(
            maximum_recorded_leakage_probability=max(recorded_leakage),
            leakage_at_pulse_end=pulse_end_leakage,
            leakage_at_final_time=final_leakage,
        ),
    )


def qutrit_populations(
    state: Matrix,
    time_us: float,
    segment: str,
) -> QutritPopulationPoint:
    """Return unnormalized computational populations and qutrit leakage."""

    _validate_qutrit_state(state)
    time = _finite(time_us, "time_us")
    population_0 = float(state[0][0].real)
    population_1 = float(state[1][1].real)
    population_2 = float(state[2][2].real)
    population_sum = population_0 + population_1 + population_2
    return QutritPopulationPoint(
        time_us=time,
        segment=str(segment),
        population_0=population_0,
        population_1=population_1,
        population_2=population_2,
        computational_population=population_0 + population_1,
        population_sum_error=abs(population_sum - 1.0),
    )


def _sequence_population_trajectory(
    pulse_result: TimeDependentEvolutionResult,
    idle_result: TimeDependentEvolutionResult | None,
    pulse_duration_us: float,
) -> tuple[QutritPopulationPoint, ...]:
    points = [
        qutrit_populations(
            checkpoint.cleaned_state,
            checkpoint.time_us,
            "pulse",
        )
        for checkpoint in pulse_result.checkpoints
    ]
    if idle_result is not None:
        for checkpoint in idle_result.checkpoints:
            if checkpoint.time_us == 0.0:
                continue
            points.append(qutrit_populations(
                checkpoint.cleaned_state,
                pulse_duration_us + checkpoint.time_us,
                "idle",
            ))
    return tuple(points)


def _validate_qutrit_state(state: Matrix) -> None:
    if len(state) != 3 or any(len(row) != 3 for row in state):
        raise ValueError("qutrit state must be a 3x3 matrix")
    for row in state:
        for value in row:
            if not math.isfinite(value.real) or not math.isfinite(value.imag):
                raise ValueError("qutrit state must contain finite values")


def _positive_finite(value: float, field_name: str) -> float:
    converted = _finite(value, field_name)
    if converted <= 0.0:
        raise ValueError(f"{field_name} must be greater than 0")
    return converted


def _finite(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted):
        raise ValueError(f"{field_name} must be finite")
    return converted
