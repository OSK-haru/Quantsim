"""Coupled two-transmon pulse model with a 3 x 3 local truncation.

The implementation keeps the tensor-product construction explicit so the
same operator embedding can later be extended to N transmons.  The public
model is intentionally bounded to N=2 (Hilbert-space dimension 9).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from core.gates import (
    Matrix,
    add,
    density_from_ket,
    identity_matrix,
    prepare_collapse_operators,
    scale,
    tensor,
)
from core.pulse_envelopes import GaussianPulseEnvelope, PulseEnvelope
from core.pulse_qutrit_contract import (
    ANNIHILATION_QUTRIT,
    CREATION_QUTRIT,
    qutrit_rotating_frame_hamiltonian,
)
from core.pulse_qutrit_open_system import (
    QutritDissipationRates,
    qutrit_collapse_operator_matrices,
)


LOCAL_DIMENSION = 3
PAIR_DIMENSION = LOCAL_DIMENSION ** 2
PAIR_BASIS_LABELS = tuple(
    f"{left}{right}" for left in range(LOCAL_DIMENSION)
    for right in range(LOCAL_DIMENSION)
)


def embed_local_operator(operator: Matrix, subsystem: int) -> Matrix:
    """Embed one 3x3 operator using basis order |q0,q1>."""

    if subsystem == 0:
        return tensor(operator, identity_matrix(LOCAL_DIMENSION))
    if subsystem == 1:
        return tensor(identity_matrix(LOCAL_DIMENSION), operator)
    raise ValueError("pair subsystem must be 0 or 1")


@dataclass(frozen=True)
class CoupledTransmonPairHamiltonian:
    """Two local Duffing qutrits with exchange coupling and one local drive."""

    envelope: PulseEnvelope
    anharmonicities_rad_per_us: tuple[float, float]
    detunings_rad_per_us: tuple[float, float]
    exchange_coupling_rad_per_us: float
    drive_target: int
    phase_rad: float = 0.0
    drag_beta_us: float = 0.0
    secondary_envelope: PulseEnvelope | None = None
    secondary_phase_rad: float = 0.0
    secondary_drag_beta_us: float = 0.0

    def __post_init__(self) -> None:
        if self.drive_target not in {0, 1}:
            raise ValueError("drive_target must be 0 or 1")
        if any(alpha >= 0.0 or not math.isfinite(alpha)
               for alpha in self.anharmonicities_rad_per_us):
            raise ValueError("pair anharmonicities must be finite and negative")
        if any(not math.isfinite(value) for value in self.detunings_rad_per_us):
            raise ValueError("pair detunings must be finite")
        if not math.isfinite(self.exchange_coupling_rad_per_us):
            raise ValueError("exchange coupling must be finite")
        if not math.isfinite(self.phase_rad) or not math.isfinite(self.drag_beta_us):
            raise ValueError("drive phase and DRAG beta must be finite")
        if self.drag_beta_us != 0.0 and not isinstance(
            self.envelope, GaussianPulseEnvelope
        ):
            raise ValueError("nonzero DRAG beta requires a Gaussian pulse")
        if self.secondary_envelope is not None:
            if not math.isfinite(self.secondary_phase_rad):
                raise ValueError("secondary drive phase must be finite")
            if (
                self.secondary_drag_beta_us != 0.0
                and not isinstance(self.secondary_envelope, GaussianPulseEnvelope)
            ):
                raise ValueError(
                    "nonzero secondary DRAG beta requires a Gaussian pulse"
                )

    def evaluate(self, local_time_us: float) -> Matrix:
        primary_x, primary_y = _drive_quadratures(
            self.envelope,
            local_time_us,
            self.phase_rad,
            self.drag_beta_us,
        )
        secondary = None
        if self.secondary_envelope is not None:
            secondary = _drive_quadratures(
                self.secondary_envelope,
                local_time_us,
                self.secondary_phase_rad,
                self.secondary_drag_beta_us,
            )

        local_terms = []
        for index in range(2):
            if index == self.drive_target:
                omega_x, omega_y = primary_x, primary_y
            elif secondary is not None:
                omega_x, omega_y = secondary
            else:
                omega_x, omega_y = 0.0, 0.0
            local = qutrit_rotating_frame_hamiltonian(
                self.detunings_rad_per_us[index],
                self.anharmonicities_rad_per_us[index],
                omega_x,
                omega_y,
            )
            local_terms.append(embed_local_operator(local, index))

        exchange = scale(
            self.exchange_coupling_rad_per_us,
            add(
                tensor(CREATION_QUTRIT, ANNIHILATION_QUTRIT),
                tensor(ANNIHILATION_QUTRIT, CREATION_QUTRIT),
            ),
        )
        return add(*local_terms, exchange)


def pair_initial_density_matrix(initial_state: str) -> Matrix:
    label = str(initial_state)
    if label not in PAIR_BASIS_LABELS:
        raise ValueError(f"initial pair state must be one of {PAIR_BASIS_LABELS}")
    index = PAIR_BASIS_LABELS.index(label)
    ket = tuple(
        1.0 + 0.0j if position == index else 0.0 + 0.0j
        for position in range(PAIR_DIMENSION)
    )
    return density_from_ket(ket)


def pair_collapse_operator_matrices(
    rates: tuple[QutritDissipationRates, QutritDissipationRates],
) -> tuple[Matrix, ...]:
    matrices = []
    for subsystem, local_rates in enumerate(rates):
        matrices.extend(
            embed_local_operator(operator, subsystem)
            for operator in qutrit_collapse_operator_matrices(local_rates)
        )
    return tuple(matrices)


def pair_collapse_operators(
    rates: tuple[QutritDissipationRates, QutritDissipationRates],
):
    return prepare_collapse_operators(pair_collapse_operator_matrices(rates))


def pair_joint_populations(state: Matrix) -> dict[str, float]:
    return {
        label: float(state[index][index].real)
        for index, label in enumerate(PAIR_BASIS_LABELS)
    }


def pair_leakage_probability(state: Matrix) -> float:
    populations = pair_joint_populations(state)
    computational = sum(
        populations[label] for label in ("00", "01", "10", "11")
    )
    return 1.0 - computational


def _drive_quadratures(
    envelope: PulseEnvelope,
    local_time_us: float,
    phase_rad: float,
    drag_beta_us: float,
) -> tuple[float, float]:
    amplitude = envelope.amplitude_rad_per_us(local_time_us)
    quadrature = 0.0
    if drag_beta_us != 0.0:
        assert isinstance(envelope, GaussianPulseEnvelope)
        quadrature = (
            drag_beta_us
            * envelope.derivative_rad_per_us2(local_time_us)
        )
    cosine = math.cos(phase_rad)
    sine = math.sin(phase_rad)
    return (
        amplitude * cosine - quadrature * sine,
        amplitude * sine + quadrature * cosine,
    )
