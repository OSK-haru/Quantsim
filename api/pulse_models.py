"""Strict request and response models for the experimental pulse API."""

from __future__ import annotations

import math
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from core.capabilities import (
    DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL,
    DRIVEN_TWO_LEVEL_RWA_EXPERIMENTAL_MODEL,
)
from core.pulse_qutrit_contract import transition_12_frequency_ghz


class StrictPulseModel(BaseModel):
    """Reject unknown fields so inactive input modes cannot leak through."""

    model_config = ConfigDict(extra="forbid")


class PulsePhysicalEnvironmentRequest(StrictPulseModel):
    input_mode: Literal["physical"]
    device_quality: float = Field(ge=0.0, le=1.0)
    temperature_mk: float = Field(ge=0.0)
    flux_noise_phi0: float = Field(ge=0.0)
    qubit_frequency_ghz: float = Field(gt=0.0)
    t1_max_us: float = Field(gt=0.0)
    tphi_max_us: float = Field(gt=0.0)
    ideal_reference: bool = False

    @field_validator(
        "device_quality",
        "temperature_mk",
        "flux_noise_phi0",
        "qubit_frequency_ghz",
        "t1_max_us",
        "tphi_max_us",
    )
    @classmethod
    def validate_finite_environment_value(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("physical environment fields must be finite")
        return value


class PulseDirectRatesEnvironmentRequest(StrictPulseModel):
    input_mode: Literal["direct_rates"]
    gamma_down_per_us: float = Field(ge=0.0)
    gamma_up_per_us: float = Field(ge=0.0)
    gamma_phi_per_us: float = Field(ge=0.0)

    @field_validator(
        "gamma_down_per_us",
        "gamma_up_per_us",
        "gamma_phi_per_us",
    )
    @classmethod
    def validate_finite_rate(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("direct rates must be finite")
        return value


PulseEnvironmentRequest = Annotated[
    PulsePhysicalEnvironmentRequest | PulseDirectRatesEnvironmentRequest,
    Field(discriminator="input_mode"),
]


class PulseEnvelopeRequest(StrictPulseModel):
    shape: Literal["square", "gaussian"]
    amplitude_mode: Literal["target_rotation_angle", "peak_amplitude"]
    target_rotation_angle_rad: float | None = None
    peak_amplitude_rad_per_us: float | None = None
    pulse_duration_us: float | None = Field(default=None, gt=0.0)
    sigma_us: float | None = Field(default=None, gt=0.0)
    truncation_sigma: float | None = Field(default=None, gt=0.0)
    phase_rad: float = 0.0
    detuning_rad_per_us: float = 0.0
    drag_beta_us: float = 0.0

    @field_validator(
        "target_rotation_angle_rad",
        "peak_amplitude_rad_per_us",
        "phase_rad",
        "detuning_rad_per_us",
        "drag_beta_us",
    )
    @classmethod
    def validate_finite_value(
        cls,
        value: float | None,
    ) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("pulse numeric fields must be finite")
        return value

    @model_validator(mode="after")
    def validate_shape_and_amplitude(self) -> "PulseEnvelopeRequest":
        if self.amplitude_mode == "target_rotation_angle":
            if self.target_rotation_angle_rad is None:
                raise ValueError(
                    "target_rotation_angle_rad is required for "
                    "target_rotation_angle amplitude_mode"
                )
            if self.peak_amplitude_rad_per_us is not None:
                raise ValueError(
                    "peak_amplitude_rad_per_us is not allowed for "
                    "target_rotation_angle amplitude_mode"
                )
        else:
            if self.peak_amplitude_rad_per_us is None:
                raise ValueError(
                    "peak_amplitude_rad_per_us is required for "
                    "peak_amplitude amplitude_mode"
                )
            if self.target_rotation_angle_rad is not None:
                raise ValueError(
                    "target_rotation_angle_rad is not allowed for "
                    "peak_amplitude amplitude_mode"
                )

        if self.shape == "square":
            if self.pulse_duration_us is None:
                raise ValueError(
                    "pulse_duration_us is required for a square pulse"
                )
            if self.sigma_us is not None or self.truncation_sigma is not None:
                raise ValueError(
                    "sigma_us and truncation_sigma are not allowed for "
                    "a square pulse"
                )
        else:
            if self.sigma_us is None or self.truncation_sigma is None:
                raise ValueError(
                    "sigma_us and truncation_sigma are required for "
                    "a gaussian pulse"
                )
            if self.pulse_duration_us is not None:
                raise ValueError(
                    "pulse_duration_us is derived for a gaussian pulse"
                )

        if self.drag_beta_us != 0.0:
            raise ValueError(
                "drag_beta_us must be 0 for Pulse Baseline A"
            )
        return self

    @property
    def derived_pulse_duration_us(self) -> float:
        if self.shape == "square":
            assert self.pulse_duration_us is not None
            return self.pulse_duration_us
        assert self.sigma_us is not None
        assert self.truncation_sigma is not None
        return 2.0 * self.sigma_us * self.truncation_sigma


class PulseSnapshotOptionsRequest(StrictPulseModel):
    uniform_count: int = Field(default=101, ge=0, le=1001)
    custom_times_us: list[float] = Field(default_factory=list, max_length=100)

    @field_validator("uniform_count")
    @classmethod
    def validate_uniform_count(cls, value: int) -> int:
        if value == 1:
            raise ValueError(
                "uniform_count must be 0 or an integer from 2 to 1001"
            )
        return value

    @field_validator("custom_times_us")
    @classmethod
    def validate_custom_times(cls, values: list[float]) -> list[float]:
        if any(not math.isfinite(value) or value < 0.0 for value in values):
            raise ValueError(
                "custom_times_us must contain finite, non-negative times"
            )
        return values


class PulseSimulateRequest(StrictPulseModel):
    model_id: Literal["driven_two_level_rwa_experimental_v1"] = (
        DRIVEN_TWO_LEVEL_RWA_EXPERIMENTAL_MODEL
    )
    initial_state: Literal["0", "1"] = "0"
    pulse: PulseEnvelopeRequest
    total_simulation_time_us: float = Field(gt=0.0)
    backend: Literal["python", "rust", "auto"] = "python"
    environment: PulseEnvironmentRequest
    snapshot_options: PulseSnapshotOptionsRequest = Field(
        default_factory=PulseSnapshotOptionsRequest
    )

    @model_validator(mode="after")
    def validate_timing(self) -> "PulseSimulateRequest":
        if not math.isfinite(self.total_simulation_time_us):
            raise ValueError("total_simulation_time_us must be finite")
        pulse_duration = self.pulse.derived_pulse_duration_us
        if pulse_duration > self.total_simulation_time_us:
            raise ValueError(
                "pulse duration must not exceed total_simulation_time_us"
            )
        if any(
            time_us > self.total_simulation_time_us
            for time_us in self.snapshot_options.custom_times_us
        ):
            raise ValueError(
                "snapshot_options.custom_times_us must not exceed "
                "total_simulation_time_us"
            )
        return self


class QutritPulsePhysicalEnvironmentRequest(
    PulsePhysicalEnvironmentRequest
):
    """Physical environment fields shared with the educational profile."""


class QutritPulseDirectRatesEnvironmentRequest(StrictPulseModel):
    input_mode: Literal["direct_rates"]
    gamma_10_down_per_us: float = Field(ge=0.0)
    gamma_01_up_per_us: float = Field(ge=0.0)
    gamma_21_down_per_us: float = Field(ge=0.0)
    gamma_12_up_per_us: float = Field(ge=0.0)
    gamma_phi_adjacent_per_us: float = Field(
        ge=0.0,
        description=(
            "Single number-operator pure-dephasing rate. It gives the same "
            "pure-dephasing rate to rho_01 and rho_12, while rho_02 decays "
            "at four times this rate; the three rates are not independent."
        ),
    )

    @field_validator(
        "gamma_10_down_per_us",
        "gamma_01_up_per_us",
        "gamma_21_down_per_us",
        "gamma_12_up_per_us",
        "gamma_phi_adjacent_per_us",
    )
    @classmethod
    def validate_finite_qutrit_rate(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("qutrit direct rates must be finite")
        return value


QutritPulseEnvironmentRequest = Annotated[
    QutritPulsePhysicalEnvironmentRequest
    | QutritPulseDirectRatesEnvironmentRequest,
    Field(discriminator="input_mode"),
]


class QutritPulseEnvelopeRequest(StrictPulseModel):
    """Provisional qutrit envelope contract with Gaussian DRAG support."""

    shape: Literal["square", "gaussian"]
    amplitude_mode: Literal["target_rotation_angle", "peak_amplitude"]
    target_rotation_angle_rad: float | None = None
    peak_amplitude_rad_per_us: float | None = None
    pulse_duration_us: float | None = Field(default=None, gt=0.0)
    sigma_us: float | None = Field(default=None, gt=0.0)
    truncation_sigma: float | None = Field(default=None, gt=0.0)
    phase_rad: float = 0.0
    detuning_rad_per_us: float = 0.0
    drag_beta_us: float = 0.0

    @field_validator(
        "target_rotation_angle_rad",
        "peak_amplitude_rad_per_us",
        "phase_rad",
        "detuning_rad_per_us",
        "drag_beta_us",
    )
    @classmethod
    def validate_finite_qutrit_pulse_value(
        cls,
        value: float | None,
    ) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("qutrit pulse numeric fields must be finite")
        return value

    @model_validator(mode="after")
    def validate_qutrit_shape_and_amplitude(
        self,
    ) -> "QutritPulseEnvelopeRequest":
        if self.amplitude_mode == "target_rotation_angle":
            if self.target_rotation_angle_rad is None:
                raise ValueError(
                    "target_rotation_angle_rad is required for "
                    "target_rotation_angle amplitude_mode"
                )
            if self.peak_amplitude_rad_per_us is not None:
                raise ValueError(
                    "peak_amplitude_rad_per_us is not allowed for "
                    "target_rotation_angle amplitude_mode"
                )
        else:
            if self.peak_amplitude_rad_per_us is None:
                raise ValueError(
                    "peak_amplitude_rad_per_us is required for "
                    "peak_amplitude amplitude_mode"
                )
            if self.target_rotation_angle_rad is not None:
                raise ValueError(
                    "target_rotation_angle_rad is not allowed for "
                    "peak_amplitude amplitude_mode"
                )

        if self.shape == "square":
            if self.pulse_duration_us is None:
                raise ValueError(
                    "pulse_duration_us is required for a square pulse"
                )
            if self.sigma_us is not None or self.truncation_sigma is not None:
                raise ValueError(
                    "sigma_us and truncation_sigma are not allowed for "
                    "a square pulse"
                )
        else:
            if self.sigma_us is None or self.truncation_sigma is None:
                raise ValueError(
                    "sigma_us and truncation_sigma are required for "
                    "a gaussian pulse"
                )
            if self.pulse_duration_us is not None:
                raise ValueError(
                    "pulse_duration_us is derived for a gaussian pulse"
                )

        if self.shape != "gaussian" and self.drag_beta_us != 0.0:
            raise ValueError(
                "nonzero drag_beta_us requires a gaussian qutrit pulse"
            )
        return self

    @property
    def derived_pulse_duration_us(self) -> float:
        if self.shape == "square":
            assert self.pulse_duration_us is not None
            return self.pulse_duration_us
        assert self.sigma_us is not None
        assert self.truncation_sigma is not None
        return 2.0 * self.sigma_us * self.truncation_sigma


class QutritPulseSimulateRequest(StrictPulseModel):
    """Validated request contract for the experimental qutrit path."""

    model_id: Literal["driven_transmon_qutrit_rwa_experimental_v1"] = (
        DRIVEN_TRANSMON_QUTRIT_RWA_EXPERIMENTAL_MODEL
    )
    initial_state: Literal["0", "1", "2"] = "0"
    anharmonicity_mhz: float = Field(lt=0.0)
    pulse: QutritPulseEnvelopeRequest
    total_simulation_time_us: float = Field(gt=0.0)
    backend: Literal["python", "rust", "auto"] = "python"
    environment: QutritPulseEnvironmentRequest
    snapshot_options: PulseSnapshotOptionsRequest = Field(
        default_factory=PulseSnapshotOptionsRequest
    )

    @field_validator("anharmonicity_mhz")
    @classmethod
    def validate_finite_anharmonicity(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("anharmonicity_mhz must be finite")
        return value

    @model_validator(mode="after")
    def validate_qutrit_contract(self) -> "QutritPulseSimulateRequest":
        if not math.isfinite(self.total_simulation_time_us):
            raise ValueError("total_simulation_time_us must be finite")
        pulse_duration = self.pulse.derived_pulse_duration_us
        if pulse_duration > self.total_simulation_time_us:
            raise ValueError(
                "pulse duration must not exceed total_simulation_time_us"
            )
        if any(
            time_us > self.total_simulation_time_us
            for time_us in self.snapshot_options.custom_times_us
        ):
            raise ValueError(
                "snapshot_options.custom_times_us must not exceed "
                "total_simulation_time_us"
            )
        if isinstance(
            self.environment,
            QutritPulsePhysicalEnvironmentRequest,
        ):
            transition_12_frequency_ghz(
                self.environment.qubit_frequency_ghz,
                self.anharmonicity_mhz,
            )
        return self


PulseApiRequest = Annotated[
    PulseSimulateRequest | QutritPulseSimulateRequest,
    Field(discriminator="model_id"),
]


class PulseComplexValue(StrictPulseModel):
    real: float
    imag: float


class PulsePhysicalityResponse(StrictPulseModel):
    trace_error: float
    hermiticity_error: float
    minimum_eigenvalue: float


class PulseUnitsResponse(StrictPulseModel):
    time: Literal["us"]
    angular_frequency: Literal["rad/us"]
    rate: Literal["1/us"]


class PulseModelIdentityResponse(StrictPulseModel):
    model_id: Literal["driven_two_level_rwa_experimental_v1"]
    description: str
    frame: Literal["rotating"]
    approximation: Literal["RWA"]
    logical_qubits: Literal[1]
    state_levels: Literal[2]
    experimental: Literal[True]
    hardware_calibrated: Literal[False]
    internal_units: PulseUnitsResponse


class PulseInputSummaryResponse(StrictPulseModel):
    initial_state: Literal["0", "1"]
    shape: Literal["square", "gaussian"]
    amplitude_mode: Literal["target_rotation_angle", "peak_amplitude"]
    target_rotation_angle_rad: float | None
    peak_amplitude_rad_per_us: float
    pulse_area_rad: float
    pulse_duration_us: float
    total_simulation_time_us: float
    idle_duration_us: float
    phase_rad: float
    detuning_rad_per_us: float
    sample_count: int


class PulseRatesResponse(StrictPulseModel):
    input_mode: Literal["physical", "direct_rates"]
    gamma_down_per_us: float
    gamma_up_per_us: float
    gamma_population_relaxation_per_us: float
    gamma_phi_per_us: float
    n_th: float | None
    t1_effective_us: float | None
    tphi_effective_us: float | None
    t2_effective_us: float | None


class PulseStepPolicyResponse(StrictPulseModel):
    policy_id: Literal["pulse_baseline_a_step_policy_v1"]
    epsilon_h: float
    epsilon_d: float
    samples_per_sigma: int
    max_internal_step_us: float
    hamiltonian_gap_rad_per_us: float
    dissipative_scale_per_us: float
    h_times_hamiltonian_gap: float
    h_times_dissipative_scale: float
    h_over_sigma: float | None
    estimated_internal_steps: int
    maximum_allowed_internal_steps: int


class PulseTrajectoryPointResponse(StrictPulseModel):
    time_us: float
    segment: Literal["pulse", "idle"]
    open_population_0: float
    open_population_1: float
    closed_population_0: float
    closed_population_1: float
    fidelity_to_closed: float
    purity: float
    raw_physicality: PulsePhysicalityResponse
    cleaned_physicality: PulsePhysicalityResponse
    cleanup_correction_norm: float


class PulseStateResponse(PulseTrajectoryPointResponse):
    open_density_matrix: list[list[PulseComplexValue]]
    closed_density_matrix: list[list[PulseComplexValue]]


class PulseEvolutionDiagnosticsResponse(StrictPulseModel):
    internal_step_count: int
    rhs_evaluation_count: int
    hamiltonian_evaluation_count: int
    minimum_internal_step_us: float
    maximum_internal_step_us: float
    raw_trace_error: float
    raw_hermiticity_error: float
    raw_minimum_eigenvalue: float
    cleanup_correction_norm: float
    actual_duration_us: float


class PulseBackendDiagnosticsResponse(StrictPulseModel):
    requested: Literal["python", "rust", "auto"]
    resolved: Literal["python", "rust"]
    fallback_used: bool


class PulseDiagnosticsResponse(StrictPulseModel):
    api_runtime_ms: float
    backend: PulseBackendDiagnosticsResponse
    open_pulse: PulseEvolutionDiagnosticsResponse
    open_idle: PulseEvolutionDiagnosticsResponse | None
    closed_pulse: PulseEvolutionDiagnosticsResponse
    closed_idle: PulseEvolutionDiagnosticsResponse | None
    maximum_cleaned_trace_error: float
    maximum_cleaned_hermiticity_error: float
    minimum_cleaned_eigenvalue: float


class PulseSimulateResponse(StrictPulseModel):
    contract_version: Literal["pulse-baseline-a-v1"]
    model: PulseModelIdentityResponse
    input: PulseInputSummaryResponse
    rates: PulseRatesResponse
    step_policy: PulseStepPolicyResponse
    sample_times_us: list[float]
    trajectory: list[PulseTrajectoryPointResponse]
    pulse_end: PulseStateResponse
    final: PulseStateResponse
    diagnostics: PulseDiagnosticsResponse
    warnings: list[str]
    limitations: list[str]


class QutritPulseModelIdentityResponse(StrictPulseModel):
    model_id: Literal["driven_transmon_qutrit_rwa_experimental_v1"]
    description: str
    frame: Literal["rotating"]
    approximation: Literal["RWA"]
    logical_qubits: Literal[1]
    state_levels: Literal[3]
    basis_order: list[Literal["0", "1", "2"]]
    subsystem_dimensions: list[Literal[3]]
    experimental: Literal[True]
    hardware_calibrated: Literal[False]
    internal_units: PulseUnitsResponse


class QutritPulseInputSummaryResponse(StrictPulseModel):
    initial_state: Literal["0", "1", "2"]
    anharmonicity_mhz: float
    shape: Literal["square", "gaussian"]
    amplitude_mode: Literal["target_rotation_angle", "peak_amplitude"]
    target_rotation_angle_rad: float | None
    peak_amplitude_rad_per_us: float
    pulse_area_rad: float
    pulse_duration_us: float
    total_simulation_time_us: float
    idle_duration_us: float
    phase_rad: float
    detuning_rad_per_us: float
    drag_beta_us: float
    sample_count: int


class QutritPulseRatesResponse(StrictPulseModel):
    input_mode: Literal["physical", "direct_rates"]
    gamma_10_down_per_us: float
    gamma_01_up_per_us: float
    gamma_21_down_per_us: float
    gamma_12_up_per_us: float
    gamma_phi_adjacent_per_us: float
    transition_01_frequency_ghz: float | None
    transition_12_frequency_ghz: float | None
    n_01: float | None
    n_12: float | None
    gamma_10_zero_temperature_per_us: float | None
    gamma_21_zero_temperature_per_us: float | None
    dephasing_model: Literal["number_operator_adjacent_rate_v1"]


class QutritPulseStepPolicyResponse(StrictPulseModel):
    policy_id: Literal["qutrit_fixed_rk4_v1"]
    hamiltonian_scale_max_rad_per_us: float
    dissipation_scale_per_us: float
    hamiltonian_step_limit_us: float | None
    dissipation_step_limit_us: float | None
    envelope_step_limit_us: float | None
    duration_step_limit_us: float
    selected_internal_step_cap_us: float
    step_limit_reason: str
    h_times_hamiltonian_scale: float
    h_times_dissipation_scale: float
    h_over_sigma: float | None
    drag_beta_us: float
    maximum_drive_magnitude_rad_per_us: float
    maximum_drag_derivative_rad_per_us2: float
    estimated_internal_step_count: int
    maximum_internal_step_count: int
    within_work_budget: bool


class QutritPulseTrajectoryPointResponse(StrictPulseModel):
    time_us: float
    segment: Literal["pulse", "idle"]
    population_0: float
    population_1: float
    population_2: float
    computational_population: float
    leakage_probability: float
    population_sum_error: float
    purity: float
    density_matrix: list[list[PulseComplexValue]]
    raw_physicality: PulsePhysicalityResponse
    cleaned_physicality: PulsePhysicalityResponse
    cleanup_correction_norm: float


class QutritLeakageResponse(StrictPulseModel):
    maximum_recorded_leakage_probability: float
    leakage_at_pulse_end: float
    leakage_at_final_time: float


class QutritPulseDiagnosticsResponse(StrictPulseModel):
    api_runtime_ms: float
    backend: PulseBackendDiagnosticsResponse
    open_pulse: PulseEvolutionDiagnosticsResponse
    open_idle: PulseEvolutionDiagnosticsResponse | None
    maximum_cleaned_trace_error: float
    maximum_cleaned_hermiticity_error: float
    minimum_cleaned_eigenvalue: float


class QutritPulseSimulateResponse(StrictPulseModel):
    contract_version: Literal["pulse-extension-b-v1"]
    model: QutritPulseModelIdentityResponse
    input: QutritPulseInputSummaryResponse
    rates: QutritPulseRatesResponse
    step_policy: QutritPulseStepPolicyResponse
    sample_times_us: list[float]
    trajectory: list[QutritPulseTrajectoryPointResponse]
    leakage: QutritLeakageResponse
    pulse_end: QutritPulseTrajectoryPointResponse
    final: QutritPulseTrajectoryPointResponse
    diagnostics: QutritPulseDiagnosticsResponse
    warnings: list[str]
    limitations: list[str]


PulseApiResponse = PulseSimulateResponse | QutritPulseSimulateResponse
