"""Small coupled-transmon networks with a three-level local truncation.

The model is deliberately bounded to two through four transmons.  It keeps
the tensor-product basis explicit and supports independently scheduled local
I/Q envelopes plus pairwise exchange couplings.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import product

import numpy as np

from core.gates import (
    Matrix,
    density_from_ket,
    identity_matrix,
    prepare_collapse_operators,
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
# Drive edges reach the integrator as the same floats the schedule produced, so
# this only absorbs the sample-time deduplication in the request service.
SEGMENT_BOUNDARY_TOLERANCE_US = 1e-12


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


def _local_array(operator: Matrix) -> np.ndarray:
    return np.asarray(operator, dtype=np.complex128)


def _embed_local_array(
    operator: np.ndarray,
    subsystem: int,
    transmon_count: int,
) -> np.ndarray:
    """Return the NumPy twin of :func:`embed_network_local_operator`."""

    identity = np.eye(LOCAL_DIMENSION, dtype=np.complex128)
    result = operator if subsystem == 0 else identity
    for position in range(1, transmon_count):
        result = np.kron(result, operator if position == subsystem else identity)
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
    _static_array: np.ndarray = field(init=False, repr=False)
    _drive_x_arrays: tuple[np.ndarray, ...] = field(init=False, repr=False)
    _drive_y_arrays: tuple[np.ndarray, ...] = field(init=False, repr=False)

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

        dimension = LOCAL_DIMENSION ** count
        static_array = np.zeros((dimension, dimension), dtype=np.complex128)
        drive_x_arrays: list[np.ndarray] = []
        drive_y_arrays: list[np.ndarray] = []
        for index, (alpha, detuning) in enumerate(zip(
            self.anharmonicities_rad_per_us,
            self.detunings_rad_per_us,
            strict=True,
        )):
            local_static = _local_array(
                qutrit_rotating_frame_hamiltonian(detuning, alpha, 0.0, 0.0)
            )
            local_x = _local_array(
                qutrit_rotating_frame_hamiltonian(detuning, alpha, 1.0, 0.0)
            ) - local_static
            local_y = _local_array(
                qutrit_rotating_frame_hamiltonian(detuning, alpha, 0.0, 1.0)
            ) - local_static
            static_array += _embed_local_array(local_static, index, count)
            drive_x_arrays.append(_embed_local_array(local_x, index, count))
            drive_y_arrays.append(_embed_local_array(local_y, index, count))

        embedded_annihilation = tuple(
            _embed_local_array(_local_array(ANNIHILATION_QUTRIT), index, count)
            for index in range(count)
        )
        embedded_creation = tuple(
            _embed_local_array(_local_array(CREATION_QUTRIT), index, count)
            for index in range(count)
        )
        for coupling in self.couplings:
            static_array += coupling.strength_rad_per_us * (
                embedded_creation[coupling.left]
                @ embedded_annihilation[coupling.right]
                + embedded_annihilation[coupling.left]
                @ embedded_creation[coupling.right]
            )

        static_array.setflags(write=False)
        object.__setattr__(self, "_static_array", static_array)
        object.__setattr__(self, "_drive_x_arrays", tuple(drive_x_arrays))
        object.__setattr__(self, "_drive_y_arrays", tuple(drive_y_arrays))

    @property
    def transmon_count(self) -> int:
        return len(self.anharmonicities_rad_per_us)

    def for_segment(
        self,
        start_time_us: float,
        end_time_us: float,
    ) -> "CoupledTransmonNetworkSegmentHamiltonian":
        """Return the provider for one segment with a fixed active drive set.

        Every drive edge must be an integration boundary, so a drive either
        covers the whole segment or none of it. Pinning the set here means the
        RK4 stage that lands exactly on a pulse edge belongs to the segment it
        is integrating, which is what removes the edge error a closed support
        test leaves behind for square envelopes.
        """

        tolerance = SEGMENT_BOUNDARY_TOLERANCE_US
        active: list[ScheduledTransmonDrive] = []
        for drive in self.drives:
            if drive.start_time_us >= end_time_us - tolerance:
                continue
            if drive.end_time_us <= start_time_us + tolerance:
                continue
            if (
                drive.start_time_us > start_time_us + tolerance
                or drive.end_time_us < end_time_us - tolerance
            ):
                raise ValueError(
                    "a drive edge falls inside the integration segment; "
                    "drive start and end times must be integration boundaries"
                )
            active.append(drive)
        return CoupledTransmonNetworkSegmentHamiltonian(
            static_array=self._static_array,
            drive_x_arrays=self._drive_x_arrays,
            drive_y_arrays=self._drive_y_arrays,
            drives=tuple(active),
        )

    def evaluate_array(self, local_time_us: float) -> np.ndarray:
        """Return the instantaneous network Hamiltonian as a NumPy array."""

        return CoupledTransmonNetworkSegmentHamiltonian(
            static_array=self._static_array,
            drive_x_arrays=self._drive_x_arrays,
            drive_y_arrays=self._drive_y_arrays,
            drives=self.drives,
        ).evaluate_array(local_time_us)

    def evaluate(self, local_time_us: float) -> Matrix:
        return tuple(
            tuple(complex(value) for value in row)
            for row in self.evaluate_array(local_time_us)
        )


@dataclass(frozen=True)
class CoupledTransmonNetworkSegmentHamiltonian:
    """Network Hamiltonian with the active drive set already resolved."""

    static_array: np.ndarray
    drive_x_arrays: tuple[np.ndarray, ...]
    drive_y_arrays: tuple[np.ndarray, ...]
    drives: tuple[ScheduledTransmonDrive, ...]

    def for_segment(
        self,
        start_time_us: float,
        end_time_us: float,
    ) -> "CoupledTransmonNetworkSegmentHamiltonian":
        del start_time_us, end_time_us
        return self

    def evaluate_array(self, local_time_us: float) -> np.ndarray:
        transmon_count = len(self.drive_x_arrays)
        omega_x = [0.0 for _ in range(transmon_count)]
        omega_y = [0.0 for _ in range(transmon_count)]
        for drive in self.drives:
            drive_x, drive_y = drive.quadratures(local_time_us)
            omega_x[drive.target] += drive_x
            omega_y[drive.target] += drive_y
        hamiltonian = self.static_array
        accumulated = False
        for values, operators in (
            (omega_x, self.drive_x_arrays),
            (omega_y, self.drive_y_arrays),
        ):
            for value, operator in zip(values, operators, strict=True):
                if value == 0.0:
                    continue
                if accumulated:
                    hamiltonian += value * operator
                else:
                    hamiltonian = self.static_array + value * operator
                    accumulated = True
        return hamiltonian


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


@dataclass(frozen=True)
class NetworkSiteLocalDissipator:
    """Apply the network jump operators through their tensor structure.

    Every qutrit jump operator acts on one subsystem, so the whole jump sum of
    that subsystem collapses into one nine-dimensional kernel
    ``sum_j l_j (x) conj(l_j)`` acting on the paired row and column axes of
    that transmon. One small product per transmon then replaces two dense
    products per jump operator: at four transmons that is four 9x9 kernels
    instead of forty 81x81 products per Lindblad evaluation.
    """

    transmon_count: int
    jumps: tuple[tuple[int, np.ndarray], ...]
    _kernels: tuple[tuple[int, np.ndarray], ...] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        kernel_size = LOCAL_DIMENSION ** 2
        kernels: dict[int, np.ndarray] = {}
        for subsystem, local_operator in self.jumps:
            if local_operator.shape != (LOCAL_DIMENSION, LOCAL_DIMENSION):
                raise ValueError("network jump operators must be local qutrit operators")
            if subsystem < 0 or subsystem >= self.transmon_count:
                raise ValueError("jump subsystem is outside the transmon register")
            kernels.setdefault(
                subsystem,
                np.zeros((kernel_size, kernel_size), dtype=np.complex128),
            )
            kernels[subsystem] += np.kron(local_operator, local_operator.conj())
        object.__setattr__(self, "_kernels", tuple(sorted(kernels.items())))

    def relaxation_array(self, dimension: int) -> np.ndarray:
        if dimension != LOCAL_DIMENSION ** self.transmon_count:
            raise ValueError("state dimension does not match the transmon register")
        relaxation = np.zeros((dimension, dimension), dtype=np.complex128)
        for subsystem, local_operator in self.jumps:
            relaxation += _embed_local_array(
                local_operator.conj().T @ local_operator,
                subsystem,
                self.transmon_count,
            )
        return relaxation

    def apply_jumps(self, rho: np.ndarray) -> np.ndarray:
        count = self.transmon_count
        shape = (LOCAL_DIMENSION,) * (2 * count)
        kernel_size = LOCAL_DIMENSION ** 2
        result = np.zeros_like(rho)
        for subsystem, kernel in self._kernels:
            paired = np.moveaxis(
                rho.reshape(shape),
                (subsystem, count + subsystem),
                (0, 1),
            )
            remaining_shape = paired.shape[2:]
            transformed = (kernel @ paired.reshape(kernel_size, -1)).reshape(
                (LOCAL_DIMENSION, LOCAL_DIMENSION, *remaining_shape)
            )
            result += np.moveaxis(
                transformed,
                (0, 1),
                (subsystem, count + subsystem),
            ).reshape(rho.shape)
        return result


def network_site_local_dissipator(
    rates: tuple[QutritDissipationRates, ...],
) -> NetworkSiteLocalDissipator:
    count = _validate_transmon_count(len(rates))
    jumps = tuple(
        (subsystem, _local_array(operator))
        for subsystem, local_rates in enumerate(rates)
        for operator in qutrit_collapse_operator_matrices(local_rates)
    )
    return NetworkSiteLocalDissipator(transmon_count=count, jumps=jumps)


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
