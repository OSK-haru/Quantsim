# MVP Spec

## Objective

Build a lightweight interactive simulator that shows how small quantum circuits degrade under environmental constraints.

## Core User Experience

The MVP should let a user:
1. choose or define a small circuit,
2. adjust simple environment parameters,
3. run the simulation,
4. compare outcomes over time,
5. and understand what changed and why.

## MVP Modules

- `core/circuit.py`: small circuit representation
- `core/environment.py`: environmental parameter model
- `core/evolution.py`: time evolution under simple noise/decoherence assumptions
- `core/metrics.py`: interpretable outputs such as fidelity and effective lifetime
- `app/app.py`: interactive entry point for running the simulator

## Non-Goals

- large-system simulation
- production research accuracy
- pulse-level modeling
- broad SDK-style abstractions

## Success Criteria

- beginner can change a parameter and see a visible outcome difference
- outputs explain degradation clearly
- architecture stays small, readable, and easy to iterate on
