"""Minimal FastAPI example endpoint for UI SimulationResponse data."""

from __future__ import annotations

import math
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, root_validator, validator

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.physical_environment import INPUT_MODE_NORMALIZED, INPUT_MODE_PHYSICAL
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


app = FastAPI(title="QuantaScope API", version="0.1.0")


class GateDurationDefaultsRequest(BaseModel):
    H: float = Field(default=0.02, gt=0.0)
    X: float = Field(default=0.02, gt=0.0)
    Z: float = Field(default=0.0, ge=0.0)
    CNOT: float = Field(default=0.2, gt=0.0)
    MEASURE: float = Field(default=0.0, ge=0.0)


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
    duration_us: float | None = Field(default=None, gt=0.0)
    time_steps: int | None = Field(default=None, ge=2)
    fidelity_threshold: float | None = Field(default=None, ge=0.0, le=1.0)


class CircuitGateParamsRequest(BaseModel):
    duration_us: float | None = None

    @validator("duration_us")
    def validate_duration_us(cls, value: float | None) -> float | None:
        if value is None:
            return value
        if not math.isfinite(value) or value < 0.0:
            raise ValueError("duration_us must be finite and greater than or equal to 0.")
        return value


class CircuitGateRequest(BaseModel):
    type: Literal["H", "X", "Z", "CNOT", "MEASURE"]
    targets: list[int]
    controls: list[int] = Field(default_factory=list)
    params: CircuitGateParamsRequest = Field(default_factory=CircuitGateParamsRequest)

    @root_validator(skip_on_failure=True)
    def validate_gate_shape(cls, values: dict[str, object]) -> dict[str, object]:
        gate_type = values.get("type")
        targets = values.get("targets") or []
        controls = values.get("controls") or []

        if gate_type == "CNOT":
            if len(controls) != 1:
                raise ValueError("CNOT requires exactly one control qubit.")
            if len(targets) != 1:
                raise ValueError("CNOT requires exactly one target qubit.")
            if controls[0] == targets[0]:
                raise ValueError("CNOT control and target must be different qubits.")
        else:
            if len(targets) != 1:
                raise ValueError(f"{gate_type} requires exactly one target qubit.")
            if controls:
                raise ValueError(f"{gate_type} does not accept control qubits.")

        return values


class CircuitColumnRequest(BaseModel):
    step: int = Field(default=0, ge=0)
    gates: list[CircuitGateRequest] = Field(default_factory=list)


class CircuitConfigRequest(BaseModel):
    logical_qubits: int = Field(ge=1, le=4)
    initial_states: list[int | str]
    columns: list[CircuitColumnRequest] = Field(default_factory=list)

    @root_validator(skip_on_failure=True)
    def validate_circuit_config(cls, values: dict[str, object]) -> dict[str, object]:
        logical_qubits = values.get("logical_qubits")
        initial_states = values.get("initial_states") or []
        columns = values.get("columns") or []

        if not isinstance(logical_qubits, int):
            return values

        if len(initial_states) != logical_qubits:
            raise ValueError("initial_states must match logical_qubits.")

        for index, initial_state in enumerate(initial_states):
            if str(initial_state) not in {"0", "1"}:
                raise ValueError(
                    f"initial_states[{index}] must be either 0 or 1."
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

        return values


class SimulateRequest(BaseModel):
    circuit_preset: Literal["bell"] | None = None
    simulation_backend: Literal["python_dense"]
    input_mode: Literal["normalized", "physical"] = INPUT_MODE_NORMALIZED
    gate_duration_defaults: GateDurationDefaultsRequest = Field(
        default_factory=GateDurationDefaultsRequest
    )
    circuit_config: CircuitConfigRequest | None = None
    parameters: SimulationParametersRequest

    @root_validator(pre=True)
    def validate_parameters_for_input_mode(cls, values: dict[str, object]) -> dict[str, object]:
        if values.get("circuit_config") is None and values.get("circuit_preset") is None:
            raise ValueError("circuit_preset or circuit_config is required")

        input_mode = values.get("input_mode", INPUT_MODE_NORMALIZED)
        if input_mode not in {INPUT_MODE_NORMALIZED, INPUT_MODE_PHYSICAL}:
            return values

        parameters = values.get("parameters")
        if not isinstance(parameters, dict):
            return values

        required_fields = ["duration_us", "time_steps", "fidelity_threshold"]
        if input_mode == INPUT_MODE_NORMALIZED:
            required_fields.extend([
                "normalized_temperature",
                "normalized_magnetic_field",
                "noise_level",
            ])
        else:
            required_fields.extend([
                "device_quality",
                "temperature_mk",
                "flux_noise_phi0",
                "qubit_frequency_ghz",
                "t1_max_us",
                "tphi_max_us",
            ])

        missing_fields = [
            field_name
            for field_name in required_fields
            if parameters.get(field_name) is None
        ]
        if missing_fields:
            joined_fields = ", ".join(missing_fields)
            raise ValueError(
                f"parameters missing required fields for {input_mode} input_mode: "
                f"{joined_fields}"
            )
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


def build_custom_circuit(
    circuit_config: CircuitConfigRequest,
    gate_durations: GateDurationDefaultsRequest,
) -> CircuitConfig:
    duration_defaults = {
        "H": gate_durations.H,
        "X": gate_durations.X,
        "Z": gate_durations.Z,
        "CNOT": gate_durations.CNOT,
        "MEASURE": gate_durations.MEASURE,
    }

    return CircuitConfig(
        logical_qubits=circuit_config.logical_qubits,
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
                                {"duration_us": duration_defaults[gate.type]}
                                if gate.params.duration_us is None
                                else {}
                            ),
                        },
                    )
                    for gate in column.gates
                ],
            )
            for column in circuit_config.columns
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

    circuit = (
        build_custom_circuit(request.circuit_config, request.gate_duration_defaults)
        if request.circuit_config is not None
        else build_bell_circuit(request.gate_duration_defaults)
    )

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
    )


def _required(value: float | int | None, field_name: str) -> float | int:
    if value is None:
        raise ValueError(f"{field_name} is required")
    return value


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/simulation/example")
def simulation_example() -> dict[str, object]:
    result = run_simulation(build_example_config())
    return simulation_result_to_ui_response(result)


@app.post("/api/simulate")
def simulate(request: SimulateRequest) -> dict[str, object]:
    try:
        result = run_simulation(build_config_from_simulate_request(request))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Simulation failed.",
        ) from exc
    return simulation_result_to_ui_response(result)
