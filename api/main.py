"""Minimal FastAPI example endpoint for UI SimulationResponse data."""

from __future__ import annotations

from concurrent.futures import (
    ThreadPoolExecutor,
    TimeoutError as FuturesTimeoutError,
)
import logging
import math
import os
from threading import BoundedSemaphore
from typing import Literal
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator

from api.pulse_models import (
    PulseApiRequest,
    PulseApiResponse,
)
from api.pulse_service import (
    PulseExecutionLimitError,
    run_pulse_api_request as run_pulse_request,
)
from core.capabilities import DECLARED_PULSE_MODELS, PULSE_MODEL_STATUSES
from core.circuit_model import CircuitAnnotation, CircuitConfig, GateColumn, GateOperation
from core.physical_environment import INPUT_MODE_NORMALIZED, INPUT_MODE_PHYSICAL
from core.results import EnvironmentConfig, SimulationConfig
from core.gate_compiler import compile_gate_aware_circuit
from core.simulator import run_simulation
from core.ui_response import compilation_response, simulation_result_to_ui_response


logger = logging.getLogger(__name__)

app = FastAPI(title="Yuragi-Strider API", version="0.1.0")

# The API only accepts compact circuit descriptions.  This limit is enforced
# while the ASGI body is being received, including chunked requests, so a
# client cannot exhaust memory before Pydantic validates the JSON structure.
MAX_API_REQUEST_BODY_BYTES = 64 * 1024


class _RequestBodyTooLarge(Exception):
    """Raised internally when an HTTP request body exceeds the API budget."""


class RequestBodyLimitMiddleware:
    """Reject oversized HTTP bodies before they reach JSON parsing."""

    def __init__(self, app: object, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: object, receive: object, send: object) -> None:
        if not isinstance(scope, dict) or scope.get("type") != "http":
            await self.app(scope, receive, send)  # type: ignore[misc]
            return

        headers = dict(scope.get("headers", []))
        raw_content_length = headers.get(b"content-length")
        if raw_content_length is not None:
            try:
                if int(raw_content_length) > self.max_body_bytes:
                    await self._send_too_large(send)
                    return
            except ValueError:
                await self._send_too_large(send)
                return

        received_bytes = 0

        async def limited_receive() -> object:
            nonlocal received_bytes
            message = await receive()  # type: ignore[misc]
            if isinstance(message, dict) and message.get("type") == "http.request":
                received_bytes += len(message.get("body", b""))
                if received_bytes > self.max_body_bytes:
                    raise _RequestBodyTooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)  # type: ignore[misc]
        except _RequestBodyTooLarge:
            await self._send_too_large(send)

    async def _send_too_large(self, send: object) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": {
                    "message": "Request body exceeds the API size limit.",
                    "maximum_bytes": self.max_body_bytes,
                }
            },
        )
        await response({}, None, send)  # type: ignore[arg-type]


app.add_middleware(
    RequestBodyLimitMiddleware,
    max_body_bytes=MAX_API_REQUEST_BODY_BYTES,
)

# Local dev (Vite) and the desktop-app launcher serve the frontend from the
# same origin as this API, so they never need CORS. The hosted web demo
# serves the frontend from a separate origin (Cloudflare Pages) and this API
# from another (Render), so that origin must be allow-listed explicitly via
# env var rather than left open to "*" (this endpoint runs real compute).
_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if _ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_ALLOWED_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


@app.middleware("http")
async def add_api_security_headers(request: Request, call_next: object):
    """Apply browser-hardening headers to every API response."""

    response = await call_next(request)  # type: ignore[misc]
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), geolocation=(), microphone=()",
    )
    return response

def _optional_int_env(name: str) -> int | None:
    """Read an optional integer env var without crashing the app at import.

    A typo in a deploy dashboard should degrade to "cap not set" and say so in
    the logs, not take the whole service down with an import-time traceback.
    """

    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return None
    try:
        return int(raw.strip())
    except ValueError:
        logger.warning("Ignoring non-integer %s=%r; the cap stays unset.", name, raw)
        return None


# Dense simulation cost is O(8^n); the desktop app and test suite rely on the
# full le=18 validation range, but a publicly reachable server shares memory
# across every visitor, so it gets its own, stricter cap via env var. Unset
# by default so existing (non-public) deployments are unaffected.
# A cross-origin deployment is the public web demo.  It is intentionally
# restricted to the Circuit Studio's documented 2-8 qubit range.  Operators
# may lower the cap, but cannot accidentally raise the public limit above 8.
PUBLIC_WEB_MAX_LOGICAL_QUBITS = 8
_configured_public_qubit_cap = _optional_int_env("PUBLIC_MAX_LOGICAL_QUBITS")
if _ALLOWED_ORIGINS:
    PUBLIC_MAX_LOGICAL_QUBITS = min(
        PUBLIC_WEB_MAX_LOGICAL_QUBITS,
        _configured_public_qubit_cap or PUBLIC_WEB_MAX_LOGICAL_QUBITS,
    )
else:
    # Keep the desktop launcher and local development capable of exercising
    # their broader supported range unless an operator explicitly constrains it.
    PUBLIC_MAX_LOGICAL_QUBITS = _configured_public_qubit_cap

