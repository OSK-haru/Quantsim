"""Small coupled-transmon networks with a three-level local truncation.

The model is deliberately bounded to two through four transmons.  It keeps
the tensor-product basis explicit and supports independently scheduled local
I/Q envelopes plus pairwise exchange couplings.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import product

from core.gates import (
    Matrix,
    add,
    density_from_ket,
    identity_matrix,
    matmul,
    prepare_collapse_operators,
    scale,
    subtract,
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
MIN_TRANSMON_COUNT = 2
MAX_TRANSMON_COUNT = 4


def network_basis_labels(transmon_count: int) -> tuple[str, ...]:
    """Return q0-most-significant tensor-basis labels such as ``012``."""

    count = _validate_transmon_count(transmon_count)
    return tuple(
        "".join(str(level) for level in levels)
        for levels in product(range(LOCAL_DIMENSION), repeat=count)
    )


def computational_basis_labels(transmon_count: int) -> tuple[str, ...]:
    count = _validate_transmon_count(transmon_count)
    return tuple(
        "".join(str(level) for level in levels)
        for levels in product(range(2), repeat=count)
    )


def embed_network_local_operator(
    operator: Matrix,
    subsystem: int,
    transmon_count: int,
) -> Matrix:
    """Embed one 3x3 operator with q0 as the most-significant subsystem."""

    count = _validate_transmon_count(transmon_count)
    if subsystem < 0 or subsystem >= count:
        raise ValueError("network subsystem is outside the transmon register")
    factors = [identity_matrix(LOCAL_DIMENSION) for _ in range(count)]
    factors[subsystem] = operator
    result = factors[0]
    for factor in factors[1:]:
        result = tensor(result, factor)
    return result


@dataclass(frozen=True)
class TransmonExchangeCoupling:
    left: int
    right: int
    strength_rad_per_us: float

    def __post_init__(self) -> None:
        if self.left < 0 or self.right < 0 or self.left == self.right:
            raise ValueError("exchange coupling endpoints must be distinct")
        if (
            not math.isfinite(self.strength_rad_per_us)
            or self.strength_rad_per_us < 0.0
        ):
            raise ValueError("exchange coupling strength must be finite and non-negative")


@dataclass(frozen=True)
class ScheduledTransmonDrive:
    target: int
    start_time_us: float
    envelope: PulseEnvelope
    phase_rad: float = 0.0
    detuning_rad_per_us: float = 0.0
    drag_beta_us: float = 0.0

    def __post_init__(self) -> None:
        if self.target < 0:
            raise ValueError("drive target must be non-negative")
        if not math.isfinite(self.start_time_us) or self.start_time_us < 0.0:
            raise ValueError("drive start_time_us must be finite and non-negative")
        if (
            not math.isfinite(self.phase_rad)
            or not math.isfinite(self.detuning_rad_per_us)
            or not math.isfinite(self.drag_beta_us)
        ):
            raise ValueError("drive phase, detuning, and DRAG beta must be finite")
        if self.drag_beta_us != 0.0 and not isinstance(
            self.envelope,
            GaussianPulseEnvelope,
        ):
            raise ValueError("nonzero DRAG beta requires a Gaussian pulse")

    @property
    def end_time_us(self) -> float:
        return self.start_time_us + self.envelope.duration_us

    def quadratures(self, time_us: float) -> tuple[float, float]:
        local_time = time_us - self.start_time_us
        tolerance = 1e-14
        if local_time < -tolerance or local_time > self.envelope.duration_us + tolerance:
            return 0.0, 0.0
        local_time = min(self.envelope.duration_us, max(0.0, local_time))
        amplitude = self.envelope.amplitude_rad_per_us(local_time)
        quadrature = 0.0
        if self.drag_beta_us != 0.0:
            assert isinstance(self.envelope, GaussianPulseEnvelope)
            quadrature = (
                self.drag_beta_us
                * self.envelope.derivative_rad_per_us2(local_time)
            )
        phase = self.phase_rad + self.detuning_rad_per_us * local_time
        cosine = math.cos(phase)
        sine = math.sin(phase)
        return (
            amplitude * cosine - quadrature * sine,
            amplitude * sine + quadrature * cosine,
        )


@dataclass(frozen=True)
class CoupledTransmonNetworkHamiltonian:
    """Duffing qutrit network with scheduled local drives and exchange edges."""

    anharmonicities_rad_per_us: tuple[float, ...]
    detunings_rad_per_us: tuple[float, ...]
    couplings: tuple[TransmonExchangeCoupling, ...]
    drives: tuple[ScheduledTransmonDrive, ...]
    _static_hamiltonian: Matrix = field(init=False, repr=False)
    _drive_x_operators: tuple[Matrix, ...] = field(init=False, repr=False)
    _drive_y_operators: tuple[Matrix, ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        count = _validate_transmon_count(len(self.anharmonicities_rad_per_us))
        if len(self.detunings_rad_per_us) != count:
            raise ValueError("network detunings must match the transmon count")
        if any(
            not math.isfinite(alpha) or alpha >= 0.0
            for alpha in self.anharmonicities_rad_per_us
        ):
            raise ValueError("network anharmonicities must be finite and negative")
        if any(not math.isfinite(value) for value in self.detunings_rad_per_us):
            raise ValueError("network detunings must be finite")
        if any(
            coupling.left >= count or coupling.right >= count
            for coupling in self.couplings
        ):
            raise ValueError("exchange coupling endpoint is outside the register")
        if any(drive.target >= count for drive in self.drives):
            raise ValueError("drive target is outside the transmon register")

        static_terms: list[Matrix] = []
        drive_x_operators: list[Matrix] = []
        drive_y_operators: list[Matrix] = []
        for index, (alpha, detuning) in enumerate(zip(
            self.anharmonicities_rad_per_us,
            self.detunings_rad_per_us,
            strict=True,
        )):
            local_static = qutrit_rotating_frame_hamiltonian(
                detuning,
                alpha,
                0.0,
                0.0,
            )
            local_x = subtract(
                qutrit_rotating_frame_hamiltonian(detuning, alpha, 1.0, 0.0),
                local_static,
            )
            local_y = subtract(
                qutrit_rotating_frame_hamiltonian(detuning, alpha, 0.0, 1.0),
                local_static,
            )
            static_terms.append(embed_network_local_operator(local_static, index, count))
            drive_x_operators.append(embed_network_local_operator(local_x, index, count))
            drive_y_operators.append(embed_network_local_operator(local_y, index, count))

        embedded_annihilation = tuple(
            embed_network_local_operator(ANNIHILATION_QUTRIT, index, count)
            for index in range(count)
        )
        embedded_creation = tuple(
            embed_network_local_operator(CREATION_QUTRIT, index, count)
            for index in range(count)
        )
        for coupling in self.couplings:
            static_terms.append(scale(
                coupling.strength_rad_per_us,
                add(
                    matmul(
                        embedded_creation[coupling.left],
                        embedded_annihilation[coupling.right],
                    ),
                    matmul(
                        embedded_annihilation[coupling.left],
                        embedded_creation[coupling.right],
                    ),
                ),
            ))

        object.__setattr__(self, "_static_hamiltonian", add(*static_terms))
        object.__setattr__(self, "_drive_x_operators", tuple(drive_x_operators))
        object.__setattr__(self, "_drive_y_operators", tuple(drive_y_operators))

    @property
    def transmon_count(self) -> int:
        return len(self.anharmonicities_rad_per_us)

    def evaluate(self, local_time_us: float) -> Matrix:
        omega_x = [0.0 for _ in range(self.transmon_count)]
        omega_y = [0.0 for _ in range(self.transmon_count)]
        for drive in self.drives:
            drive_x, drive_y = drive.quadratures(local_time_us)
            omega_x[drive.target] += drive_x
            omega_y[drive.target] += drive_y
        drive_terms = [
            scale(value, operator)
            for values, operators in (
                (omega_x, self._drive_x_operators),
                (omega_y, self._drive_y_operators),
            )
            for value, operator in zip(values, operators, strict=True)
            if value != 0.0
        ]
        return (
            self._static_hamiltonian
            if not drive_terms
            else add(self._static_hamiltonian, *drive_terms)
        )


def network_initial_density_matrix(initial_state: str, transmon_count: int) -> Matrix:
    labels = network_basis_labels(transmon_count)
    label = str(initial_state)
    if label not in labels:
        raise ValueError("initial network state must be a register basis label")
    index = labels.index(label)
    ket = tuple(
        1.0 + 0.0j if position == index else 0.0 + 0.0j
        for position in range(len(labels))
    )
    return density_from_ket(ket)


def network_collapse_operator_matrices(
    rates: tuple[QutritDissipationRates, ...],
) -> tuple[Matrix, ...]:
    count = _validate_transmon_count(len(rates))
    matrices: list[Matrix] = []
    for subsystem, local_rates in enumerate(rates):
        matrices.extend(
            embed_network_local_operator(operator, subsystem, count)
            for operator in qutrit_collapse_operator_matrices(local_rates)
        )
    return tuple(matrices)


def network_collapse_operators(
    rates: tuple[QutritDissipationRates, ...],
):
    return prepare_collapse_operators(network_collapse_operator_matrices(rates))


def network_joint_populations(
    state: Matrix,
    transmon_count: int,
) -> dict[str, float]:
    labels = network_basis_labels(transmon_count)
    if len(state) != len(labels) or any(len(row) != len(labels) for row in state):
        raise ValueError("state dimension does not match the transmon register")
    return {
        label: float(state[index][index].real)
        for index, label in enumerate(labels)
    }


def network_leakage_probability(state: Matrix, transmon_count: int) -> float:
    populations = network_joint_populations(state, transmon_count)
    computational = sum(
        populations[label]
        for label in computational_basis_labels(transmon_count)
    )
    return 1.0 - computational


def _validate_transmon_count(transmon_count: int) -> int:
    count = int(transmon_count)
    if count < MIN_TRANSMON_COUNT or count > MAX_TRANSMON_COUNT:
        raise ValueError(
            f"transmon_count must be from {MIN_TRANSMON_COUNT} to {MAX_TRANSMON_COUNT}"
        )
    return count
