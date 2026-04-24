# Quantum-Sim

Beginner-friendly interactive simulator for small quantum circuits under physical and environmental constraints.

## MVP Goal

The MVP focuses on helping users understand:
- how noise degrades a circuit over time,
- how environment settings change effective circuit lifetime,
- and why the same circuit behaves differently under different physical conditions.

## Project Layout

- `app/`: UI entry point and orchestration
- `core/`: circuit, environment, evolution, and metric logic
- `data/`: lightweight reference inputs and presets
- `tests/`: test coverage for the MVP modules

## Getting Started

This repository is currently scaffolded for MVP development. Module implementations can be expanded incrementally while keeping the simulator lightweight and interpretable.
