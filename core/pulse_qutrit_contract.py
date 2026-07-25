"""Fixed physical conventions for the experimental transmon qutrit model."""

from __future__ import annotations

import math
from math import sqrt

from core.gates import Matrix
from core.pulse_contract import mhz_to_rad_per_us


Ket = tuple[complex, ...]

QUTRIT_BASIS_LABELS = ("0", "1", "2")
QUTRIT_SUBSYSTEM_DIMENSIONS = (3,)
QUTRIT_STATE_LEVELS = 3
QUTRIT_CONTRACT_VERSION = "pulse-extension-b-v1"
QUTRIT_CONTRACT_STATUS = "available"
QUTRIT_ANHARMONICITY_CONVENTION = "omega_12_minus_omega_01"

KET_ZERO_QUTRIT: Ket = (1.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j)
KET_ONE_QUTRIT: Ket = (0.0 + 0.0j, 1.0 + 0.0j, 0.0 + 0.0j)
KET_TWO_QUTRIT: Ket = (0.0 + 0.0j, 0.0 + 0.0j, 1.0 + 0.0j)

IDENTITY_3: Matrix = (
    (1.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 1.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 0.0 + 0.0j, 1.0 + 0.0j),
)
ANNIHILATION_QUTRIT: Matrix = (
    (0.0 + 0.0j, 1.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 0.0 + 0.0j, sqrt(2.0)),
    (0.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j),
)
CREATION_QUTRIT: Matrix = (
    (0.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j),
    (1.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, sqrt(2.0), 0.0 + 0.0j),
)
NUMBER_QUTRIT: Matrix = (
    (0.0 + 0.0j, 0.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 1.0 + 0.0j, 0.0 + 0.0j),
    (0.0 + 0.0j, 0.0 + 0.0j, 2.0 + 0.0j),
)


def transmon_anharmonicity_rad_per_us(
    anharmonicity_mhz: float,
) -> float:
    """Convert a transmon-like negative anharmonicity from MHz to rad/us."""

    value = _finite_float(anharmonicity_mhz, "anharmonicity_mhz")
    if value >= 0.0:
        raise ValueError(
            "anharmonicity_mhz must be negative for the qutrit transmon model"
        )
    return mhz_to_rad_per_us(value)


def transition_12_frequency_ghz(
    transition_01_frequency_ghz: float,
    anharmonicity_mhz: float,
) -> float:
    """Return f12 = f01 + alpha while validating the transition contract."""

    frequency_01 = _finite_float(
        transition_01_frequency_ghz,
        "transition_01_frequency_ghz",
    )
    if frequency_01 <= 0.0:
        raise ValueError("transition_01_frequency_ghz must be positive")

    alpha_mhz = _finite_float(anharmonicity_mhz, "anharmonicity_mhz")
    if alpha_mhz >= 0.0:
        raise ValueError(
            "anharmonicity_mhz must be negative for the qutrit transmon model"
        )

    frequency_12 = frequency_01 + alpha_mhz / 1000.0
    if frequency_12 <= 0.0:
        raise ValueError(
            "the derived 1-to-2 transition frequency must be positive"
        )
    return frequency_12


def qutrit_rotating_frame_hamiltonian(
    detuning_rad_per_us: float,
    anharmonicity_rad_per_us: float,
    omega_x_rad_per_us: float,
    omega_y_rad_per_us: float,
) -> Matrix:
    """Build the frozen three-level rotating-frame RWA Hamiltonian."""

    detuning = _finite_float(
        detuning_rad_per_us,
        "detuning_rad_per_us",
    )
    anharmonicity = _finite_float(
        anharmonicity_rad_per_us,
        "anharmonicity_rad_per_us",
    )
    if anharmonicity >= 0.0:
        raise ValueError(
            "anharmonicity_rad_per_us must be negative for the qutrit "
            "transmon model"
        )
    omega_x = _finite_float(omega_x_rad_per_us, "omega_x_rad_per_us")
    omega_y = _finite_float(omega_y_rad_per_us, "omega_y_rad_per_us")

    coupling_01 = 0.5 * complex(omega_x, -omega_y)
    coupling_12 = sqrt(2.0) * coupling_01
    return (
        (0.0 + 0.0j, coupling_01, 0.0 + 0.0j),
        (
            coupling_01.conjugate(),
            -detuning + 0.0j,
            coupling_12,
        ),
        (
            0.0 + 0.0j,
            coupling_12.conjugate(),
            -2.0 * detuning + anharmonicity + 0.0j,
        ),
    )


def _finite_float(value: float, field_name: str) -> float:
    converted = float(value)
    if not math.isfinite(converted):
        raise ValueError(f"{field_name} must be finite")
    return converted