# str(exc) can carry file paths and internal state. The hosted web demo is the
# deployment that sets ALLOWED_ORIGINS (frontend and API on separate origins),
# so the same signal defaults public deploys to type-only errors, while local
# dev and the desktop launcher keep the full message their admin-mode
# diagnostics panel displays.  Error details are opt-in only; a missing or
# misconfigured CORS variable must never make a public deployment leak them.
_EXPOSE_INTERNAL_ERRORS_ENV = os.environ.get("EXPOSE_INTERNAL_ERRORS", "").strip()
EXPOSE_INTERNAL_ERRORS = (
    _EXPOSE_INTERNAL_ERRORS_ENV.lower() in {"1", "true", "yes", "on"}
    if _EXPOSE_INTERNAL_ERRORS_ENV
    else False
)


def _failure_detail(message: str, exc: Exception) -> dict[str, object]:
    """Build a 500 detail body, withholding the raw message off-origin."""

    detail: dict[str, object] = {
        "message": message,
        "error_type": exc.__class__.__name__,
    }
    if EXPOSE_INTERNAL_ERRORS:
        detail["error"] = str(exc)
    return detail


PULSE_API_TIMEOUT_SECONDS = 90.0
PULSE_API_MAX_CONCURRENT_REQUESTS = 2
_PULSE_EXECUTOR = ThreadPoolExecutor(
    max_workers=PULSE_API_MAX_CONCURRENT_REQUESTS,
    thread_name_prefix="yuragi-strider-pulse",
)
_PULSE_EXECUTION_SLOTS = BoundedSemaphore(
    PULSE_API_MAX_CONCURRENT_REQUESTS
)

# Circuit simulation gets the same shape of budget the pulse endpoint already
# has. Without it a single request with a large time_steps pins a shared host
# indefinitely: the logical-qubit cap above bounds the matrix size, not the
# number of steps taken through it.
SIMULATE_API_TIMEOUT_SECONDS = 120.0
SIMULATE_API_MAX_CONCURRENT_REQUESTS = 2
_SIMULATE_EXECUTOR = ThreadPoolExecutor(
    max_workers=SIMULATE_API_MAX_CONCURRENT_REQUESTS,
    thread_name_prefix="yuragi-strider-simulate",
)
_SIMULATE_EXECUTION_SLOTS = BoundedSemaphore(
    SIMULATE_API_MAX_CONCURRENT_REQUESTS
)
# Generous next to real use (the validation suite tops out at 101 steps and
# 200 us) but finite, so an absurd request is rejected before any compute.
MAX_API_TIME_STEPS = 2001
MAX_API_DURATION_US = 10_000.0
MAX_API_CIRCUIT_COLUMNS = 200
MAX_API_GATES_PER_COLUMN = 16
MAX_API_CIRCUIT_GATES = 800
MAX_API_CIRCUIT_ANNOTATIONS = 200
MAX_API_GATE_QUBIT_REFERENCES = 18


class GateDurationDefaultsRequest(BaseModel):
    H: float = Field(default=0.02, gt=0.0)
    X: float = Field(default=0.02, gt=0.0)
    Y: float = Field(default=0.02, gt=0.0)
    Z: float = Field(default=0.0, ge=0.0)
    S: float = Field(default=0.0, ge=0.0)
    T: float = Field(default=0.0, ge=0.0)
    RX: float = Field(default=0.02, gt=0.0)
    RY: float = Field(default=0.02, gt=0.0)
    RZ: float = Field(default=0.02, gt=0.0)
    CNOT: float = Field(default=0.2, gt=0.0)
    CZ: float = Field(default=0.2, gt=0.0)
    SWAP: float = Field(default=0.2, gt=0.0)
    CP: float = Field(default=0.2, gt=0.0)
    CCX: float = Field(default=0.4, gt=0.0)
    # QFT and ORACLE span a variable register, so these are per spanned qubit.
    QFT: float = Field(default=0.2, gt=0.0)
    ORACLE: float = Field(default=0.2, gt=0.0)
    MEASURE: float = Field(default=0.0, ge=0.0)
    MESSAGE: float = Field(default=0.04, gt=0.0)


class SnapshotOptionsRequest(BaseModel):
    enabled: bool = True
    uniform_count: int = Field(default=0, ge=0, le=100)
    custom_times_us: list[float] = Field(default_factory=list, max_length=100)
    include_initial: bool = True
    include_final: bool = True
    include_column_boundaries: bool = True
    include_after_circuit: bool = True

    @field_validator("uniform_count")
    @classmethod
    def validate_uniform_count(cls, value: int) -> int:
        if value == 1:
            raise ValueError("uniform_count must be 0 or an integer from 2 to 100")
        return value

    @field_validator("custom_times_us")
    @classmethod
    def validate_custom_times(cls, value: list[float]) -> list[float]:
        for time_us in value:
            if not math.isfinite(time_us) or time_us < 0.0:
                raise ValueError("custom_times_us must contain finite, non-negative times")
        return value


class MeasurementOptionsRequest(BaseModel):
    shots: int = Field(default=1024, ge=1, le=100_000)
    seed: int = Field(default=0, ge=0, le=2 ** 32 - 1)


