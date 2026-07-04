"""Minimal FastAPI example endpoint for UI SimulationResponse data."""

from __future__ import annotations

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.circuit_model import CircuitConfig, GateColumn, GateOperation
from core.results import EnvironmentConfig, SimulationConfig
from core.simulator import run_simulation
from core.ui_response import simulation_result_to_ui_response


app = FastAPI(title="QuantaScope API", version="0.1.0")


class SimulationParametersRequest(BaseModel):
    normalized_temperature: float = Field(ge=0.0, le=1.0)
    normalized_magnetic_field: float = Field(ge=0.0, le=1.0)
    noise_level: float = Field(ge=0.0, le=1.0)
    duration_us: float = Field(gt=0.0)
    time_steps: int = Field(ge=2)
    fidelity_threshold: float = Field(ge=0.0, le=1.0)


class SimulateRequest(BaseModel):
    circuit_preset: Literal["bell"]
    simulation_backend: Literal["python_dense"]
    parameters: SimulationParametersRequest


def build_bell_circuit() -> CircuitConfig:
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
                        params={"duration_us": 0.02},
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
                        params={"duration_us": 0.2},
                    )
                ],
            ),
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
    return SimulationConfig(
        circuit=build_bell_circuit(),
        environment=EnvironmentConfig(
            temperature=parameters.normalized_temperature,
            magnetic_field=parameters.normalized_magnetic_field,
            noise_level=parameters.noise_level,
        ),
        duration_us=parameters.duration_us,
        time_steps=parameters.time_steps,
        fidelity_threshold=parameters.fidelity_threshold,
        simulation_backend=request.simulation_backend,
    )


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