class SimulationParametersRequest(BaseModel):
    normalized_temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    normalized_magnetic_field: float | None = Field(default=None, ge=0.0, le=1.0)
    noise_level: float | None = Field(default=None, ge=0.0, le=1.0)
    device_quality: float | None = Field(default=None, ge=0.0, le=1.0)
    temperature_mk: float | None = Field(default=None, ge=0.0)
    flux_noise_phi0: float | None = Field(default=None, ge=0.0)
    qubit_frequency_ghz: float | None = Field(default=None, gt=0.0)
    t1_max_us: float | None = Field(default=None, gt=0.0)
    tphi_max_us: float | None = Field(default=None, gt=0.0)
    ideal_reference: bool = False
    duration_us: float | None = Field(default=None, gt=0.0, le=MAX_API_DURATION_US)
    time_steps: int | None = Field(default=None, ge=2, le=MAX_API_TIME_STEPS)
    fidelity_threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class CircuitGateParamsRequest(BaseModel):
    duration_us: float | None = None
    theta_rad: float | None = None
    control_value: Literal[0, 1] | None = None
    control_state: int | None = Field(default=None, ge=0)
    animation_parameter_t: float | None = None
    marked_index: float | None = None

    @field_validator("marked_index")
    @classmethod
    def validate_marked_index(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if not math.isfinite(value) or value != int(value) or value < 0:
            raise ValueError("marked_index must be a non-negative integer.")
        return value

    @field_validator("duration_us")
    @classmethod
    def validate_duration_us(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if not math.isfinite(value) or value < 0.0:
            raise ValueError("duration_us must be finite and greater than or equal to 0.")
        return value

    @field_validator("theta_rad")
    @classmethod
    def validate_theta_rad(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("theta_rad must be finite.")
        return value

    @field_validator("animation_parameter_t")
    @classmethod
    def validate_animation_parameter_t(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("animation_parameter_t must be finite.")
        return value


class ClassicalConditionRequest(BaseModel):
    bit: int = Field(ge=0, le=31)
    value: Literal[0, 1]


class CircuitGateRequest(BaseModel):
    type: Literal["H", "X", "Y", "Z", "S", "T", "RX", "RY", "RZ", "CNOT", "CZ", "CP", "CCX", "SWAP", "QFT", "ORACLE", "MEASURE", "MESSAGE", "RECEIVED"]
    targets: list[int] = Field(max_length=MAX_API_GATE_QUBIT_REFERENCES)
    controls: list[int] = Field(
        default_factory=list,
        max_length=MAX_API_GATE_QUBIT_REFERENCES,
    )
    params: CircuitGateParamsRequest = Field(default_factory=CircuitGateParamsRequest)
    classical_targets: list[int] = Field(default_factory=list, max_length=32)
    condition: ClassicalConditionRequest | None = None
    conditions: list[ClassicalConditionRequest] = Field(
        default_factory=list,
        max_length=32,
    )

    @model_validator(mode="after")
    def validate_gate_shape(self) -> CircuitGateRequest:
        gate_type = self.type
        targets = self.targets or []
        controls = self.controls or []

        if gate_type == "CNOT":
            if len(controls) < 1:
                raise ValueError("CNOT requires at least one control qubit.")
            if len(targets) != 1:
                raise ValueError("CNOT requires exactly one target qubit.")
            if len(set(controls)) != len(controls) or targets[0] in controls:
                raise ValueError(
                    "CNOT controls and target must all be different qubits."
                )
            control_state = self.params.control_state
            if control_state is not None and control_state >= 2 ** len(controls):
                raise ValueError("CNOT control_state is outside the control-bit range.")
        elif gate_type in {"CZ", "CP"}:
            if len(controls) != 1:
                raise ValueError(f"{gate_type} requires exactly one control qubit.")
            if len(targets) != 1:
                raise ValueError(f"{gate_type} requires exactly one target qubit.")
            if controls[0] == targets[0]:
                raise ValueError(f"{gate_type} control and target must be different qubits.")
        elif gate_type == "CCX":
            if len(controls) != 2:
                raise ValueError("CCX requires exactly two control qubits.")
            if len(targets) != 1:
                raise ValueError("CCX requires exactly one target qubit.")
            if len({*controls, targets[0]}) != 3:
                raise ValueError("CCX controls and target must be different qubits.")
        elif gate_type == "SWAP":
            if controls:
                raise ValueError("SWAP does not accept control qubits.")
            if len(targets) != 2:
                raise ValueError("SWAP requires exactly two target qubits.")
            if targets[0] == targets[1]:
                raise ValueError("SWAP target qubits must be different.")
        elif gate_type in {"QFT", "ORACLE"}:
            if controls:
                raise ValueError(f"{gate_type} does not accept control qubits.")
            if not targets:
                raise ValueError(f"{gate_type} requires at least one target qubit.")
            if len(set(targets)) != len(targets):
                raise ValueError(f"{gate_type} target qubits must all be different.")
            if gate_type == "ORACLE":
                marked = self.params.marked_index
                if marked is not None and not 0 <= int(marked) < 2 ** len(targets):
                    raise ValueError(
                        "ORACLE marked_index must be inside the register range "
                        f"0..{2 ** len(targets) - 1}."
                    )
        else:
            if len(targets) != 1:
                raise ValueError(f"{gate_type} requires exactly one target qubit.")
            if controls:
                raise ValueError(f"{gate_type} does not accept control qubits.")

        return self


class CircuitColumnRequest(BaseModel):
    step: int = Field(default=0, ge=0)
    gates: list[CircuitGateRequest] = Field(
        default_factory=list,
        max_length=MAX_API_GATES_PER_COLUMN,
    )


class CircuitAnnotationRequest(BaseModel):
    kind: Literal["MESSAGE", "RECEIVED"]
    id: str | None = Field(default=None, max_length=128)
    source_id: str | None = Field(default=None, max_length=128)
    column_index: int = Field(ge=0)
    qubits: list[int] = Field(
        default_factory=list,
        max_length=MAX_API_GATE_QUBIT_REFERENCES,
    )


class AnimationParameterRequest(BaseModel):
    """Explicit Quirk-style parameter override, separate from physical time."""

    name: Literal["theta_rad", "animation_parameter_t"]
    value: float
    column_index: int = Field(ge=0)
    gate_index: int = Field(ge=0)

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("animation parameter value must be finite")
        return value


class CircuitConfigRequest(BaseModel):
    logical_qubits: int = Field(ge=1, le=18)
    classical_bits: int = Field(default=0, ge=0, le=32)
    initial_states: list[int | str] = Field(max_length=18)
    columns: list[CircuitColumnRequest] = Field(
        default_factory=list,
        max_length=MAX_API_CIRCUIT_COLUMNS,
    )
    annotations: list[CircuitAnnotationRequest] = Field(
        default_factory=list,
        max_length=MAX_API_CIRCUIT_ANNOTATIONS,
    )

    @model_validator(mode="after")
    def validate_circuit_config(self) -> CircuitConfigRequest:
        logical_qubits = self.logical_qubits
        initial_states = self.initial_states or []
        columns = self.columns or []
        classical_bits = self.classical_bits or 0

        if len(initial_states) != logical_qubits:
            raise ValueError("initial_states must match logical_qubits.")

        if sum(len(column.gates) for column in columns) > MAX_API_CIRCUIT_GATES:
            raise ValueError(
                "circuit exceeds the maximum number of API gate operations."
            )

        for index, initial_state in enumerate(initial_states):
            if str(initial_state) not in {"0", "1", "+", "-"}:
                raise ValueError(
                    f"initial_states[{index}] must be one of 0, 1, +, or -."
                )

        for column in columns:
            for gate in column.gates:
                for target in gate.targets:
                    if target < 0 or target >= logical_qubits:
                        raise ValueError(
                            "Gate target is outside the logical qubit range."
                        )
                for control in gate.controls or []:
                    if control < 0 or control >= logical_qubits:
                        raise ValueError(
                            "Gate control is outside the logical qubit range."
                        )
                for classical_target in gate.classical_targets:
                    if classical_target >= classical_bits:
                        raise ValueError(
                            "classical target is outside the classical register range."
                        )
                if gate.condition is not None and gate.condition.bit >= classical_bits:
                    raise ValueError(
                        "classical condition bit is outside the classical register range."
                    )
                for condition in gate.conditions:
                    if condition.bit >= classical_bits:
                        raise ValueError(
                            "classical condition bit is outside the classical register range."
                        )
                if gate.classical_targets and gate.type != "MEASURE":
                    raise ValueError(
                        "classical_targets are only valid for MEASURE gates."
                    )
                if gate.type == "MEASURE" and gate.classical_targets and len(
                    gate.classical_targets
                ) != len(gate.targets):
                    raise ValueError(
                        "MEASURE classical_targets must match the measured targets."
                    )

        for annotation in self.annotations or []:
            for qubit in annotation.qubits:
                if qubit < 0 or qubit >= logical_qubits:
                    raise ValueError("Annotation qubit is outside the logical qubit range.")

        return self


class SimulateRequest(BaseModel):
    circuit_preset: Literal["bell", "teleportation", "bit_flip_repetition"] | None = None
    simulation_backend: Literal["python_dense", "rust_dense_preview"]
    evolution_method: Literal["fixed_step_rk4", "explicit_cptp"] = (
        "fixed_step_rk4"
    )
    compilation_mode: Literal["logical_direct", "auto_decompose"] = (
        "logical_direct"
    )
    input_mode: Literal["normalized", "physical"] = INPUT_MODE_NORMALIZED
    gate_duration_defaults: GateDurationDefaultsRequest = Field(
        default_factory=GateDurationDefaultsRequest
    )
    circuit_config: CircuitConfigRequest | None = None
    animation_parameter: AnimationParameterRequest | None = None
    snapshot_options: SnapshotOptionsRequest | None = None
    measurement_options: MeasurementOptionsRequest = Field(
        default_factory=MeasurementOptionsRequest
    )
    parameters: SimulationParametersRequest

    @model_validator(mode="before")
    @classmethod
    def validate_parameters_for_input_mode(cls, values: object) -> object:
        # A "before" validator sees the raw input, which is a mapping for the
        # JSON request path but not for e.g. model_validate on an instance.
        if not isinstance(values, dict):
            return values
        if values.get("circuit_config") is None and values.get("circuit_preset") is None:
            raise ValueError("circuit_preset or circuit_config is required")
        input_mode = values.get("input_mode", INPUT_MODE_NORMALIZED)
        if input_mode not in {INPUT_MODE_NORMALIZED, INPUT_MODE_PHYSICAL}:
            return values
        parameters = values.get("parameters")
        if not isinstance(parameters, dict):
            return values
        required_fields = ["duration_us", "time_steps", "fidelity_threshold"]
        required_fields.extend(
            ["normalized_temperature", "normalized_magnetic_field", "noise_level"]
            if input_mode == INPUT_MODE_NORMALIZED
            else ["device_quality", "temperature_mk", "flux_noise_phi0", "qubit_frequency_ghz", "t1_max_us", "tphi_max_us"]
        )
        missing_fields = [field_name for field_name in required_fields if parameters.get(field_name) is None]
        if missing_fields:
            raise ValueError(f"parameters missing required fields for {input_mode} input_mode: {', '.join(missing_fields)}")
        snapshot_options = values.get("snapshot_options")
        if isinstance(snapshot_options, dict):
            duration_us = parameters.get("duration_us")
            if duration_us is not None and any(isinstance(time_us, (int, float)) and time_us > duration_us for time_us in (snapshot_options.get("custom_times_us") or [])):
                raise ValueError("snapshot_options.custom_times_us must not exceed parameters.duration_us")
        return values


class CompilePreviewRequest(BaseModel):
    """Everything the gate compiler needs, and nothing the simulator needs.

    Compilation is a pure circuit rewrite, so the preview deliberately does not
    accept environment parameters, backends, or snapshot options: the diagram it
    returns depends only on the circuit, the mode, and the gate durations.
    """

    circuit_preset: Literal["bell", "teleportation", "bit_flip_repetition"] | None = None
    compilation_mode: Literal["logical_direct", "auto_decompose"] = (
        "logical_direct"
    )
    gate_duration_defaults: GateDurationDefaultsRequest = Field(
        default_factory=GateDurationDefaultsRequest
    )
    circuit_config: CircuitConfigRequest | None = None

    @model_validator(mode="before")
    @classmethod
    def validate_circuit_source(cls, values: object) -> object:
        if not isinstance(values, dict):
            return values
        if values.get("circuit_config") is None and values.get("circuit_preset") is None:
            raise ValueError("circuit_preset or circuit_config is required")
        return values


def build_bell_circuit(
    gate_durations: GateDurationDefaultsRequest | None = None,
) -> CircuitConfig:
    durations = gate_durations or GateDurationDefaultsRequest()
    return CircuitConfig(
        logical_qubits=2,
        initial_states=["0", "0"],
        columns=[
            GateColumn(
                step=0,
                gates=[
                    GateOperation(
                        type="H",
                        targets=[0],
                        controls=[],
                        params={"duration_us": durations.H},
                    )
                ],
            ),
            GateColumn(
                step=1,
                gates=[
                    GateOperation(
                        type="CNOT",
                        targets=[1],
                        controls=[0],
                        params={"duration_us": durations.CNOT},
                    )
                ],
            ),
        ],
    )


def build_teleportation_circuit(
    gate_durations: GateDurationDefaultsRequest | None = None,
) -> CircuitConfig:
    """Three-qubit teleportation with explicit two-bit feed-forward."""
    durations = gate_durations or GateDurationDefaultsRequest()
    return CircuitConfig(
        logical_qubits=3,
        initial_states=["+", "0", "0"],
        classical_bits=2,
        columns=[
            GateColumn(0, [GateOperation("H", [1], params={"duration_us": durations.H})]),
            GateColumn(1, [GateOperation("CNOT", [2], [1], params={"duration_us": durations.CNOT})]),
            GateColumn(2, [GateOperation("CNOT", [1], [0], params={"duration_us": durations.CNOT})]),
            GateColumn(3, [GateOperation("H", [0], params={"duration_us": durations.H})]),
            GateColumn(4, [GateOperation("MEASURE", [0], params={"duration_us": durations.MEASURE}, classical_targets=[0])]),
            GateColumn(5, [GateOperation("MEASURE", [1], params={"duration_us": durations.MEASURE}, classical_targets=[1])]),
            GateColumn(6, [GateOperation("X", [2], params={"duration_us": durations.X}, condition={"bit": 1, "value": 1})]),
            GateColumn(7, [GateOperation("Z", [2], params={"duration_us": durations.Z}, condition={"bit": 0, "value": 1})]),
        ],
    )


def build_bit_flip_repetition_circuit(
    gate_durations: GateDurationDefaultsRequest | None = None,
) -> CircuitConfig:
    """Five-qubit 3-bit repetition code with two-bit syndrome correction.

    q0-q2 are data, q3-q4 are syndrome ancillas. An X on q1 is injected as a
    deterministic fault so the preset demonstrates the complete encode,
    syndrome-measure, conditional-correction flow.
    """
    durations = gate_durations or GateDurationDefaultsRequest()
    def op(gate_type: str, targets: list[int], controls: list[int] | None = None, **kwargs):
        return GateOperation(
            gate_type,
            targets,
            controls or [],
            params={"duration_us": getattr(durations, gate_type)},
            **kwargs,
        )
    return CircuitConfig(
        logical_qubits=5,
        initial_states=["1", "0", "0", "0", "0"],
        classical_bits=2,
        columns=[
            GateColumn(0, [op("CNOT", [1], [0])]),
            GateColumn(1, [op("CNOT", [2], [0])]),
            GateColumn(2, [op("X", [1])]),
            GateColumn(3, [op("CNOT", [3], [0])]),
            GateColumn(4, [op("CNOT", [3], [1])]),
            GateColumn(5, [op("CNOT", [4], [1])]),
            GateColumn(6, [op("CNOT", [4], [2])]),
            GateColumn(7, [op("MEASURE", [3], classical_targets=[0])]),
            GateColumn(8, [op("MEASURE", [4], classical_targets=[1])]),
            GateColumn(9, [op("X", [0], conditions=[{"bit": 0, "value": 1}, {"bit": 1, "value": 0}])]),
            GateColumn(10, [op("X", [1], conditions=[{"bit": 0, "value": 1}, {"bit": 1, "value": 1}])]),
            GateColumn(11, [op("X", [2], conditions=[{"bit": 0, "value": 0}, {"bit": 1, "value": 1}])]),
        ],
    )


def build_custom_circuit(
    circuit_config: CircuitConfigRequest,
    gate_durations: GateDurationDefaultsRequest,
) -> CircuitConfig:
    duration_defaults = {
        "H": gate_durations.H,
        "X": gate_durations.X,
        "Y": gate_durations.Y,
        "Z": gate_durations.Z,
        "S": gate_durations.S,
        "T": gate_durations.T,
        "RX": gate_durations.RX,
        "RY": gate_durations.RY,
        "RZ": gate_durations.RZ,
        "CNOT": gate_durations.CNOT,
        "CZ": gate_durations.CZ,
        "SWAP": gate_durations.SWAP,
        "CP": gate_durations.CP,
        "CCX": gate_durations.CCX,
        "MEASURE": gate_durations.MEASURE,
        "MESSAGE": gate_durations.MESSAGE,
    }

    def default_duration_us(gate: CircuitGateRequest) -> float:
        # QFT and ORACLE declare their default per spanned qubit.
        if gate.type == "QFT":
            return gate_durations.QFT * len(gate.targets)
        if gate.type == "ORACLE":
            return gate_durations.ORACLE * len(gate.targets)
        return duration_defaults[gate.type]

    return CircuitConfig(
        logical_qubits=circuit_config.logical_qubits,
        classical_bits=circuit_config.classical_bits,
        initial_states=[str(state) for state in circuit_config.initial_states],
        columns=[
            GateColumn(
                step=column.step,
                gates=[
                    GateOperation(
                        type=gate.type,
                        targets=list(gate.targets),
                        controls=list(gate.controls),
                        params={
                            **gate.params.model_dump(exclude_none=True),
                            **(
                                {"duration_us": default_duration_us(gate)}
                                if gate.params.duration_us is None
                                else {}
                            ),
                        },
                        classical_targets=list(gate.classical_targets),
                        condition=(
                            None
                            if gate.condition is None
                            else {
                                "bit": gate.condition.bit,
                                "value": gate.condition.value,
                            }
                        ),
                        conditions=[
                            {"bit": item.bit, "value": item.value}
                            for item in gate.conditions
                        ],
                    )
                    for gate in column.gates
                    if gate.type != "RECEIVED"
                ],
            )
            for column in circuit_config.columns
        ],
        annotations=[
            CircuitAnnotation(
                kind=annotation.kind,
                id=annotation.id,
                source_id=annotation.source_id,
                column_index=annotation.column_index,
                qubits=list(annotation.qubits),
            )
            for annotation in circuit_config.annotations
        ] + [
            CircuitAnnotation(
                kind="RECEIVED",
                id=f"received-column-{column.step}-gate-{gate_index}",
                column_index=column.step,
                qubits=list(gate.targets),
            )
            for column in circuit_config.columns
            for gate_index, gate in enumerate(column.gates)
            if gate.type == "RECEIVED"
        ],
    )


def build_example_config() -> SimulationConfig:
    return SimulationConfig(
        circuit=build_bell_circuit(),
        environment=EnvironmentConfig(),
        duration_us=2.0,
        time_steps=11,
        fidelity_threshold=0.9,
        simulation_backend="python_dense",
    )


def _build_requested_circuit(
    circuit_config: CircuitConfigRequest | None,
    circuit_preset: str | None,
    gate_duration_defaults: GateDurationDefaultsRequest,
) -> CircuitConfig:
    """Resolve the circuit a request asked for, by config or by preset name."""

    if circuit_config is not None:
        return build_custom_circuit(circuit_config, gate_duration_defaults)
    if circuit_preset == "teleportation":
        return build_teleportation_circuit(gate_duration_defaults)
    if circuit_preset == "bit_flip_repetition":
        return build_bit_flip_repetition_circuit(gate_duration_defaults)
    return build_bell_circuit(gate_duration_defaults)


def build_config_from_simulate_request(request: SimulateRequest) -> SimulationConfig:
    parameters = request.parameters
    if request.input_mode == INPUT_MODE_PHYSICAL:
        environment = EnvironmentConfig(
            input_mode=INPUT_MODE_PHYSICAL,
            device_quality=_required(parameters.device_quality, "device_quality"),
            temperature_mk=_required(parameters.temperature_mk, "temperature_mk"),
            flux_noise_phi0=_required(parameters.flux_noise_phi0, "flux_noise_phi0"),
            qubit_frequency_ghz=_required(
                parameters.qubit_frequency_ghz,
                "qubit_frequency_ghz",
            ),
            t1_max_us=_required(parameters.t1_max_us, "t1_max_us"),
            tphi_max_us=_required(parameters.tphi_max_us, "tphi_max_us"),
            ideal_reference=parameters.ideal_reference,
        )
    else:
        environment = EnvironmentConfig(
            input_mode=INPUT_MODE_NORMALIZED,
            temperature=_required(
                parameters.normalized_temperature,
                "normalized_temperature",
            ),
            magnetic_field=_required(
                parameters.normalized_magnetic_field,
                "normalized_magnetic_field",
            ),
            noise_level=_required(parameters.noise_level, "noise_level"),
        )

    circuit = _build_requested_circuit(
        request.circuit_config,
        request.circuit_preset,
        request.gate_duration_defaults,
    )

    if request.animation_parameter is not None:
        circuit = apply_animation_parameter(circuit, request.animation_parameter)

    return SimulationConfig(
        circuit=circuit,
        environment=environment,
        duration_us=_required(parameters.duration_us, "duration_us"),
        time_steps=_required(parameters.time_steps, "time_steps"),
        fidelity_threshold=_required(
            parameters.fidelity_threshold,
            "fidelity_threshold",
        ),
        simulation_backend=request.simulation_backend,
        evolution_method=request.evolution_method,
        compilation_mode=request.compilation_mode,
        native_gate_durations_us={
            name: float(value)
            for name, value in request.gate_duration_defaults.model_dump().items()
        },
        measurement_shots=request.measurement_options.shots,
        measurement_seed=request.measurement_options.seed,
        snapshot_options=(
            None
            if request.snapshot_options is None
            else {
                "enabled": request.snapshot_options.enabled,
                "uniform_count": request.snapshot_options.uniform_count,
                "custom_times_us": request.snapshot_options.custom_times_us,
                "include_initial": request.snapshot_options.include_initial,
                "include_final": request.snapshot_options.include_final,
                "include_column_boundaries": request.snapshot_options.include_column_boundaries,
                "include_after_circuit": request.snapshot_options.include_after_circuit,
            }
        ),
    )


def apply_animation_parameter(
    circuit: CircuitConfig,
    animation_parameter: AnimationParameterRequest,
) -> CircuitConfig:
    """Apply a named demo parameter before entering the stable core boundary."""

    column_index = animation_parameter.column_index
    gate_index = animation_parameter.gate_index
    if column_index >= len(circuit.columns):
        raise ValueError("animation parameter column_index is outside the circuit")
    target_column = circuit.columns[column_index]
    if gate_index >= len(target_column.gates):
        raise ValueError("animation parameter gate_index is outside the column")
    target_gate = target_column.gates[gate_index]
    target_type = str(target_gate.type).upper()
    if animation_parameter.name == "theta_rad" and target_type not in {"RX", "RY", "RZ", "CP"}:
        raise ValueError("theta_rad animation requires RX, RY, RZ, or CP")
    if animation_parameter.name == "animation_parameter_t" and target_type != "MESSAGE":
        raise ValueError("animation_parameter_t requires a MESSAGE gate")
    parameter_name = animation_parameter.name
    parameter_value = animation_parameter.value % 1.0 if parameter_name == "animation_parameter_t" else animation_parameter.value
    updated_columns = list(circuit.columns)
    updated_gates = list(target_column.gates)
    updated_gates[gate_index] = GateOperation(
        type=target_gate.type,
        targets=list(target_gate.targets),
        controls=list(target_gate.controls or []),
        params={**(target_gate.params or {}), parameter_name: parameter_value},
        classical_targets=list(target_gate.classical_targets or []),
        conditions=[
            {"bit": item.bit, "value": item.value}
            for item in target_gate.conditions
        ],
    )
    updated_columns[column_index] = GateColumn(
        step=target_column.step,
        gates=updated_gates,
    )
    return CircuitConfig(
        logical_qubits=circuit.logical_qubits,
        initial_states=list(circuit.initial_states),
        classical_bits=circuit.classical_bits,
        columns=updated_columns,
        annotations=list(circuit.annotations),
    )


def _required(value: float | int | None, field_name: str) -> float | int:
    if value is None:
        raise ValueError(f"{field_name} is required")
    return value


@app.get("/api/health")
def health() -> dict[str, object]:
    """Report liveness plus the pulse contract this build actually accepts.

    The frontend and API deploy separately, so a stale API can serve a UI that
    sends model ids it has never heard of.  That surfaces only as a 422 at run
    time, which reads to the user as "my settings are wrong" rather than "this
    server is old".  Listing the accepted ids here lets the client detect the
    mismatch before anyone presses run.  An older build omits `pulse_models`
    entirely, which is itself the signal.
    """

    return {
        "status": "ok",
        "pulse_models": sorted(DECLARED_PULSE_MODELS),
        "pulse_model_statuses": dict(sorted(PULSE_MODEL_STATUSES.items())),
    }


@app.get("/api/simulation/example")
def simulation_example() -> dict[str, object]:
    result = run_simulation(build_example_config())
    return simulation_result_to_ui_response(result)


@app.post(
    "/api/circuit/compile",
    responses={
        422: {"description": "Invalid or over-budget circuit."},
    },
)
def compile_circuit_preview(request: CompilePreviewRequest) -> dict[str, object]:
    """Compile a circuit without simulating it, for the pre-run preview.

    This is the same rewrite `/api/simulate` performs internally, returned in
    the same shape, so the editor can show the decomposed circuit before anyone
    pays for a run. It never touches the simulator, so it stays cheap enough to
    call on every circuit edit and needs no execution slot.
    """

    if (
        PUBLIC_MAX_LOGICAL_QUBITS is not None
        and request.circuit_config is not None
        and request.circuit_config.logical_qubits > PUBLIC_MAX_LOGICAL_QUBITS
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "message": "logical_qubits exceeds the public demo limit.",
                "maximum_logical_qubits": PUBLIC_MAX_LOGICAL_QUBITS,
            },
        )

    try:
        circuit = _build_requested_circuit(
            request.circuit_config,
            request.circuit_preset,
            request.gate_duration_defaults,
        )
        compilation = compile_gate_aware_circuit(
            circuit,
            request.compilation_mode,
            {
                name: float(value)
                for name, value in request.gate_duration_defaults.model_dump().items()
            },
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=_failure_detail("Circuit compilation failed.", exc),
        ) from exc
    except Exception as exc:
        logger.exception("Circuit compilation preview failed.")
        raise HTTPException(
            status_code=500,
            detail=_failure_detail("Circuit compilation failed.", exc),
        ) from exc

    return {"compilation": compilation_response(compilation.diagnostics)}


@app.post(
    "/api/pulse/simulate",
    response_model=PulseApiResponse,
    responses={
        422: {"description": "Invalid or over-budget pulse request."},
        503: {"description": "Pulse execution capacity is busy."},
        504: {"description": "Pulse execution exceeded the API timeout."},
    },
)
def pulse_simulate(request: PulseApiRequest) -> dict[str, object]:
    if not _PULSE_EXECUTION_SLOTS.acquire(blocking=False):
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Pulse execution capacity is busy.",
                "maximum_concurrent_requests": (
                    PULSE_API_MAX_CONCURRENT_REQUESTS
                ),
            },
        )
    try:
        future = _PULSE_EXECUTOR.submit(run_pulse_request, request)
    except Exception:
        _PULSE_EXECUTION_SLOTS.release()
        raise
    future.add_done_callback(
        lambda completed: _PULSE_EXECUTION_SLOTS.release()
    )
    try:
        return future.result(timeout=PULSE_API_TIMEOUT_SECONDS)
    except FuturesTimeoutError as exc:
        future.cancel()
        raise HTTPException(
            status_code=504,
            detail={
                "message": "Pulse simulation timed out.",
                "timeout_seconds": PULSE_API_TIMEOUT_SECONDS,
                "previous_results_preserved": True,
            },
        ) from exc
    except PulseExecutionLimitError as exc:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Pulse request exceeds execution limits.",
                "error": str(exc),
            },
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Pulse simulation failed.")
        raise HTTPException(
            status_code=500,
            detail=_failure_detail("Pulse simulation failed.", exc),
        ) from exc


def _run_simulate_request(request: SimulateRequest) -> dict[str, object]:
    request_started_at = perf_counter()
    try:
        config_started_at = perf_counter()
        config = build_config_from_simulate_request(request)
        build_config_ms = (perf_counter() - config_started_at) * 1000.0

        run_started_at = perf_counter()
        result = run_simulation(config)
        run_simulation_ms = (perf_counter() - run_started_at) * 1000.0

        ui_response_started_at = perf_counter()
        response = simulation_result_to_ui_response(result)
        ui_response_ms = (perf_counter() - ui_response_started_at) * 1000.0

        total_request_ms = (perf_counter() - request_started_at) * 1000.0
        diagnostics = response.get("diagnostics")
        if isinstance(diagnostics, dict):
            diagnostics.update({
                "api_build_config_ms": round(build_config_ms, 3),
                "api_run_simulation_ms": round(run_simulation_ms, 3),
                "api_ui_response_ms": round(ui_response_ms, 3),
                "api_total_request_ms": round(total_request_ms, 3),
                "api_logical_qubits": int(config.circuit.logical_qubits),
                "api_circuit_column_count": len(config.circuit.columns),
                "api_circuit_gate_count": sum(
                    len(column.gates) for column in config.circuit.columns
                ),
                "api_time_steps": int(config.time_steps),
                "api_duration_us": float(config.duration_us),
            })
            if request.animation_parameter is not None:
                diagnostics["animation_parameter"] = {
                    "name": request.animation_parameter.name,
                    "value": float(request.animation_parameter.value),
                    "column_index": int(request.animation_parameter.column_index),
                    "gate_index": int(request.animation_parameter.gate_index),
                }

        return response
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Simulation failed.")
        raise HTTPException(
            status_code=500,
            detail=_failure_detail("Simulation failed.", exc),
        ) from exc


@app.post(
    "/api/simulate",
    responses={
        422: {"description": "Invalid or over-budget simulation request."},
        503: {"description": "Simulation capacity is busy."},
        504: {"description": "Simulation exceeded the API timeout."},
    },
)
def simulate(request: SimulateRequest) -> dict[str, object]:
    if (
        PUBLIC_MAX_LOGICAL_QUBITS is not None
        and request.circuit_config is not None
        and request.circuit_config.logical_qubits > PUBLIC_MAX_LOGICAL_QUBITS
    ):
        raise HTTPException(
            status_code=422,
            detail={
                "message": "logical_qubits exceeds the public demo limit.",
                "maximum_logical_qubits": PUBLIC_MAX_LOGICAL_QUBITS,
            },
        )

    if not _SIMULATE_EXECUTION_SLOTS.acquire(blocking=False):
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Simulation capacity is busy.",
                "maximum_concurrent_requests": (
                    SIMULATE_API_MAX_CONCURRENT_REQUESTS
                ),
            },
        )
    try:
        future = _SIMULATE_EXECUTOR.submit(_run_simulate_request, request)
    except Exception:
        _SIMULATE_EXECUTION_SLOTS.release()
        raise
    future.add_done_callback(
        lambda completed: _SIMULATE_EXECUTION_SLOTS.release()
    )
    try:
        return future.result(timeout=SIMULATE_API_TIMEOUT_SECONDS)
    except FuturesTimeoutError as exc:
        future.cancel()
        raise HTTPException(
            status_code=504,
            detail={
                "message": "Simulation timed out.",
                "timeout_seconds": SIMULATE_API_TIMEOUT_SECONDS,
                "previous_results_preserved": True,
            },
        ) from exc
